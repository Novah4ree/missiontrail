import { MissionBottomTabBar } from '@/components/mission-bottom-tab-bar';
import {
  AdventureOverview,
  CompactMissionHeader,
  CompanionStatus,
  DailyMissionSection,
  ExploreAction,
  ExplorerLevel,
  MissionWeather,
  RelicUnlocks,
  type MissionCardModel,
} from '@/components/missions/mission-dashboard-sections';
import { METERS_PER_MILE } from '@/config/activity-rules';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useDailyActivity } from '@/providers/activity-progress-provider';
import { loadActiveTrailActivity } from '@/services/trail-activity-service';
import {
  getTrailDailyForecast,
  type TrailDailyForecast,
} from '@/services/weather-forecast-service';
import type { VerifiedMissionProgress } from '@/types/daily-progress';
import { getLiveMissionProgress } from '@/utils/daily-activity-core';
import { formatCompanionName, getEnergyPercent } from '@/utils/companion-progress';
import {
  clampProgress,
  getCompanionDashboardMessage,
  getMissionCollectionState,
  getMissionDisplayStatus,
  summarizeMissionDashboard,
} from '@/utils/mission-dashboard-core';
import { getPlayerLevelProgress } from '@/utils/player-level';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/auth';

const WEATHER_LOCATION_TIMEOUT_MS = 8_000;

// Purpose: Implements the valid weather coordinate operation.
function validWeatherCoordinate(location: Location.LocationObject | null) {
  if (!location) return null;
  const { latitude, longitude } = location.coords;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

// Purpose: Implements the current weather coordinate operation.
async function currentWeatherCoordinate() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), WEATHER_LOCATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Purpose: Implements the mission instruction operation.
function missionInstruction(mission: VerifiedMissionProgress) {
  switch (mission.requirementType) {
    case 'distance':
      return `Walk or run ${(mission.target / METERS_PER_MILE).toFixed(mission.target < METERS_PER_MILE ? 1 : 0)} miles on the Live Map`;
    case 'steps':
      return `Record ${Math.floor(mission.target).toLocaleString()} verified steps`;
    case 'relic':
      return `Discover ${Math.floor(mission.target)} ${mission.target === 1 ? 'relic' : 'relics'} on the map`;
    case 'location':
      return `Enter ${Math.floor(mission.target)} verified ${mission.target === 1 ? 'location' : 'locations'}`;
    case 'active_time':
      return `Explore on foot for ${Math.round(mission.target / 60)} minutes`;
    case 'session':
      return `Complete ${Math.floor(mission.target)} verified walking ${mission.target === 1 ? 'session' : 'sessions'}`;
    case 'daily_set':
      return 'Complete every required daily mission';
  }
}

// Purpose: Implements the mission icon operation.
function missionIcon(requirementType: VerifiedMissionProgress['requirementType']) {
  switch (requirementType) {
    case 'distance':
      return 'walk-outline' as const;
    case 'steps':
      return 'footsteps-outline' as const;
    case 'relic':
      return 'diamond-outline' as const;
    case 'location':
      return 'location-outline' as const;
    case 'active_time':
      return 'time-outline' as const;
    case 'session':
      return 'navigate-outline' as const;
    case 'daily_set':
      return 'checkmark-done-outline' as const;
  }
}

// Purpose: Implements the mission progress label operation.
function missionProgressLabel(
  requirementType: VerifiedMissionProgress['requirementType'],
  progress: number,
  target: number,
) {
  switch (requirementType) {
    case 'distance':
      return `${(progress / METERS_PER_MILE).toFixed(2)} / ${(target / METERS_PER_MILE).toFixed(2)} mi`;
    case 'steps':
      return `${Math.floor(progress).toLocaleString()} / ${Math.floor(target).toLocaleString()} steps`;
    case 'relic':
      return `${Math.floor(progress)} / ${Math.floor(target)} relics`;
    case 'location':
      return `${Math.floor(progress)} / ${Math.floor(target)} locations`;
    case 'active_time':
      return `${Math.floor(progress / 60)} / ${Math.round(target / 60)} min`;
    case 'session':
      return `${Math.floor(progress)} / ${Math.floor(target)} sessions`;
    case 'daily_set':
      return `${Math.floor(progress)} / ${Math.floor(target)} complete`;
  }
}

// Purpose: Renders the mission screen interface.
export default function MissionScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();
  const { session } = useAuth();
  const activity = useDailyActivity();
  const {
    progress,
    isLoading,
    message,
    isUsingCachedProgress,
    walkingWarnings,
    refresh,
    claimReward,
  } = useDailyProgress();
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [weather, setWeather] = useState<TrailDailyForecast | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const weatherRequestIdRef = useRef(0);
  const weatherAbortRef = useRef<AbortController | null>(null);

  // Purpose: Implements the refresh weather operation.
  const refreshWeather = useCallback(async () => {
    const requestId = ++weatherRequestIdRef.current;
    weatherAbortRef.current?.abort();
    const controller = new AbortController();
    weatherAbortRef.current = controller;
    setIsWeatherLoading(true);
    setWeatherError(null);

    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        throw new Error('Turn on Location Services to see today’s local weather.');
      }
      let permission = await Location.getForegroundPermissionsAsync();
      if (
        permission.status !== Location.PermissionStatus.GRANTED
        && permission.canAskAgain
      ) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        throw new Error('Allow location access to show today’s local weather.');
      }

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 10 * 60 * 1_000,
        requiredAccuracy: 5_000,
      });
      const fresh = await currentWeatherCoordinate();
      const coordinate = validWeatherCoordinate(fresh) ?? validWeatherCoordinate(lastKnown);
      if (!coordinate) {
        throw new Error('Local weather is unavailable until GPS can determine your location.');
      }
      if (__DEV__) console.log('[Mission weather] Forecast coordinate:', coordinate);
      const forecast = await getTrailDailyForecast(
        coordinate.latitude,
        coordinate.longitude,
        controller.signal,
      );
      if (requestId === weatherRequestIdRef.current && !controller.signal.aborted) {
        setWeather(forecast);
      }
    } catch (weatherLoadError) {
      if (
        weatherLoadError instanceof Error
        && weatherLoadError.name === 'AbortError'
      ) return;
      if (__DEV__) console.warn('[Mission weather] Forecast could not load.', weatherLoadError);
      if (requestId === weatherRequestIdRef.current && !controller.signal.aborted) {
        setWeatherError(
          weatherLoadError instanceof Error
            ? weatherLoadError.message
            : 'Today’s local forecast is temporarily unavailable.',
        );
      }
    } finally {
      if (requestId === weatherRequestIdRef.current && !controller.signal.aborted) {
        setIsWeatherLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshWeather();
    return () => weatherAbortRef.current?.abort();
  }, [refreshWeather]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadActiveTrailActivity().then((trailActivity) => {
      if (active) setHasActiveSession(Boolean(trailActivity));
    });
    return () => {
      active = false;
    };
  }, []));

  const assignedMissions = useMemo(() => progress?.missions ?? [], [progress?.missions]);
  const dashboardSummary = useMemo(
    () => summarizeMissionDashboard(assignedMissions),
    [assignedMissions],
  );
  const levelProgress = useMemo(
    () => getPlayerLevelProgress(progress?.totalXp ?? 0),
    [progress?.totalXp],
  );
  const missionCards = useMemo<MissionCardModel[]>(
    () => assignedMissions.map((mission) => {
      const liveProgress = getLiveMissionProgress(
        mission.requirementType,
        mission.progress,
        mission.target,
        activity,
      );
      return {
        id: mission.id,
        title: mission.title,
        instruction: missionInstruction(mission),
        progressLabel: missionProgressLabel(
          mission.requirementType,
          liveProgress,
          mission.target,
        ),
        progressPercent: Math.round(clampProgress(liveProgress, mission.target) * 100),
        rewardXp: mission.rewardXp,
        rewardBondXp: mission.rewards?.bondXp,
        energyRestore: mission.rewards?.energyRestore,
        state: mission.state,
        status: getMissionDisplayStatus(mission.state, liveProgress, mission.target),
        icon: missionIcon(mission.requirementType),
      };
    }),
    [activity, assignedMissions],
  );
  const selectedMission = missionCards.find((mission) => mission.id === selectedMissionId) ?? null;
  const collectionState = getMissionCollectionState({
    isLoading,
    missionCount: assignedMissions.length,
    hasError: Boolean(message),
    isUsingCache: isUsingCachedProgress,
  });
  const companion = progress?.companion;
  const companionName = formatCompanionName(companion?.companionId);
  const fallbackName = session?.user.user_metadata?.full_name
    ?? session?.user.user_metadata?.display_name
    ?? session?.user.email?.split('@')[0]
    ?? 'Explorer';
  const displayName = companionName ?? fallbackName;
  const energyPercent = companion
    ? getEnergyPercent(companion.energy, companion.maximumEnergy)
    : 0;
  const companionMessage = getCompanionDashboardMessage({
    name: companionName ?? 'Your companion',
    hasCompanion: Boolean(companionName),
    todaySteps: activity.todaySteps,
    todayMiles: activity.todayDistanceMiles,
    hasReadyMission: assignedMissions.some((mission) => mission.state === 'completed'),
    allRequiredComplete: dashboardSummary.allRequiredComplete,
    energyPercent,
  });
  const headerMessage = isLoading && !progress
    ? 'Loading today’s adventure…'
    : companionMessage;
  const activityMessage = walkingWarnings.distance
    ?? walkingWarnings.steps
    ?? activity.trackingError;

  return (
    <LinearGradient colors={['#05000C', '#12021F', '#05000C']} style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void Promise.all([
              refresh(),
              activity.refreshActivity(),
              refreshWeather(),
            ])}
            tintColor="#62E7FF"
          />
        )}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: safeArea.top + 10,
            paddingBottom: safeArea.bottom + 124,
          },
        ]}
      >
        <CompactMissionHeader
          name={displayName}
          level={progress ? levelProgress.level : null}
          totalXp={progress ? levelProgress.totalXp : null}
          message={headerMessage}
        />

        <AdventureOverview
          isLoading={isLoading}
          hasMissions={dashboardSummary.totalCount > 0}
          completedCount={dashboardSummary.completedCount}
          totalCount={dashboardSummary.totalCount}
          todayMiles={activity.todayDistanceMiles}
          todaySteps={activity.todaySteps}
          availableXp={dashboardSummary.availableXp}
          claimableXp={dashboardSummary.claimableXp}
          earnedXp={dashboardSummary.earnedXp}
          dailyStreak={progress?.dailyStreak ?? 0}
          calories={activity.activeCaloriesBurned}
          progressPercent={dashboardSummary.progressPercent}
          activityMessage={activityMessage}
          onRetryActivity={() => void activity.refreshActivity()}
        />

        <MissionWeather
          forecast={weather}
          isLoading={isWeatherLoading}
          error={weatherError}
          onRetry={() => void refreshWeather()}
        />

        <DailyMissionSection
          missions={missionCards}
          completedCount={dashboardSummary.completedCount}
          totalCount={dashboardSummary.totalCount}
          collectionState={collectionState}
          onOpen={setSelectedMissionId}
          onRetry={() => void refresh()}
        />

        <ExploreAction
          hasActiveSession={hasActiveSession}
          onPress={() => router.push({
            pathname: '/trails',
            params: { focus: 'nearest' },
          })}
        />

        <RelicUnlocks
          currentMiles={activity.todayDistanceMiles}
          rareTargetMiles={progress ? progress.rare.thresholdMeters / METERS_PER_MILE : null}
          legendaryTargetMiles={progress ? progress.legendary.thresholdMeters / METERS_PER_MILE : null}
          rareEarned={progress?.rare.earned ?? false}
          legendaryEarned={progress?.legendary.earned ?? false}
          completedMissions={dashboardSummary.completedCount}
          totalMissions={dashboardSummary.totalCount}
        />

        <CompanionStatus
          name={companionName ?? 'Companion'}
          hasCompanion={Boolean(companionName)}
          isLoading={isLoading && !progress}
          bondPercent={companion?.bondPercent ?? 0}
          energyPercent={energyPercent}
        />

        <ExplorerLevel
          level={progress ? levelProgress.level : null}
          xpIntoLevel={progress ? levelProgress.xpIntoLevel : null}
          xpRequired={progress ? levelProgress.xpForNextLevel : null}
          xpRemaining={progress ? levelProgress.xpRemaining : null}
        />
      </ScrollView>

      <MissionDetailsModal
        mission={selectedMission}
        isBusy={isLoading}
        errorMessage={message}
        onClose={() => setSelectedMissionId(null)}
        onClaim={(missionId) => void claimReward(missionId)}
      />

      <View style={[styles.bottomNavigation, { bottom: safeArea.bottom + 10 }]}>
        <MissionBottomTabBar activeTab="mission" />
      </View>
    </LinearGradient>
  );
}

// Purpose: Renders the mission details modal interface.
function MissionDetailsModal({
  mission,
  isBusy,
  errorMessage,
  onClose,
  onClaim,
}: {
  mission: MissionCardModel | null;
  isBusy: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onClaim: (missionId: string) => void;
}) {
  if (!mission) return null;
  const canClaim = mission.state === 'completed';
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalHeading}>
            <Ionicons name={mission.icon} size={22} color="#62E7FF" />
            <Text selectable style={styles.modalTitle}>{mission.title}</Text>
          </View>
          <Text selectable style={styles.modalInstruction}>{mission.instruction}</Text>
          <Text selectable style={styles.modalProgress}>{mission.progressLabel}</Text>
          <Text selectable style={styles.modalStatus}>Status: {mission.status}</Text>
          <Text selectable style={styles.modalHelp}>
            Live Map verification controls completion. Opening or repeatedly tapping this card cannot complete it.
          </Text>
          {errorMessage ? <Text selectable style={styles.modalError}>{errorMessage}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canClaim || isBusy }}
            disabled={!canClaim || isBusy}
            onPress={() => onClaim(mission.id)}
            style={[styles.claimButton, (!canClaim || isBusy) && styles.claimButtonDisabled]}
          >
            <Text style={styles.claimButtonText}>
              {mission.state === 'claimed'
                ? 'Reward Claimed'
                : isBusy && canClaim
                  ? 'Claiming…'
                  : 'Claim Reward'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05000C' },
  content: { paddingHorizontal: 18, gap: 18 },
  bottomNavigation: { position: 'absolute', left: 12, right: 12, zIndex: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,0,8,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7E168F',
    backgroundColor: '#170C29',
    padding: 20,
    gap: 11,
  },
  modalHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  modalTitle: { flex: 1, color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  modalInstruction: { color: '#CFC3D7', fontSize: 12, lineHeight: 18 },
  modalProgress: { color: '#62E7FF', fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  modalStatus: { color: '#F6C85F', fontSize: 12, fontWeight: '800' },
  modalHelp: { color: '#A99BB5', fontSize: 12, lineHeight: 18 },
  modalError: { color: '#FFC46B', fontSize: 11, lineHeight: 16 },
  claimButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008FB3',
    marginTop: 4,
  },
  claimButtonDisabled: { backgroundColor: '#33213F', opacity: 0.72 },
  claimButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  closeButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: '#C8A8DF', fontSize: 12, fontWeight: '800' },
});
