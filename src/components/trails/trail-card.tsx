import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';
import type { Trail } from '@/types/trails';

type Props = {
  trail: Trail;
  meetupCount: number;
  favorite: boolean;
  showDistance: boolean;
  selected?: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
  onStartTrail: () => void;
  onViewMeetups: () => void;
  onToggleFavorite: () => void;
};

// This memoized card summarizes a trail and exposes its main user actions.
export const TrailCard = memo(function TrailCard({
  trail,
  meetupCount,
  favorite,
  showDistance,
  selected,
  onSelect,
  onViewDetails,
  onStartTrail,
  onViewMeetups,
  onToggleFavorite,
}: Props) {
  const canStart = trail.publicAccess && trail.status === 'open';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trail.name}. ${trail.lengthMiles} mile ${trail.activityType} trail.`}
      onPress={onSelect}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={require('../../../assets/images/background_image.png')}
          contentFit="cover"
          transition={180}
          style={styles.image}
          accessibilityLabel={`Scenic preview for ${trail.name}`}
        />
        <View style={styles.imageShade} />
        <View style={[styles.status, trail.status === 'closed' && styles.closedStatus]}>
          <Text style={styles.statusText}>{trail.status.toUpperCase()}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? `Remove ${trail.name} from saved trails` : `Save ${trail.name}`}
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          onPress={(event) => { event.stopPropagation(); onToggleFavorite(); }}
          style={styles.favorite}
        >
          <Ionicons name={favorite ? 'bookmark' : 'bookmark-outline'} size={21} color={favorite ? C.magenta : C.text} />
        </Pressable>
        <View style={styles.imageCopy}>
          <Text style={styles.name}>{trail.name}</Text>
          <Text style={styles.distance}>{showDistance ? `${trail.distanceMiles.toFixed(1)} mi away` : `${trail.city} · distance unavailable`}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.factRow}>
          <Fact icon="resize-outline" value={`${trail.lengthMiles.toFixed(1)} mi`} />
          <Fact icon="time-outline" value={`${trail.estimatedDurationMinutes} min`} />
          <Fact icon="speedometer-outline" value={capitalize(trail.difficulty)} />
          <Fact icon="star" value={trail.rating.toFixed(1)} accent />
        </View>
        <Text style={styles.terrain}>{trail.terrain} · {trail.publicAccess ? 'Public access' : 'Access restricted'}</Text>
        <View style={styles.rewardRow}>
          <Text style={styles.xp}>POSSIBLE +{trail.xpReward} XP</Text>
          <Text style={[styles.relic, !trail.relicsPossible && styles.muted]}>
            {trail.relicsPossible ? '✦ Relics may appear' : 'No relic data'}
          </Text>
          <Text style={styles.meetups}>{meetupCount} meetup{meetupCount === 1 ? '' : 's'}</Text>
        </View>

        <View style={styles.actions}>
          <Action label="View Details" onPress={onViewDetails} />
          <Action label="Start Trail" onPress={onStartTrail} primary disabled={!canStart} />
          <Action label="View Meetups" onPress={onViewMeetups} />
        </View>
      </View>
    </Pressable>
  );
});

// Displays a compact icon-and-value fact inside the trail card.
function Fact({ icon, value, accent }: { icon: keyof typeof Ionicons.glyphMap; value: string; accent?: boolean }) {
  return <View style={styles.fact}><Ionicons name={icon} size={14} color={accent ? C.warning : C.cyan} /><Text style={styles.factText}>{value}</Text></View>;
}

// Creates a consistent card button and stops its tap from selecting the whole card.
function Action({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={(event) => { event.stopPropagation(); onPress(); }}
      style={({ pressed }) => [styles.action, primary && styles.primaryAction, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.actionText, primary && styles.primaryActionText]}>{label}</Text>
    </Pressable>
  );
}

// Converts a stored lowercase label into display text.
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginBottom: 16, shadowColor: C.purple, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  selected: { borderColor: C.cyan },
  pressed: { opacity: 0.82 },
  imageWrap: { height: 150, justifyContent: 'flex-end' },
  image: { ...StyleSheet.absoluteFillObject },
  imageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,0,12,0.46)' },
  status: { position: 'absolute', top: 12, left: 12, borderRadius: 999, backgroundColor: 'rgba(19,92,59,0.92)', paddingHorizontal: 10, paddingVertical: 5 },
  closedStatus: { backgroundColor: 'rgba(130,33,58,0.94)' },
  statusText: { color: C.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  favorite: { position: 'absolute', top: 10, right: 10, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,0,12,0.78)', borderWidth: 1, borderColor: C.border },
  imageCopy: { padding: 14 },
  name: { color: C.text, fontSize: 20, fontWeight: '900' },
  distance: { color: C.cyan, fontSize: 12, fontWeight: '800', marginTop: 3 },
  body: { padding: 14 },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9, backgroundColor: C.surfaceRaised, paddingHorizontal: 8, minHeight: 30 },
  factText: { color: C.text, fontSize: 10, fontWeight: '800' },
  terrain: { color: C.textMuted, fontSize: 11, lineHeight: 17, marginTop: 10 },
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  xp: { color: C.green, fontSize: 10, fontWeight: '900' },
  relic: { color: C.magenta, fontSize: 10, fontWeight: '800' },
  muted: { color: C.textMuted },
  meetups: { color: C.purple, fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 7, marginTop: 14 },
  action: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 4 },
  primaryAction: { backgroundColor: '#73258C', borderColor: C.magenta },
  disabled: { opacity: 0.38 },
  actionText: { color: C.textMuted, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  primaryActionText: { color: C.text },
});
