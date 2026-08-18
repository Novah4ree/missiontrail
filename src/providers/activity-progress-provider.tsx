import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { LevelUpCelebration } from "@/components/level-up-celebration";
import { getUserDailyStorageKey } from "@/services/mission-cache-core";
import {
  loadActiveTrailActivity,
  subscribeToActiveTrailActivity,
} from "@/services/trail-activity-service";
import {
  claimMissionReward,
  flushGpsQueue,
  getCachedVerifiedDailyProgress,
  subscribeToVerifiedProgress,
  syncDeviceSteps,
  syncUserTimezone,
  VerifiedProgressError,
} from "@/services/verified-distance";
import type { VerifiedDailyProgress } from "@/types/daily-progress";
import type { ActiveTrailActivity } from "@/types/trails";
import {
  clampDailySteps,
  estimateActiveCalories,
  getLocalDateKey,
  metersToMiles,
  reconcilePersistedSteps,
  selectDailyDistance,
  type ActivityDistanceSource,
} from "@/utils/daily-activity-core";
import { getPlayerLevelProgress } from "@/utils/player-level";
import {
  isActiveTrailCurrent,
  isWithinMissionStepRange,
} from "@/utils/trail-proximity";
import { useAuth } from "../../context/auth";

type SensorAvailability = "checking" | "available" | "unavailable";
type ActivityPermissionStatus = "undetermined" | "granted" | "denied";
type PedometerModule = typeof import("expo-sensors/build/Pedometer");
type PedometerSubscription = ReturnType<PedometerModule["watchStepCount"]>;

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

const STORAGE_PREFIX = "mission-trail:daily-activity:v1";
const MISSION_STEP_STORAGE_PREFIX = "mission-trail:destination-steps:v1";
const ActivityProgressContext =
  createContext<ActivityProgressContextValue | null>(null);
let pedometerModulePromise: Promise<PedometerModule | null> | null = null;
const STEP_SYNC_INTERVAL_MS = 30_000;
const STEP_SYNC_RETRY_BASE_MS = 30_000;
const STEP_SYNC_RATE_LIMIT_RETRY_MS = 60_000;
const STEP_SYNC_MAX_RETRY_MS = 5 * 60_000;
const PROGRESS_REFRESH_INTERVAL_MS = 30_000;
const PROGRESS_REFRESH_RATE_LIMIT_RETRY_MS = 60_000;
const PROGRESS_REFRESH_MAX_RETRY_MS = 5 * 60_000;

/**
 * Loads the native pedometer only when step tracking starts.
 *
 * A development client can temporarily be older than the JavaScript bundle and
 * not contain ExponentPedometer. Returning null lets every route keep rendering
 * while the activity card explains that step tracking is unavailable.
 */
// Purpose: Loads pedometer module.
function loadPedometerModule() {
  pedometerModulePromise ??= import("expo-sensors/build/Pedometer")
    .then((loadedModule) => {
      // Metro can wrap a dynamically imported CommonJS module in `default`.
      // Normalize both shapes before the provider calls the sensor API.
      const moduleEnvelope = loadedModule as PedometerModule & {
        default?: PedometerModule;
        Pedometer?: PedometerModule;
      };
      const candidate =
        typeof moduleEnvelope.isAvailableAsync === "function"
          ? moduleEnvelope
          : (moduleEnvelope.default ?? moduleEnvelope.Pedometer ?? null);
      return candidate && typeof candidate.isAvailableAsync === "function"
        ? candidate
        : null;
    })
    .catch((error) => {
      if (__DEV__) {
        console.warn(
          "[Daily activity] This development build does not include ExponentPedometer.",
          error,
        );
      }
      return null;
    });
  return pedometerModulePromise;
}

// Purpose: Implements the daily step storage key operation.
function dailyStepStorageKey(userId: string, localDate: string) {
  return getUserDailyStorageKey(STORAGE_PREFIX, userId, localDate);
}

// Purpose: Loads daily steps.
async function loadDailySteps(userId: string, localDate: string) {
  const value = await AsyncStorage.getItem(
    dailyStepStorageKey(userId, localDate),
  );
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

// Purpose: Implements the mission step storage key operation.
function missionStepStorageKey(userId: string, localDate: string) {
  return getUserDailyStorageKey(MISSION_STEP_STORAGE_PREFIX, userId, localDate);
}

// Purpose: Loads mission eligible steps.
async function loadMissionEligibleSteps(userId: string, localDate: string) {
  const value = await AsyncStorage.getItem(
    missionStepStorageKey(userId, localDate),
  );
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value) as Partial<DailyStepRecord>;
    return reconcilePersistedSteps(parsed, userId, localDate);
  } catch {
    return 0;
  }
}

// Purpose: Renders the activity progress provider interface.
export function ActivityProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [progress, setProgress] = useState<VerifiedDailyProgress | null>(null);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [isUsingCachedProgress, setIsUsingCachedProgress] = useState(false);
  const [distanceWarning, setDistanceWarning] = useState<string | null>(null);
  const [stepWarning, setStepWarning] = useState<string | null>(null);
  const [destinationStepWarning, setDestinationStepWarning] = useState<
    string | null
  >(null);
  const [todaySteps, setTodaySteps] = useState(0);
  const [missionEligibleSteps, setMissionEligibleSteps] = useState(0);
  const [activeTrailActivity, setActiveTrailActivity] =
    useState<ActiveTrailActivity | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [sensorAvailability, setSensorAvailability] =
    useState<SensorAvailability>("checking");
  const [permissionStatus, setPermissionStatus] =
    useState<ActivityPermissionStatus>("undetermined");
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const pedometerSubscriptionRef = useRef<PedometerSubscription | null>(null);
  const activeTrailRef = useRef<ActiveTrailActivity | null>(null);
  const isNearDestinationRef = useRef(false);
  const missionEligibleStepsRef = useRef(0);
  const activeDateRef = useRef(getLocalDateKey());
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const progressRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const progressRefreshUserIdRef = useRef<string | null>(null);
  const lastProgressRefreshAttemptAtRef = useRef(0);
  const progressRefreshRetryNotBeforeRef = useRef(0);
  const progressRefreshFailureCountRef = useRef(0);
  const activityRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const activityRefreshUserIdRef = useRef<string | null>(null);
  const stepSyncInFlightRef = useRef<Promise<void> | null>(null);
  const stepSyncKeyRef = useRef<string | null>(null);
  const lastSyncedStepsRef = useRef(0);
  const lastStepSyncAttemptAtRef = useRef(0);
  const stepSyncRetryNotBeforeRef = useRef(0);
  const stepSyncFailureCountRef = useRef(0);
  const [stepSyncScheduleVersion, setStepSyncScheduleVersion] = useState(0);
  const currentUserIdRef = useRef(userId);
  currentUserIdRef.current = userId;
  const previousLevelRef = useRef<number | null>(null);
  const [levelUp, setLevelUp] = useState<{
    fromLevel: number;
    toLevel: number;
  } | null>(null);

  // Purpose: Saves daily steps.
  const saveDailySteps = useCallback(
    (
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
        .then(() =>
          AsyncStorage.setItem(
            dailyStepStorageKey(recordUserId, localDate),
            JSON.stringify(record),
          ),
        );
      return persistenceQueueRef.current;
    },
    [],
  );

  // Purpose: Saves mission eligible steps.
  const saveMissionEligibleSteps = useCallback(
    (
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
        .then(() =>
          AsyncStorage.setItem(
            missionStepStorageKey(recordUserId, localDate),
            JSON.stringify(record),
          ),
        );
      return persistenceQueueRef.current;
    },
    [],
  );

  // Purpose: Implements the refresh progress operation.
  const refreshProgress = useCallback(() => {
    if (!userId) {
      setProgress(null);
      setProgressMessage(null);
      setIsUsingCachedProgress(false);
      setDistanceWarning(null);
      setStepWarning(null);
      setIsProgressLoading(false);
      return Promise.resolve();
    }

    if (
      progressRefreshInFlightRef.current &&
      progressRefreshUserIdRef.current === userId
    ) {
      if (__DEV__) console.log("[PROGRESS REFRESH] deduplicated");
      return progressRefreshInFlightRef.current;
    }
    if (progressRefreshUserIdRef.current !== userId) {
      lastProgressRefreshAttemptAtRef.current = 0;
      progressRefreshRetryNotBeforeRef.current = 0;
      progressRefreshFailureCountRef.current = 0;
    }
    const now = Date.now();
    const nextAllowedAt = Math.max(
      lastProgressRefreshAttemptAtRef.current + PROGRESS_REFRESH_INTERVAL_MS,
      progressRefreshRetryNotBeforeRef.current,
    );
    if (now < nextAllowedAt) {
      if (__DEV__) {
        console.log("[PROGRESS REFRESH] deduplicated", {
          retryInMs: nextAllowedAt - now,
        });
      }
      return Promise.resolve();
    }
    lastProgressRefreshAttemptAtRef.current = now;

    setIsProgressLoading(true);
    const request = (async () => {
      let restoredProgress: VerifiedDailyProgress | null = null;
      try {
        restoredProgress = await getCachedVerifiedDailyProgress(userId);
        if (currentUserIdRef.current !== userId) return;
        if (restoredProgress?.localDate === getLocalDateKey()) {
          setProgress(restoredProgress);
          setIsUsingCachedProgress(true);
        } else {
          restoredProgress = null;
        }

        // Setting the timezone already returns the complete daily progress.
        // Reuse it instead of spending a second rate-limited request on `get`.
        const freshProgress = await syncUserTimezone(userId);
        if (currentUserIdRef.current !== userId) return;
        setProgress(freshProgress);
        setProgressMessage(null);
        setIsUsingCachedProgress(false);
        progressRefreshFailureCountRef.current = 0;
        progressRefreshRetryNotBeforeRef.current = 0;
      } catch (error) {
        if (currentUserIdRef.current !== userId) return;
        progressRefreshFailureCountRef.current += 1;
        const retryBase =
          error instanceof VerifiedProgressError &&
          error.code === "RATE_LIMITED"
            ? PROGRESS_REFRESH_RATE_LIMIT_RETRY_MS
            : PROGRESS_REFRESH_INTERVAL_MS;
        const retryDelay = Math.min(
          retryBase * 2 ** (progressRefreshFailureCountRef.current - 1),
          PROGRESS_REFRESH_MAX_RETRY_MS,
        );
        progressRefreshRetryNotBeforeRef.current = Date.now() + retryDelay;
        if (__DEV__)
          console.warn("[Mission refresh] Mission query failed.", error);
        setProgressMessage(
          error instanceof VerifiedProgressError
            ? "Missions could not be loaded. Check your connection and try again."
            : "Missions could not be loaded. Please try again.",
        );
        if (!restoredProgress) setProgress(null);
        setIsUsingCachedProgress(Boolean(restoredProgress));
      } finally {
        if (currentUserIdRef.current === userId) {
          setIsProgressLoading(false);
        }
      }
    })().finally(() => {
      if (progressRefreshInFlightRef.current === request) {
        progressRefreshInFlightRef.current = null;
      }
    });
    progressRefreshInFlightRef.current = request;
    progressRefreshUserIdRef.current = userId;
    return request;
  }, [userId]);

  // Purpose: Implements the restart pedometer operation.
  const restartPedometer = useCallback(async () => {
    pedometerSubscriptionRef.current?.remove();
    pedometerSubscriptionRef.current = null;
    setIsTracking(false);

    if (!userId) {
      setTodaySteps(0);
      setMissionEligibleSteps(0);
      missionEligibleStepsRef.current = 0;
      setLastUpdatedAt(null);
      setSensorAvailability("unavailable");
      setPermissionStatus("undetermined");
      setTrackingError(null);
      return;
    }

    const localDate = getLocalDateKey();
    activeDateRef.current = localDate;
    setSensorAvailability("checking");
    setTrackingError(null);

    try {
      const [saved, savedMissionSteps, activeTrail] = await Promise.all([
        loadDailySteps(userId, localDate),
        loadMissionEligibleSteps(userId, localDate),
        loadActiveTrailActivity(),
      ]);
      activeTrailRef.current = isActiveTrailCurrent(activeTrail)
        ? activeTrail
        : null;
      missionEligibleStepsRef.current = savedMissionSteps;
      setMissionEligibleSteps(savedMissionSteps);
      const Pedometer = await loadPedometerModule();
      if (!Pedometer) {
        setTodaySteps(saved?.steps ?? 0);
        setLastUpdatedAt(saved?.lastUpdatedAt ?? null);
        setSensorAvailability("unavailable");
        setTrackingError("Step tracking is unavailable on this device.");
        return;
      }
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setTodaySteps(saved?.steps ?? 0);
        setLastUpdatedAt(saved?.lastUpdatedAt ?? null);
        setSensorAvailability("unavailable");
        setTrackingError("Step tracking is unavailable on this device.");
        return;
      }
      setSensorAvailability("available");

      let permission = await Pedometer.getPermissionsAsync();
      if (permission.status === "undetermined" && permission.canAskAgain) {
        permission = await Pedometer.requestPermissionsAsync();
      }
      if (!permission.granted) {
        setPermissionStatus(
          permission.status === "undetermined" ? "undetermined" : "denied",
        );
        setTodaySteps(saved?.steps ?? 0);
        setLastUpdatedAt(saved?.lastUpdatedAt ?? null);
        setTrackingError("Motion permission is needed to count your steps.");
        return;
      }
      setPermissionStatus("granted");

      // Mission Trails only continues from activity already recorded
      // by Mission Trails. Do not import all iPhone steps since midnight.
      const sessionBaseSteps = saved?.steps ?? 0;

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
          void saveMissionEligibleSteps(
            userId,
            localDate,
            nextMissionSteps,
            updatedAt,
          );
        }
      });
      setIsTracking(true);
    } catch (error) {
      if (__DEV__)
        console.warn("[Daily activity] Pedometer could not start.", error);
      setSensorAvailability("unavailable");
      setTrackingError(
        "Step tracking could not start. Pull to refresh and try again.",
      );
    }
  }, [saveDailySteps, saveMissionEligibleSteps, userId]);

  // Purpose: Implements the refresh activity operation.
  const refreshActivity = useCallback(() => {
    if (
      activityRefreshInFlightRef.current &&
      activityRefreshUserIdRef.current === userId
    ) {
      if (__DEV__) console.log("[ACTIVITY REFRESH] deduplicated");
      return activityRefreshInFlightRef.current;
    }

    const request = (async () => {
      await restartPedometer();
      if (!userId) return;
      try {
        const queuedProgress = await flushGpsQueue(userId);
        if (currentUserIdRef.current !== userId) return;
        if (queuedProgress) setProgress(queuedProgress);
        setDistanceWarning(null);
      } catch (error) {
        if (currentUserIdRef.current !== userId) return;
        if (__DEV__)
          console.warn("[Daily activity] Queued GPS sync failed.", error);
        setDistanceWarning(
          error instanceof VerifiedProgressError
            ? "Walking activity couldn’t update."
            : "Walking activity couldn’t update. Try again shortly.",
        );
      }
    })().finally(() => {
      if (activityRefreshInFlightRef.current === request) {
        activityRefreshInFlightRef.current = null;
        activityRefreshUserIdRef.current = null;
      }
    });
    activityRefreshInFlightRef.current = request;
    activityRefreshUserIdRef.current = userId;
    return request;
  }, [restartPedometer, userId]);

  // Purpose: Implements the claim reward operation.
  const claimReward = useCallback(
    async (missionId: string) => {
      setIsProgressLoading(true);
      try {
        if (!userId)
          throw new VerifiedProgressError(
            "UNAUTHORIZED",
            "Please sign in again.",
          );
        const result = await claimMissionReward(userId, missionId);
        setProgress(result.progress);
        setProgressMessage(null);
      } catch (error) {
        setProgressMessage(
          error instanceof VerifiedProgressError
            ? error.message
            : "That reward is not ready to claim yet.",
        );
      } finally {
        setIsProgressLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    let active = true;
    void loadActiveTrailActivity().then((activity) => {
      if (active)
        setActiveTrailActivity(
          isActiveTrailCurrent(activity) ? activity : null,
        );
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
    // Purpose: Updates proximity.
    const updateProximity = (location: Location.LocationObject) => {
      if (!active) return;
      const isNear = isWithinMissionStepRange(location.coords, destination);
      isNearDestinationRef.current = isNear;
      setDestinationStepWarning(
        isNear
          ? null
          : `Mission steps are paused until you are within 0.31 mi of ${activeTrailActivity.trail.name}.`,
      );
    };

    // Purpose: Implements the watch destination proximity operation.
    async function watchDestinationProximity() {
      try {
        const [servicesEnabled, permission] = await Promise.all([
          Location.hasServicesEnabledAsync(),
          Location.getForegroundPermissionsAsync(),
        ]);
        if (!active) return;
        if (
          !servicesEnabled ||
          permission.status !== Location.PermissionStatus.GRANTED
        ) {
          setDestinationStepWarning(
            "Mission steps are paused until location is enabled near the trail destination.",
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
        if (__DEV__)
          console.warn(
            "[Mission steps] Destination proximity unavailable.",
            locationError,
          );
        if (active) {
          setDestinationStepWarning(
            "Mission steps are paused until your destination distance can be verified.",
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
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active")
          void Promise.all([refreshProgress(), refreshActivity()]);
      },
    );
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
    if (!userId) return;
    const localDate = getLocalDateKey();
    const syncKey = `${userId}:${localDate}`;
    if (stepSyncKeyRef.current !== syncKey) {
      stepSyncKeyRef.current = syncKey;
      lastSyncedStepsRef.current = 0;
      lastStepSyncAttemptAtRef.current = 0;
      stepSyncRetryNotBeforeRef.current = 0;
      stepSyncFailureCountRef.current = 0;
    }
    if (progress?.localDate === localDate) {
      lastSyncedStepsRef.current = Math.max(
        lastSyncedStepsRef.current,
        progress.verifiedSteps,
      );
    }
  }, [progress, userId]);

  useEffect(() => {
    if (!userId || permissionStatus !== "granted") return;
    const localDate = getLocalDateKey();
    const syncKey = `${userId}:${localDate}`;
    if (stepSyncKeyRef.current !== syncKey) {
      stepSyncKeyRef.current = syncKey;
      lastSyncedStepsRef.current =
        progress?.localDate === localDate ? progress.verifiedSteps : 0;
      lastStepSyncAttemptAtRef.current = 0;
      stepSyncRetryNotBeforeRef.current = 0;
      stepSyncFailureCountRef.current = 0;
    }

    let cancelled = false;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    // Purpose: Implements the schedule sync operation.
    const scheduleSync = () => {
      const pendingSteps = missionEligibleStepsRef.current;
      if (pendingSteps <= lastSyncedStepsRef.current) {
        if (__DEV__ && pendingSteps > 0) {
          console.log("[PROGRESS SYNC] skipped duplicate", {
            steps: pendingSteps,
          });
        }
        return;
      }

      const now = Date.now();
      const nextAllowedAt = Math.max(
        lastStepSyncAttemptAtRef.current + STEP_SYNC_INTERVAL_MS,
        stepSyncRetryNotBeforeRef.current,
      );
      syncTimer = setTimeout(() => {
        if (cancelled) return;
        if (stepSyncInFlightRef.current) {
          if (__DEV__) console.log("[PROGRESS SYNC] deduplicated");
          syncTimer = setTimeout(scheduleSync, 1_000);
          return;
        }

        const stepsToSync = missionEligibleStepsRef.current;
        if (stepsToSync <= lastSyncedStepsRef.current) return;
        lastStepSyncAttemptAtRef.current = Date.now();
        if (__DEV__) {
          console.log("[PROGRESS SYNC] sending", { steps: stepsToSync });
        }

        const request = syncDeviceSteps(userId, localDate, stepsToSync)
          .then((syncedProgress) => {
            if (stepSyncKeyRef.current !== syncKey) return;
            lastSyncedStepsRef.current = Math.max(
              lastSyncedStepsRef.current,
              stepsToSync,
              syncedProgress.verifiedSteps,
            );
            stepSyncFailureCountRef.current = 0;
            stepSyncRetryNotBeforeRef.current = 0;
            if (!cancelled) {
              setProgress(syncedProgress);
              setStepWarning(null);
            }
            if (__DEV__) {
              console.log("[PROGRESS SYNC] success", {
                steps: syncedProgress.verifiedSteps,
              });
            }
          })
          .catch((error) => {
            if (stepSyncKeyRef.current !== syncKey) return;
            stepSyncFailureCountRef.current += 1;
            const baseDelay =
              error instanceof VerifiedProgressError &&
              error.code === "RATE_LIMITED"
                ? STEP_SYNC_RATE_LIMIT_RETRY_MS
                : STEP_SYNC_RETRY_BASE_MS;
            const retryDelay = Math.min(
              baseDelay * 2 ** (stepSyncFailureCountRef.current - 1),
              STEP_SYNC_MAX_RETRY_MS,
            );
            stepSyncRetryNotBeforeRef.current = Date.now() + retryDelay;
            if (__DEV__) {
              const errorCode =
                error instanceof VerifiedProgressError
                  ? error.code
                  : "SYNC_FAILED";
              console.warn(
                errorCode === "RATE_LIMITED"
                  ? "[PROGRESS SYNC] rate limited"
                  : "[PROGRESS SYNC] retry scheduled",
                {
                  code: errorCode,
                  retryInMs: retryDelay,
                  steps: stepsToSync,
                },
              );
            }
            if (!cancelled) {
              setStepWarning(
                "Step progress could not update. Your saved missions are still available.",
              );
            }
          })
          .finally(() => {
            if (stepSyncInFlightRef.current === request) {
              stepSyncInFlightRef.current = null;
            }
            if (!cancelled) {
              setStepSyncScheduleVersion((version) => version + 1);
            }
          });
        stepSyncInFlightRef.current = request;
      }, Math.max(0, nextAllowedAt - now));
    };

    scheduleSync();
    return () => {
      cancelled = true;
      if (syncTimer) clearTimeout(syncTimer);
    };
  }, [
    missionEligibleSteps,
    permissionStatus,
    progress?.localDate,
    progress?.verifiedSteps,
    stepSyncScheduleVersion,
    userId,
  ]);

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

  const verifiedDistanceMeters =
    progress?.localDate === getLocalDateKey()
      ? progress.verifiedDistanceMeters
      : 0;
  const distance = selectDailyDistance(verifiedDistanceMeters, todaySteps);
  const activity = useMemo<DailyActivityValue>(
    () => ({
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
    }),
    [
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
    ],
  );

  const value = useMemo<ActivityProgressContextValue>(
    () => ({
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
    }),
    [
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
    ],
  );

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

// Purpose: Provides the activity progress context React hook behavior.
function useActivityProgressContext() {
  const context = useContext(ActivityProgressContext);
  if (!context)
    throw new Error("ActivityProgressProvider is missing from the app layout.");
  return context;
}

// Purpose: Provides the shared daily progress React hook behavior.
export function useSharedDailyProgress() {
  return useActivityProgressContext().dailyProgress;
}

// Purpose: Provides the daily activity React hook behavior.
export function useDailyActivity() {
  return useActivityProgressContext().activity;
}
