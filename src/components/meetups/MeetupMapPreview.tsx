import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';
import type { Meetup, MeetupCategory } from '@/types/meetups';
import {
  calculateFriendsAttending,
  calculateMeetupDistanceMiles,
  calculateRemainingCapacity,
  determineMeetupStatusLabel,
  type OptionalCoordinate,
} from '@/utils/meetup-discovery';

type Props = {
  meetup: Meetup;
  userLocation?: OptionalCoordinate | null;
  friendUserIds?: readonly string[];
  currentUserId?: string | null;
  joining?: boolean;
  now?: Date;
  onClose: () => void;
  onJoin: (meetup: Meetup) => void | Promise<void>;
  onViewDetails: (meetup: Meetup) => void;
};

const CATEGORY_LABELS: Readonly<Record<MeetupCategory, string>> = {
  adventure: 'Adventure',
  games: 'Games',
  shopping: 'Shopping',
  culture: 'Culture',
  food: 'Food and Chill',
  fitness: 'Fitness',
};

/** Shows the selected public meetup while leaving the map mounted underneath. */
function MeetupMapPreviewComponent({
  meetup,
  userLocation,
  friendUserIds = [],
  currentUserId,
  joining = false,
  now = new Date(),
  onClose,
  onJoin,
  onViewDetails,
}: Props) {
  const attendeeCount = new Set(meetup.attendeeIds).size;
  const friendCount = calculateFriendsAttending(meetup, friendUserIds);
  const distance = calculateMeetupDistanceMiles(userLocation, meetup);
  const remainingCapacity = calculateRemainingCapacity(meetup);
  const joined = Boolean(currentUserId && meetup.attendeeIds.includes(currentUserId));
  const ended = meetupHasEnded(meetup, now);
  const full = remainingCapacity === 0;
  const joinDisabled = joined || meetup.isCancelled || ended || full || joining;
  const status = meetup.isCancelled
    ? 'Cancelled'
    : determineMeetupStatusLabel(meetup, { userLocation, friendUserIds, now }) ?? 'Meetup';
  const joinLabel = getJoinLabel({ joined, cancelled: meetup.isCancelled, ended, full, joining });

  return (
    <View accessibilityLabel={`Selected meetup: ${meetup.title}`} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badges}>
          <Text style={styles.categoryBadge}>{CATEGORY_LABELS[meetup.category]}</Text>
          <Text style={styles.statusBadge}>{status}</Text>
          {meetup.type === 'official' && meetup.isVerified ? (
            <View style={styles.officialBadge}>
              <Ionicons name="shield-checkmark" size={12} color={C.green} />
              <Text style={styles.officialText}>Official</Text>
            </View>
          ) : null}
        </View>
        <Pressable accessibilityLabel="Close meetup preview" accessibilityRole="button" hitSlop={8} onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={C.text} />
        </Pressable>
      </View>

      {meetup.isCancelled ? (
        <Text accessibilityLiveRegion="polite" style={styles.cancelledNotice}>
          This meetup was cancelled. It remains visible because you joined it.
        </Text>
      ) : null}

      <Text numberOfLines={2} style={styles.title}>{meetup.title}</Text>
      <View style={styles.landmarkRow}>
        <Ionicons name="location" size={15} color={C.magenta} />
        <Text numberOfLines={1} style={styles.landmark}>{meetup.landmarkName}</Text>
      </View>

      <View style={styles.facts}>
        <PreviewFact icon="time-outline" value={formatMeetupTimeRange(meetup)} />
        <PreviewFact icon="navigate-outline" value={distance === null ? 'Distance unavailable' : `${distance.toFixed(1)} mi`} />
        <PreviewFact icon="people-outline" value={`${attendeeCount} attending`} />
        <PreviewFact icon="people-circle-outline" value={`${friendCount} friends`} />
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`${joinLabel}: ${meetup.title}`}
          accessibilityRole="button"
          accessibilityState={{ busy: joining, disabled: joinDisabled, selected: joined }}
          disabled={joinDisabled}
          onPress={() => void onJoin(meetup)}
          style={({ pressed }) => [styles.joinButton, joinDisabled && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.joinText}>{joinLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`View details for ${meetup.title}`}
          accessibilityRole="button"
          onPress={() => onViewDetails(meetup)}
          style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailsText}>View Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Displays one compact preview fact with an icon and readable text. */
function PreviewFact({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={C.cyan} />
      <Text style={styles.factText}>{value}</Text>
    </View>
  );
}

/** Formats meetup times using the user's local time preference. */
function formatMeetupTimeRange(meetup: Meetup): string {
  const start = new Date(meetup.startTime);
  const end = new Date(meetup.endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'Time unavailable';
  const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

/** Checks whether the scheduled meetup end time has already passed. */
function meetupHasEnded(meetup: Meetup, now: Date): boolean {
  const end = Date.parse(meetup.endTime);
  return Number.isFinite(end) && end <= now.getTime();
}

/** Gives the Join button an explanation for every disabled state. */
function getJoinLabel({ joined, cancelled, ended, full, joining }: {
  joined: boolean;
  cancelled: boolean;
  ended: boolean;
  full: boolean;
  joining: boolean;
}): string {
  if (joined) return 'Joined';
  if (cancelled) return 'Cancelled';
  if (ended) return 'Ended';
  if (full) return 'Full';
  if (joining) return 'Joining…';
  return 'Join Meetup';
}

export const MeetupMapPreview = memo(MeetupMapPreviewComponent);

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.purple,
    backgroundColor: 'rgba(8, 4, 24, 0.97)',
    padding: 14,
    shadowColor: C.purple,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryBadge: { color: C.cyan, fontSize: 10, fontWeight: '900', borderRadius: 999, borderWidth: 1, borderColor: '#24556B', backgroundColor: '#0D2732', paddingHorizontal: 8, paddingVertical: 4 },
  statusBadge: { color: C.magenta, fontSize: 10, fontWeight: '900', borderRadius: 999, borderWidth: 1, borderColor: '#652460', backgroundColor: '#30102E', paddingHorizontal: 8, paddingVertical: 4 },
  officialBadge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: '#286C4B', backgroundColor: '#102D20', paddingHorizontal: 7 },
  officialText: { color: C.green, fontSize: 9, fontWeight: '900' },
  closeButton: { width: 44, height: 44, marginTop: -8, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  cancelledNotice: { color: C.danger, fontSize: 11, lineHeight: 16, fontWeight: '800', marginTop: 7 },
  title: { color: C.text, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 7 },
  landmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  landmark: { flex: 1, color: C.textMuted, fontSize: 12, fontWeight: '700' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  fact: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, backgroundColor: 'rgba(28, 16, 48, 0.88)', paddingHorizontal: 8 },
  factText: { color: C.text, fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  joinButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.magenta, backgroundColor: '#702288', paddingHorizontal: 10 },
  joinText: { color: C.text, fontSize: 12, fontWeight: '900' },
  detailsButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.cyan, backgroundColor: '#0D2431', paddingHorizontal: 10 },
  detailsText: { color: C.cyan, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.76 },
});
