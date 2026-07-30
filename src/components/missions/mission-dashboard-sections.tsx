import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { DashboardMissionState } from '@/utils/mission-dashboard-core';
import type { TrailDailyForecast } from '@/services/weather-forecast-service';

type IconName = keyof typeof Ionicons.glyphMap;

export function MissionWeather({
  forecast,
  isLoading,
  error,
  onRetry,
}: {
  forecast: TrailDailyForecast | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <DashboardCard title="TODAY’S WEATHER" icon="partly-sunny-outline">
      {isLoading ? (
        <View style={styles.inlineState}>
          <ActivityIndicator color="#F6C85F" />
          <Text selectable style={styles.stateText}>Loading your local forecast…</Text>
        </View>
      ) : forecast && !error ? (
        <View style={styles.weatherContent}>
          <Ionicons name={weatherIcon(forecast.weatherCode)} size={34} color="#F6C85F" />
          <View style={styles.weatherCopy}>
            <Text selectable style={styles.weatherSummary}>{forecast.summary}</Text>
            <Text selectable style={styles.weatherTemperature}>
              {Math.round(forecast.temperatureMaxF)}° / {Math.round(forecast.temperatureMinF)}°
            </Text>
            <Text selectable style={styles.weatherDetails}>
              Rain {Math.round(forecast.precipitationProbabilityPercent)}% • Wind {Math.round(forecast.windSpeedMaxMph)} mph • UV {Math.round(forecast.uvIndexMax)}
            </Text>
            <Text selectable style={styles.weatherSource}>
              Today, {formatWeatherDate(forecast.date)} • Open-Meteo
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.weatherError}>
          <Ionicons name="cloud-offline-outline" size={25} color="#FFC46B" />
          <Text selectable style={styles.stateText}>
            {error ?? 'Today’s local forecast is temporarily unavailable.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading local weather again"
            onPress={onRetry}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      )}
    </DashboardCard>
  );
}

function weatherIcon(code: number): IconName {
  if (code === 0 || code === 1) return 'sunny-outline';
  if (code === 2) return 'partly-sunny-outline';
  if (code === 3 || code === 45 || code === 48) return 'cloudy-outline';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow-outline';
  if (code >= 95) return 'thunderstorm-outline';
  return 'rainy-outline';
}

function formatWeatherDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

export type MissionCardModel = {
  id: string;
  title: string;
  instruction: string;
  progressLabel: string;
  progressPercent: number;
  rewardXp: number;
  rewardBondXp?: number;
  energyRestore?: number;
  state: DashboardMissionState;
  status: string;
  icon: IconName;
};

export function DashboardProgressBar({
  progress,
  color = '#19D8FF',
  label,
}: {
  progress: number;
  color?: string;
  label: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  );
}

export function CompactMissionHeader({
  name,
  level,
  totalXp,
  message,
}: {
  name: string;
  level: number | null;
  totalXp: number | null;
  message: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <Image
          accessibilityIgnoresInvertColors
          source={require('../../../assets/images/tabIcons/mission.png')}
          resizeMode="contain"
          style={styles.headerIconImage}
        />
      </View>
      <View style={styles.headerCopy}>
        <Text selectable style={styles.headerName}>{name}</Text>
        <Text style={styles.headerTitle}>Today’s Missions</Text>
        <Text selectable style={styles.headerMeta}>
          {level === null || totalXp === null
            ? 'Level … • … XP'
            : `Level ${level} • ${totalXp.toLocaleString()} XP`}
        </Text>
        <Text selectable style={styles.headerMessage}>{message}</Text>
      </View>
    </View>
  );
}

export function AdventureOverview({
  isLoading,
  hasMissions,
  completedCount,
  totalCount,
  todayMiles,
  todaySteps,
  availableXp,
  claimableXp,
  earnedXp,
  dailyStreak,
  calories,
  progressPercent,
  activityMessage,
  onRetryActivity,
}: {
  isLoading: boolean;
  hasMissions: boolean;
  completedCount: number;
  totalCount: number;
  todayMiles: number;
  todaySteps: number;
  availableXp: number;
  claimableXp: number;
  earnedXp: number;
  dailyStreak: number;
  calories: number;
  progressPercent: number;
  activityMessage: string | null;
  onRetryActivity: () => void;
}) {
  return (
    <LinearGradient colors={['rgba(61,17,91,0.95)', 'rgba(19,19,56,0.96)']} style={styles.heroCard}>
      <Text style={styles.eyebrow}>TODAY’S ADVENTURE</Text>
      {isLoading && !hasMissions ? (
        <View style={styles.inlineState}>
          <ActivityIndicator color="#62E7FF" />
          <Text style={styles.stateText}>Loading today’s missions…</Text>
        </View>
      ) : hasMissions ? (
        <>
          <Text selectable style={styles.heroCount}>
            {completedCount} of {totalCount} missions complete
          </Text>
          <View style={styles.metricRow}>
            <Metric icon="walk-outline" value={`${todayMiles.toFixed(2)} mi`} />
            <Metric icon="footsteps-outline" value={`${todaySteps.toLocaleString()} steps`} />
            <Metric icon="trophy-outline" value={`${availableXp.toLocaleString()} XP available`} gold />
          </View>
          <Text selectable style={styles.rewardBreakdown}>
            {claimableXp.toLocaleString()} XP ready to claim • {earnedXp.toLocaleString()} XP earned
          </Text>
          <Text selectable style={styles.streakText}>
            {dailyStreak > 0 ? `${dailyStreak}-Day Streak` : 'No active streak yet'}
          </Text>
          <DashboardProgressBar
            label="Today’s required mission progress"
            progress={progressPercent / 100}
            color="#FF2DF7"
          />
          <Text selectable style={styles.estimateText}>
            {calories.toLocaleString()} estimated active calories
          </Text>
        </>
      ) : (
        <Text selectable style={styles.stateText}>
          No missions are available yet. Pull to refresh or try again shortly.
        </Text>
      )}
      {activityMessage ? (
        <View style={styles.activityBanner}>
          <Ionicons name="warning-outline" size={17} color="#FFC46B" />
          <Text selectable style={styles.activityBannerText}>{activityMessage}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh today’s activity"
            onPress={onRetryActivity}
            style={styles.bannerButton}
          >
            <Text style={styles.bannerButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : null}
    </LinearGradient>
  );
}

function Metric({
  icon,
  value,
  gold = false,
}: {
  icon: IconName;
  value: string;
  gold?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={15} color={gold ? '#F6C85F' : '#62E7FF'} />
      <Text selectable style={[styles.metricText, gold && styles.goldText]}>{value}</Text>
    </View>
  );
}

export function DailyMissionSection({
  missions,
  completedCount,
  totalCount,
  collectionState,
  onOpen,
  onRetry,
}: {
  missions: MissionCardModel[];
  completedCount: number;
  totalCount: number;
  collectionState: 'loading' | 'offline-cache' | 'error' | 'empty' | 'loaded';
  onOpen: (missionId: string) => void;
  onRetry: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>DAILY MISSIONS</Text>
        {totalCount > 0 ? (
          <Text selectable style={styles.sectionCount}>{completedCount}/{totalCount}</Text>
        ) : null}
      </View>

      {collectionState === 'offline-cache' ? (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#FFC46B" />
          <Text selectable style={styles.offlineText}>
            You’re offline. Showing your most recently saved missions.
          </Text>
        </View>
      ) : null}

      {collectionState === 'loading' ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color="#62E7FF" />
          <Text selectable style={styles.stateText}>Loading today’s missions…</Text>
        </View>
      ) : null}

      {collectionState === 'error' ? (
        <StateCard
          icon="alert-circle-outline"
          message="Missions couldn’t be loaded."
          action="Try Again"
          onPress={onRetry}
        />
      ) : null}

      {collectionState === 'empty' ? (
        <StateCard
          icon="list-outline"
          message="No missions are available yet. Pull to refresh or try again shortly."
          action="Try Again"
          onPress={onRetry}
        />
      ) : null}

      {missions.map((mission) => (
        <MissionDashboardCard key={mission.id} mission={mission} onPress={() => onOpen(mission.id)} />
      ))}
    </View>
  );
}

function StateCard({
  icon,
  message,
  action,
  onPress,
}: {
  icon: IconName;
  message: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <Ionicons name={icon} size={24} color="#9E8CAE" />
      <Text selectable style={styles.stateText}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function MissionDashboardCard({
  mission,
  onPress,
}: {
  mission: MissionCardModel;
  onPress: () => void;
}) {
  const isDone = mission.state === 'claimed';
  const isReady = mission.state === 'completed';
  const statusColor = isDone
    ? '#69E69A'
    : isReady
      ? '#F6C85F'
      : mission.state === 'locked' || mission.state === 'expired'
        ? '#8E8298'
        : '#62E7FF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mission.title}. ${mission.status}. ${mission.progressLabel}. ${mission.rewardXp} XP reward`}
      accessibilityHint="Opens mission details without completing the mission"
      onPress={onPress}
      style={({ pressed }) => [
        styles.missionCard,
        isReady && styles.readyCard,
        isDone && styles.completedCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.missionTopRow}>
        <View style={styles.missionIcon}>
          <Ionicons name={mission.icon} size={20} color={statusColor} />
        </View>
        <View style={styles.missionCopy}>
          <Text selectable style={styles.missionTitle}>{mission.title}</Text>
          <Text selectable style={styles.missionInstruction}>{mission.instruction}</Text>
        </View>
      </View>
      <View style={styles.rewardRow}>
        <Text selectable style={styles.rewardText}>+{mission.rewardXp} XP</Text>
        {mission.rewardBondXp || mission.energyRestore ? (
          <Text selectable style={styles.companionRewardText}>
            Companion:
            {mission.rewardBondXp ? ` +${mission.rewardBondXp} Bond XP` : ''}
            {mission.energyRestore ? ` +${mission.energyRestore} Energy` : ''}
          </Text>
        ) : null}
      </View>
      <Text selectable style={styles.missionProgress}>{mission.progressLabel}</Text>
      <DashboardProgressBar
        label={`${mission.title} progress`}
        progress={mission.progressPercent / 100}
        color={isDone ? '#69E69A' : isReady ? '#F6C85F' : '#19D8FF'}
      />
      <View style={styles.missionFooter}>
        <Text selectable style={[styles.statusText, { color: statusColor }]}>
          {mission.status.toUpperCase()}
        </Text>
        {mission.state === 'completed' ? (
          <Text style={styles.claimHint}>Tap for reward</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ExploreAction({
  hasActiveSession,
  onPress,
}: {
  hasActiveSession: boolean;
  onPress: () => void;
}) {
  const label = hasActiveSession ? 'CONTINUE EXPLORING' : 'START EXPLORING';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasActiveSession ? 'Continue exploring on the Live Map' : 'Start exploring on the Live Map'}
      accessibilityHint="Opens the existing Live Map"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <LinearGradient colors={['#FF00DD', '#21D9FF']} style={styles.primaryButton}>
        <Ionicons name={hasActiveSession ? 'navigate' : 'map-outline'} size={20} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function RelicUnlocks({
  currentMiles,
  rareTargetMiles,
  legendaryTargetMiles,
  rareEarned,
  legendaryEarned,
  completedMissions,
  totalMissions,
}: {
  currentMiles: number;
  rareTargetMiles: number | null;
  legendaryTargetMiles: number | null;
  rareEarned: boolean;
  legendaryEarned: boolean;
  completedMissions: number;
  totalMissions: number;
}) {
  return (
    <DashboardCard title="RELIC UNLOCKS" icon="diamond-outline">
      <RelicGoal
        name="Rare Relics"
        currentMiles={currentMiles}
        targetMiles={rareTargetMiles}
        earned={rareEarned}
        color="#C786FF"
      />
      <RelicGoal
        name="Legendary Relics"
        currentMiles={currentMiles}
        targetMiles={legendaryTargetMiles}
        earned={legendaryEarned}
        color="#F6C85F"
      />
      <View style={styles.goalBlock}>
        <View style={styles.goalHeading}>
          <Text style={styles.goalName}>Bonus Relic</Text>
          <Text selectable style={styles.goalValue}>
            {totalMissions > 0 ? `${completedMissions} / ${totalMissions}` : '—'}
          </Text>
        </View>
        <Text selectable style={styles.goalHint}>
          {totalMissions > 0
            ? `Complete all ${totalMissions} required daily missions`
            : 'Waiting for today’s mission assignments'}
        </Text>
        <DashboardProgressBar
          label="Bonus Relic mission progress"
          progress={totalMissions > 0 ? completedMissions / totalMissions : 0}
          color="#FF2DF7"
        />
      </View>
    </DashboardCard>
  );
}

function RelicGoal({
  name,
  currentMiles,
  targetMiles,
  earned,
  color,
}: {
  name: string;
  currentMiles: number;
  targetMiles: number | null;
  earned: boolean;
  color: string;
}) {
  const remaining = targetMiles === null ? null : Math.max(0, targetMiles - currentMiles);
  const roundedRemaining = remaining === null ? null : Math.round(remaining * 100) / 100;
  return (
    <View style={styles.goalBlock}>
      <View style={styles.goalHeading}>
        <Text style={styles.goalName}>{name}</Text>
        <Text selectable style={styles.goalValue}>
          {targetMiles === null ? 'Loading…' : `${currentMiles.toFixed(2)} / ${targetMiles.toFixed(2)} miles`}
        </Text>
      </View>
      <Text selectable style={styles.goalHint}>
        {earned
          ? `${name} Unlocked`
          : roundedRemaining === null
            ? 'Loading requirement…'
            : `Walk ${roundedRemaining.toFixed(roundedRemaining % 1 === 0 ? 0 : 2)} more ${roundedRemaining === 1 ? 'mile' : 'miles'}`}
      </Text>
      <DashboardProgressBar
        label={`${name} distance progress`}
        progress={targetMiles ? currentMiles / targetMiles : 0}
        color={color}
      />
    </View>
  );
}

export function CompanionStatus({
  name,
  hasCompanion,
  isLoading,
  bondPercent,
  energyPercent,
}: {
  name: string;
  hasCompanion: boolean;
  isLoading: boolean;
  bondPercent: number;
  energyPercent: number;
}) {
  return (
    <DashboardCard title={hasCompanion ? `${name.toUpperCase()}’S STATUS` : 'COMPANION STATUS'} icon="heart-outline">
      {isLoading ? (
        <View style={styles.inlineState}>
          <ActivityIndicator color="#62E7FF" />
          <Text selectable style={styles.stateText}>Loading companion status…</Text>
        </View>
      ) : !hasCompanion ? (
        <Text selectable style={styles.stateText}>
          No active companion. Visit the Companion screen to choose one.
        </Text>
      ) : (
        <>
          <StatusMeter label="Bond" value={bondPercent} color="#FF2DF7" />
          <StatusMeter label="Energy" value={energyPercent} color="#19D8FF" />
          <Text selectable style={styles.cardFootnote}>
            Complete verified missions together to strengthen your bond.
          </Text>
        </>
      )}
    </DashboardCard>
  );
}

function StatusMeter({ label, value, color }: { label: string; value: number; color: string }) {
  const safeValue = Math.round(Math.min(100, Math.max(0, value)));
  return (
    <View style={styles.goalBlock}>
      <View style={styles.goalHeading}>
        <Text style={styles.goalName}>{label}</Text>
        <Text selectable style={[styles.goalValue, { color }]}>{safeValue}%</Text>
      </View>
      <DashboardProgressBar label={`${label}: ${safeValue} percent`} progress={safeValue / 100} color={color} />
    </View>
  );
}

export function ExplorerLevel({
  level,
  xpIntoLevel,
  xpRequired,
  xpRemaining,
}: {
  level: number | null;
  xpIntoLevel: number | null;
  xpRequired: number | null;
  xpRemaining: number | null;
}) {
  if (
    level === null
    || xpIntoLevel === null
    || xpRequired === null
    || xpRemaining === null
  ) {
    return (
      <DashboardCard title="EXPLORER LEVEL …" icon="rocket-outline">
        <View style={styles.inlineState}>
          <ActivityIndicator color="#62E7FF" />
          <Text selectable style={styles.stateText}>Loading player progression…</Text>
        </View>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={`EXPLORER LEVEL ${level}`} icon="rocket-outline">
      <View style={styles.goalHeading}>
        <Text selectable style={styles.levelXp}>
          {xpIntoLevel.toLocaleString()} / {xpRequired.toLocaleString()} XP
        </Text>
        <Text selectable style={styles.levelPercent}>
          {Math.round((xpIntoLevel / Math.max(1, xpRequired)) * 100)}%
        </Text>
      </View>
      <DashboardProgressBar
        label={`Explorer Level ${level} XP progress`}
        progress={xpIntoLevel / Math.max(1, xpRequired)}
        color="#F6C85F"
      />
      <Text selectable style={styles.cardFootnote}>
        {xpRemaining.toLocaleString()} XP to Level {level + 1}
      </Text>
    </DashboardCard>
  );
}

function DashboardCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.dashboardCard}>
      <View style={styles.cardHeading}>
        <Ionicons name={icon} size={18} color="#62E7FF" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconImage: {
    width: 42,
    height: 42,
  },
  headerCopy: { flex: 1, gap: 2 },
  headerName: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  headerTitle: { color: '#E7DDF0', fontSize: 15, fontWeight: '800' },
  headerMeta: { color: '#62E7FF', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  headerMessage: { color: '#D4C7DD', fontSize: 11, lineHeight: 16, paddingTop: 3 },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#8E36B0',
    padding: 16,
    gap: 12,
  },
  eyebrow: { color: '#FF77E8', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroCount: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricText: { color: '#D8EEF3', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  goldText: { color: '#F6C85F' },
  estimateText: { color: '#D4C7DD', fontSize: 10 },
  rewardBreakdown: { color: '#E9D8F0', fontSize: 11, fontWeight: '700' },
  streakText: { color: '#F6C85F', fontSize: 11, fontWeight: '900' },
  track: { height: 8, borderRadius: 99, overflow: 'hidden', backgroundColor: '#2B1B37' },
  fill: { height: '100%', borderRadius: 99 },
  activityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#75511D',
    backgroundColor: 'rgba(74,48,12,0.42)',
    padding: 10,
  },
  activityBannerText: { flex: 1, minWidth: 160, color: '#FFE0A6', fontSize: 11, lineHeight: 16 },
  bannerButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 9 },
  bannerButtonText: { color: '#62E7FF', fontSize: 11, fontWeight: '900' },
  weatherContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  weatherCopy: { flex: 1, gap: 3 },
  weatherSummary: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  weatherTemperature: { color: '#F6C85F', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  weatherDetails: { color: '#D8EEF3', fontSize: 11, lineHeight: 16 },
  weatherSource: { color: '#9E8CAE', fontSize: 9, lineHeight: 14 },
  weatherError: { alignItems: 'center', gap: 10 },
  section: { gap: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { flexShrink: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.9 },
  sectionCount: { color: '#62E7FF', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(96,60,15,0.38)',
    padding: 10,
  },
  offlineText: { flex: 1, color: '#FFE0A6', fontSize: 11, lineHeight: 16 },
  stateCard: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3D1550',
    backgroundColor: 'rgba(9,0,18,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  inlineState: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stateText: { color: '#CFC3D7', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  secondaryButton: {
    minHeight: 42,
    minWidth: 104,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#00A8C7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: '#62E7FF', fontSize: 12, fontWeight: '900' },
  missionCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#402054',
    backgroundColor: 'rgba(10,2,21,0.94)',
    padding: 16,
    gap: 10,
  },
  readyCard: { borderColor: '#A47B20', backgroundColor: 'rgba(54,39,7,0.72)' },
  completedCard: { borderColor: '#236946', backgroundColor: 'rgba(8,42,28,0.72)' },
  missionTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  missionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(98,231,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  missionCopy: { flex: 1, minWidth: 0, gap: 3 },
  missionTitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  missionInstruction: { color: '#D4C7DD', fontSize: 11, lineHeight: 16 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rewardText: { color: '#F6C85F', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  companionRewardText: { color: '#D8B7EA', fontSize: 10, fontWeight: '700' },
  missionProgress: { color: '#D8EEF3', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  missionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  claimHint: { color: '#F6C85F', fontSize: 10, fontWeight: '800' },
  primaryButton: {
    minHeight: 54,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 20,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.9 },
  dashboardCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#4C2763',
    backgroundColor: 'rgba(13,3,25,0.91)',
    padding: 16,
    gap: 13,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalBlock: { gap: 7 },
  goalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalName: { color: '#F6EDFF', fontSize: 13, fontWeight: '900' },
  goalValue: { color: '#D8EEF3', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  goalHint: { color: '#D4C7DD', fontSize: 10, lineHeight: 15 },
  cardFootnote: { color: '#D4C7DD', fontSize: 11, lineHeight: 16 },
  levelXp: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  levelPercent: { color: '#F6C85F', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
