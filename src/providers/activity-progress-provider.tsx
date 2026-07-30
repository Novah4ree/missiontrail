import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import {
  claimMissionReward,
  flushGpsQueue,
  getCachedVerifiedDailyProgress,
  getVerifiedDailyProgress,
  subscribeToVerifiedProgress,
  syncDeviceSteps,
  syncUserTimezone,
  VerifiedProgressError,
} from '@/services/verified-distance';
import { getUserDailyStorageKey } from '@/services/mission-cache-core';
import {
  loadActiveTrailActivity,
  subscribeToActiveTrailActivity,
} from '@/services/trail-activity-service';
import type { VerifiedDailyProgress } from '@/types/daily-progress';
import type { ActiveTrailActivity } from '@/types/trails';
import {
  clampDailySteps,
  estimateActiveCalories,
  getLocalDateKey,
  metersToMiles,
  reconcilePersistedSteps,
  selectDailyDistance,
  startOfLocalDay,
  type ActivityDistanceSource,
} from '@/utils/daily-activity-core';
import { useAuth } from '../../context/auth';
import { LevelUpCelebration } from '@/components/level-up-celebration';
import { getPlayerLevelProgress } from '@/utils/player-level';
import {
  isActiveTrailCurrent,
  isWithinMissionStepRange,
} from '@/utils/trail-proximity';

type SensorAvailability = 'checking' | 'available' | 'unavailable';
type ActivityPermissionStatus = 'undetermined' | 'granted' | 'denied';
type PedometerModule = typeof import('expo-sensors/build/Pedometer');
type PedometerSubscription = ReturnType<PedometerModule['watchStepCount']>;

type DailyActivityValue = {
  todaySteps: number;
  missionEligibleSteps: number;
  todayDistanceMeters: number;
  todayDistanceMiles: number;
  activeCaloriesBurned: number;
  distanceSource: ActivityDistanceSource;
  lastUpdatedAt: string | null;
  sensorAvailability: SensorAvailability;
  permissionStatus: ActivityPermissionStatus;
  isTracking: boolean;
  trackingError: string | null;
  refreshActivity: () => Promise<void>;
};

type DailyProgressValue = {
  progress: VerifiedDailyProgress | null;
  isLoading: boolean;
  message: string | null;
  isUsingCachedProgress: boolean;
  walkingWarnings: {
    distance: string | null;
    steps: string | null;
  };
  refresh: () => Promise<void>;
  claimReward: (missionId: string) => Promise<void>;
};

type ActivityProgressContextValue = {
  activity: DailyActivityValue;
  dailyProgress: DailyProgressValue;
};

type DailyStepRecord = {
  userId: string;
  localDate: string;
  steps: number;
  lastUpdatedAt: string;
};

const STORAGE_PREFIX = 'mission-trail:daily-activity:v1';
const MISSION_STEP_STORAGE_PREFIX = 'mission-trail:destination-steps:v1';
const ActivityProgressContext = createContext<ActivityProgressContextValue | null>(null);
let pedometerModulePromise: Promise<PedometerModule | null> | null = null;

/**
 * Loads the native pedometer only when step tracking starts.
 *
 * A development client can temporarily be older than the JavaScript bundle and
 * not contain ExponentPedometer. Returning null lets every route keep rendering
 * while the activity card explains that step tracking is unavailable.
 */
function loadPedometerModule() {
  pedometerModulePromise ??= import('expo-sensors/build/Pedometer')
    .then((loadedModule) => {
      // Metro can wrap a dynamically imported CommonJS module in `default`.
      // Normalize both shapes before the provider calls the sensor API.
      const moduleEnvelope = loadedModule as PedometerModule & {
        default?: PedometerModule;
        Pedometer?: PedometerModule;
      };
      const candidate = typeof moduleEnvelope.isAvailableAsync === 'function'
        ? moduleEnvelope
        : moduleEnvelope.default ?? moduleEnvelope.Pedometer ?? null;
      return candidate && typeof candidate.isAvailableAsync === 'function'
        ? candidate
        : null;
    })
    .catch((error) => {
      if (__DEV__) {
        console.warn(
          '[Daily activity] This development build does not include ExponentPedometer.',
          error,
        );
      }
      return null;
    });
  return pedometerModulePromise;
}

function dailyStepStorageKey(userId: string, localDate: string) {
  return getUserDailyStorageKey(STORAGE_PREFIX, userId, localDate);
}

async function loadDailySteps(userId: string, localDate: string) {
  const value = await AsyncStorage.getItem(dailyStepStorageKey(userId, localDate));
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DailyStepRecord>;
    if (parsed.userId !== userId || parsed.localDate !== localDate) return null;
    return {
      userId,
      localDate,
      steps: reconcilePersistedSteps(parsed, userId, localDate),
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    } satisfies DailyStepRecord;
  } catch {
    return null;
  }
}

function missionStepStorageKey(userId: string, localDate: string) {
  return getUserDailyStorageKey(MISSION_STEP_STORAGE_PREFIX, userId, localDate);
}

async function loadMissionEligibleSteps(userId: string, localDate: string) {
  const value = await AsyncStorage.getItem(missionStepStorageKey(userId, localDate));
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value) as Partial<DailyStepRecord>;
    return reconcilePersistedSteps(parsed, userId, localDate);
  } catch {
    return 0;
  }
}

export function ActivityProgressProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [progress, setProgress] = useState<VerifiedDailyProgress | null>(null);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [isUsingCachedProgress, setIsUsingCachedProgress] = useState(false);
  const [distanceWarning, setDistanceWarning] = useState<string | null>(null);
  const [stepWarning, setStepWarning] = useState<string | null>(null);
  const [destinationStepWarning, setDestinationStepWarning] = useState<string | null>(null);
  const [todaySteps, setTodaySteps] = useState(0);
  const [missionEligibleSteps, setMissionEligibleSteps] = useState(0);
  const [activeTrailActivity, setActiveTrailActivity] = useState<ActiveTrailActivity | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [sensorAvailability, setSensorAvailability] = useState<SensorAvailability>('checking');
  const [permissionStatus, setPermissionStatus] = useState<ActivityPermissionStatus>('undetermined');
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const pedometerSubscriptionRef = useRef<PedometerSubscription | null>(null);
  const activeTrailRef = useRef<ActiveTrailActivity | null>(null);
  const isNearDestinationRef = useRef(false);
  const missionEligibleStepsRef = useRef(0);
  const activeDateRef = useRef(getLocalDateKey());
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const previousLevelRef = useRef<number | null>(null);
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);

  const saveDailySteps = useCallback((
    recordUserId: string,
    localDate: string,
    steps: number,
    updatedAt: string,
  ) => {
    const record: DailyStepRecord = {
      userId: recordUserId,
      localDate,
      steps: clampDailySteps(steps),
      lastUpdatedAt: updatedAt,
    };
    persistenceQueueRef.current = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(
        dailyStepStorageKey(recordUserId, localDate),
        JSON.stringify(record),
      ));
    return persistenceQueueRef.current;
  }, []);

  const saveMissionEligibleSteps = useCallback((
    recordUserId: string,
    localDate: string,
    steps: number,
    updatedAt: string,
  ) => {
    const record: DailyStepRecord = {
      userId: recordUserId,
      localDate,
      steps: clampDailySteps(steps),
      lastUpdatedAt: updatedAt,
    };
    persistenceQueueRef.current = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(
        missionStepStorageKey(recordUserId, localDate),
        JSON.stringify(record),
      ));
    return persistenceQueueRef.current;
  }, []);

  const refreshProgress = useCallback(async () => {
    if (!userId) {
      setProgress(null);
      setProgressMessage(null);
      setIsUsingCachedProgress(false);
      setDistanceWarning(null);
      setStepWarning(null);
      setIsProgressLoading(false);
      return;
    }
    setIsProgressLoading(true);
    let restoredProgress: VerifiedDailyProgress | null = null;
    try {
      restoredProgress = await getCachedVerifiedDailyProgress(userId);
      if (restoredProgress?.localDate === getLocalDateKey()) {
        setProgress(restoredProgress);
        setIsUsingCachedProgress(true);
      } else {
        restoredProgress = null;
      }

      // Timezone hints improve the server's local-day selection, but a failure
      // here must not prevent configured missions from loading.
      await syncUserTimezone(userId).catch((error) => {
        if (__DEV__) console.warn('[Mission refresh] Timezone sync failed.', error);
      });

      const freshProgress = await getVerifiedDailyProgress(userId);
      setProgress(freshProgress);
      setProgressMessage(null);
      setIsUsingCachedProgress(false);
    } catch (error) {
      if (__DEV__) console.warn('[Mission refresh] Mission query failed.', error);
      setProgressMessage(error instanceof VerifiedProgressError
        ? 'Missions could not be loaded. Check your connection and try again.'
        : 'Missions could not be loaded. Please try again.');
      if (!restoredProgress) setProgress(null);
      setIsUsingCachedProgress(Boolean(restoredProgress));
    } finally {
      setIsProgressLoading(false);
    }
  }, [userId]);

  const restartPedometer = useCallback(async () => {
    pedometerSubscriptionRef.current?.remove();
    pedometerSubscriptionRef.current = null;
    setIsTracking(false);

    if (!userId) {
      setTodaySteps(0);
      setMissionEligibleSteps(0);
      missionEligibleStepsRef.current = 0;
      setLastUpdatedAt(null);
      setSensorAvailability('unavailable');
      setPermissionStatus('undetermined');
      setTrackingError(null);
      return;
    }

    const localDate = getLocalDateKey();
    activeDateRef.current = localDate;
    setSensorAvailability('checking');
    setTrackingError(null);

    try {
      const [saved, savedMissionSteps, activeTrail] = await Promise.all([
        loadDailySteps(userId, localDate),
        loadMissionEligibleSteps(userId, localDate),
        loadActiveTrailActivity(),
      ]);
      activeTrailRef.current = isActiveTrailCurrent(activeTrail) ? activeTrail : null;
      missionEligibleStepsRef.current = savedMissionSteps;
      setMissionEligibleSteps(savedMissionSteps);
      const Pedometer = await loadPedometerModule();
      if (!Pedometer) {
        setTodaySteps(saved?.steps ?? 0);
        setLastUpdatedAt(saved?.lastUpdatedAt ?? null);
        setSensorAvailability('unavailable');
        setTrackingError('Step tracking is unavailable on this device.');
        return;
      }
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setTodaySteps(saved?.steps ?? 0);
        setLastUpdatedAt(saved?.lastUpdatedAt ?? null);
        setSensorAvailability('unavailable');
        setTrackingError('Step tracking is unavailable on this device.');
        return;
      }
      setSensorAvailability('available');

      let permission = await Pedometer.getPermissionsAsync();
      if (permission.status === 'undetermined' && permission.canAskAgain) {
        permission = await Pedometer.requestPermissionsAsync();
      }
      if (!permission.granted) {
        setPermissionStatus(permission.status === 'undetermined' ? 'undetermined' : 'denied');
        setTodaySteps(saved?.steps ?? 0);
        setLastUpdatedAt(saved?.lastUpdatedAt ?? null);
        setTrackingError('Motion permission is needed to count your steps.');
        return;
      }
      setPermissionStatus('granted');

      let sessionBaseSteps = saved?.steps ?? 0;
      if (Platform.OS === 'ios') {
        const result = await Pedometer.getStepCountAsync(startOfLocalDay(), new Date());
        sessionBaseSteps = clampDailySteps(result.steps);
      }

      const startedAt = new Date().toISOString();
      const eligibleBase = activeTrailRef.current
        ? savedMissionSteps
        : Math.max(savedMissionSteps, sessionBaseSteps);
      setTodaySteps(sessionBaseSteps);
      setMissionEligibleSteps(eligibleBase);
      missionEligibleStepsRef.current = eligibleBase;
      setLastUpdatedAt(startedAt);
      await Promise.all([
        saveDailySteps(userId, localDate, sessionBaseSteps, startedAt),
        saveMissionEligibleSteps(userId, localDate, eligibleBase, startedAt),
      ]);

      let previousSessionSteps = 0;
      pedometerSubscriptionRef.current = Pedometer.watchStepCount((result) => {
        if (activeDateRef.current !== getLocalDateKey()) return;
        const sessionSteps = Math.max(0, result.steps);
        const stepDelta = Math.max(0, sessionSteps - previousSessionSteps);
        previousSessionSteps = sessionSteps;
        const nextSteps = clampDailySteps(sessionBaseSteps + sessionSteps);
        const updatedAt = new Date().toISOString();
        setTodaySteps(nextSteps);
        setLastUpdatedAt(updatedAt);
        void saveDailySteps(userId, localDate, nextSteps, updatedAt);

        const activeNavigation = isActiveTrailCurrent(activeTrailRef.current);
        if (!activeNavigation || isNearDestinationRef.current) {
          const nextMissionSteps = clampDailySteps(
            missionEligibleStepsRef.current + stepDelta,
          );
          missionEligibleStepsRef.current = nextMissionSteps;
          setMissionEligibleSteps(nextMissionSteps);
          void saveMissionEligibleSteps(userId, localDate, nextMissionSteps, updatedAt);
        }
      });
      setIsTracking(true);
    } catch (error) {
      if (__DEV__) console.warn('[Daily activity] Pedometer could not start.', error);
      setSensorAvailability('unavailable');
      setTrackingError('Step tracking could not start. Pull to refresh and try again.');
    }
  }, [saveDailySteps, saveMissionEligibleSteps, userId]);

  const refreshActivity = useCallback(async () => {
    await restartPedometer();
    if (!userId) return;
    try {
      const queuedProgress = await flushGpsQueue(userId);
      if (queuedProgress) setProgress(queuedProgress);
      setDistanceWarning(null);
    } catch (error) {
      if (__DEV__) console.warn('[Daily activity] Queued GPS sync failed.', error);
      setDistanceWarning(error instanceof VerifiedProgressError
        ? 'Walking activity couldn’t update.'
        : 'Walking activity couldn’t update. Try again shortly.');
    }
  }, [restartPedometer, userId]);

  const claimReward = useCallback(async (missionId: string) => {
    setIsProgressLoading(true);
    try {
      if (!userId) throw new VerifiedProgressError('UNAUTHORIZED', 'Please sign in again.');
      const result = await claimMissionReward(userId, missionId);
      setProgress(result.progress);
      setProgressMessage(null);
    } catch (error) {
      setProgressMessage(error instanceof VerifiedProgressError
        ? error.message
        : 'That reward is not ready to claim yet.');
    } finally {
      setIsProgressLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    void loadActiveTrailActivity().then((activity) => {
      if (active) setActiveTrailActivity(isActiveTrailCurrent(activity) ? activity : null);
    });
    const unsubscribe = subscribeToActiveTrailActivity((activity) => {
      setActiveTrailActivity(isActiveTrailCurrent(activity) ? activity : null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    activeTrailRef.current = activeTrailActivity;
    isNearDestinationRef.current = false;
    if (!activeTrailActivity) {
      setDestinationStepWarning(null);
      return;
    }

    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    const destination = {
      latitude: activeTrailActivity.trail.latitude,
      longitude: activeTrailActivity.trail.longitude,
    };
    const updateProximity = (location: Location.LocationObject) => {
      if (!active) return;
      const isNear = isWithinMissionStepRange(location.coords, destination);
      isNearDestinationRef.current = isNear;
      setDestinationStepWarning(isNear
        ? null
        : `Mission steps are paused until you are within 0.31 mi of ${activeTrailActivity.trail.name}.`);
    };

    async function watchDestinationProximity() {
      try {
        const [servicesEnabled, permission] = await Promise.all([
          Location.hasServicesEnabledAsync(),
          Location.getForegroundPermissionsAsync(),
        ]);
        if (!active) return;
        if (!servicesEnabled || permission.status !== Location.PermissionStatus.GRANTED) {
          setDestinationStepWarning(
            'Mission steps are paused until location is enabled near the trail destination.',
          );
          return;
        }
        const firstLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        updateProximity(firstLocation);
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 3_000,
          },
          updateProximity,
        );
        if (!active) subscription.remove();
      } catch (locationError) {
        if (__DEV__) console.warn('[Mission steps] Destination proximity unavailable.', locationError);
        if (active) {
          setDestinationStepWarning(
            'Mission steps are paused until your destination distance can be verified.',
          );
        }
      }
    }

    void watchDestinationProximity();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [activeTrailActivity]);

  useEffect(() => subscribeToVerifiedProgress(setProgress), []);

  useEffect(() => {
    void Promise.all([refreshProgress(), refreshActivity()]);
    return () => {
      pedometerSubscriptionRef.current?.remove();
      pedometerSubscriptionRef.current = null;
    };
  }, [refreshActivity, refreshProgress]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void Promise.all([refreshProgress(), refreshActivity()]);
    });
    const dateTimer = setInterval(() => {
      if (activeDateRef.current !== getLocalDateKey()) {
        void Promise.all([refreshProgress(), refreshActivity()]);
      }
    }, 60_000);
    return () => {
      appStateSubscription.remove();
      clearInterval(dateTimer);
    };
  }, [refreshActivity, refreshProgress]);

  useEffect(() => {
    if (!userId || permissionStatus !== 'granted') return;
    const localDate = getLocalDateKey();
    const syncTimer = setTimeout(() => {
      void syncDeviceSteps(userId, localDate, missionEligibleSteps)
        .then((syncedProgress) => {
          setProgress(syncedProgress);
          setStepWarning(null);
        })
        .catch((error) => {
          if (__DEV__) console.warn('[Daily activity] Step sync will retry later.', error);
          setStepWarning('Step progress could not update. Your saved missions are still available.');
        });
    }, 1_500);
    return () => clearTimeout(syncTimer);
  }, [missionEligibleSteps, permissionStatus, userId]);

  useEffect(() => {
    if (!progress || !Number.isFinite(progress.totalXp)) return;
    const nextLevel = getPlayerLevelProgress(progress.totalXp).level;
    const previousLevel = previousLevelRef.current;
    if (previousLevel !== null && nextLevel > previousLevel) {
      setLevelUp({ fromLevel: previousLevel, toLevel: nextLevel });
    }
    previousLevelRef.current = nextLevel;
  }, [progress]);

  useEffect(() => {
    previousLevelRef.current = null;
    setLevelUp(null);
  }, [userId]);

  const verifiedDistanceMeters = progress?.localDate === getLocalDateKey()
    ? progress.verifiedDistanceMeters
    : 0;
  const distance = selectDailyDistance(verifiedDistanceMeters, todaySteps);
  const activity = useMemo<DailyActivityValue>(() => ({
    todaySteps,
    missionEligibleSteps,
    todayDistanceMeters: distance.meters,
    todayDistanceMiles: metersToMiles(distance.meters),
    activeCaloriesBurned: estimateActiveCalories(distance.meters),
    distanceSource: distance.source,
    lastUpdatedAt,
    sensorAvailability,
    permissionStatus,
    isTracking,
    trackingError,
    refreshActivity,
  }), [
    distance.meters,
    distance.source,
    isTracking,
    lastUpdatedAt,
    missionEligibleSteps,
    permissionStatus,
    refreshActivity,
    sensorAvailability,
    todaySteps,
    trackingError,
  ]);

  const value = useMemo<ActivityProgressContextValue>(() => ({
    activity,
    dailyProgress: {
      progress,
      isLoading: isProgressLoading,
      message: progressMessage,
      isUsingCachedProgress,
      walkingWarnings: {
        distance: distanceWarning,
        steps: destinationStepWarning ?? stepWarning,
      },
      refresh: refreshProgress,
      claimReward,
    },
  }), [
    activity,
    claimReward,
    isProgressLoading,
    isUsingCachedProgress,
    progress,
    progressMessage,
    refreshProgress,
    distanceWarning,
    destinationStepWarning,
    stepWarning,
  ]);

  return (
    <ActivityProgressContext.Provider value={value}>
      {children}
      {levelUp ? (
        <LevelUpCelebration
          fromLevel={levelUp.fromLevel}
          toLevel={levelUp.toLevel}
          onClose={() => setLevelUp(null)}
        />
      ) : null}
    </ActivityProgressContext.Provider>
  );
}

function useActivityProgressContext() {
  const context = useContext(ActivityProgressContext);
  if (!context) throw new Error('ActivityProgressProvider is missing from the app layout.');
  return context;
}

export function useSharedDailyProgress() {
  return useActivityProgressContext().dailyProgress;
}

export function useDailyActivity() {
  return useActivityProgressContext().activity;
}
