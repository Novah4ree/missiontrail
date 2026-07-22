import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDailyProgress } from '@/hooks/use-daily-progress';

const METERS_PER_MILE = 1_609.344;

export function DailyRelicProgress() {
  const { progress, isLoading, message, refresh, syncHealth } = useDailyProgress();
  const distance = progress?.verifiedDistanceMeters ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>TODAY’S EXPLORING</Text>
          <Text style={styles.distance}>{(distance / METERS_PER_MILE).toFixed(2)} miles</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Update today’s exploring"
          accessibilityState={{ disabled: isLoading, busy: isLoading }}
          onPress={() => void refresh()}
          disabled={isLoading}
          style={styles.iconButton}
        >
          <Ionicons name="refresh" size={18} color="#68e7ff" />
        </Pressable>
      </View>

      <Goal rarity="Rare" current={distance} target={8046.72} earned={progress?.rare.earned ?? false} />
      <Goal rarity="Legendary" current={distance} target={16093.44} earned={progress?.legendary.earned ?? false} />

      <Text style={styles.override}>
        {progress?.missionOverride.earned
          ? '✓ Today’s missions unlocked special relics!'
          : 'Complete today’s missions to unlock special relics early.'}
      </Text>
      {!progress?.missionOverride.earned && (progress?.missionOverride.required ?? 0) > 0 ? (
        <Text style={styles.missionCount}>
          {progress?.missionOverride.completedRequired ?? 0} of {progress?.missionOverride.required ?? 0} missions complete
        </Text>
      ) : null}
      {progress?.missions.map((mission) => (
        <View
          accessibilityLabel={`${mission.title}. ${mission.completed ? 'Complete' : 'Keep going'}. ${formatMissionProgress(mission.id, mission.progress, mission.target)}`}
          key={mission.id}
          style={styles.missionRow}
        >
          <Ionicons
            name={mission.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={17}
            color={mission.completed ? '#69E69A' : '#B9A8C7'}
          />
          <View style={styles.missionCopy}>
            <Text style={styles.missionTitle}>{mission.title}</Text>
            <Text style={styles.missionProgress}>
              {mission.completed ? 'Complete!' : formatMissionProgress(mission.id, mission.progress, mission.target)}
            </Text>
          </View>
        </View>
      ))}
      {(progress?.rare.earned || progress?.legendary.earned) &&
        !(progress?.rare.active && progress?.legendary.active) ? (
          <Text style={styles.note}>Your new special relics will appear soon.</Text>
        ) : null}
      {progress?.timezoneStatus === 'fallback' ? (
        <Text style={styles.note}>We couldn’t find your time zone, so today uses a standard day.</Text>
      ) : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add health app walks"
        accessibilityHint="Adds walking and running activity from your phone’s health app"
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
        onPress={() => void syncHealth()}
        disabled={isLoading}
        style={styles.healthButton}
      >
        <Ionicons name="heart-outline" size={16} color="#fff" />
        <Text style={styles.healthText}>{isLoading ? 'Updating…' : 'Add Health App Walks'}</Text>
      </Pressable>
    </View>
  );
}

function formatMissionProgress(id: string, progress: number, target: number) {
  if (id === 'verified-walk-three-miles') {
    return `${(progress / METERS_PER_MILE).toFixed(1)} of ${(target / METERS_PER_MILE).toFixed(0)} miles`;
  }
  if (id === 'verified-active-twenty-minutes') {
    return `${Math.floor(progress / 60)} of ${Math.round(target / 60)} minutes`;
  }
  return `${Math.floor(progress)} of ${Math.floor(target)} trips`;
}

function Goal({ rarity, current, target, earned }: { rarity: 'Rare' | 'Legendary'; current: number; target: number; earned: boolean }) {
  const percent = Math.min(100, Math.max(0, (current / target) * 100));
  const milesRemaining = Math.max(0, (target - current) / METERS_PER_MILE);
  const roundedRemaining = Math.ceil(milesRemaining * 10) / 10;
  const remainingLabel = Number.isInteger(roundedRemaining) ? roundedRemaining.toFixed(0) : roundedRemaining.toFixed(1);
  const progressMessage = earned
    ? `${rarity} Relics unlocked!`
    : `Walk ${remainingLabel} more ${roundedRemaining === 1 ? 'mile' : 'miles'} to unlock ${rarity} Relics.`;

  return (
    <View style={styles.goal}>
      <View style={styles.goalLabels}>
        <View style={styles.goalNameRow}>
          <Ionicons
            name={earned ? 'checkmark-circle' : 'walk'}
            size={17}
            color={earned ? '#69E69A' : '#E6C1FF'}
          />
          <Text style={styles.goalName}>{progressMessage}</Text>
        </View>
        <Text style={styles.goalValue}>{(target / METERS_PER_MILE).toFixed(0)} mi</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${rarity} Relics walking goal`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(percent), text: `${Math.round(percent)} percent complete. ${progressMessage}` }}
        style={styles.track}
      >
        <View style={[styles.fill, earned && styles.earnedFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#170c29', borderColor: '#5c2c7d', borderWidth: 1, borderRadius: 18, padding: 16, gap: 11, marginBottom: 16 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#c8a8df', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  distance: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 3 },
  iconButton: { padding: 8 },
  goal: { gap: 5 },
  goalLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  goalNameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  goalName: { flex: 1, color: '#f6edff', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  goalValue: { color: '#9ddff0', fontSize: 12, fontWeight: '700' },
  track: { height: 7, backgroundColor: '#33213f', borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#19d8ff', borderRadius: 99 },
  earnedFill: { backgroundColor: '#35D47A' },
  override: { color: '#ff77e8', fontSize: 12, fontWeight: '700' },
  missionCount: { color: '#d8c9e3', fontSize: 11, fontWeight: '700' },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 10, padding: 8 },
  missionCopy: { flex: 1, gap: 2 },
  missionTitle: { color: '#F6EDFF', fontSize: 11, fontWeight: '800' },
  missionProgress: { color: '#B9A8C7', fontSize: 10, fontWeight: '700' },
  note: { color: '#a99bb5', fontSize: 11, lineHeight: 16 },
  message: { color: '#ffc46b', fontSize: 12, lineHeight: 17 },
  healthButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', gap: 7, alignItems: 'center', borderColor: '#8043a8', borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  healthText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
