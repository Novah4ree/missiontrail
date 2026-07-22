import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';
import type { Meetup, MeetupCategory } from '@/types/meetups';
import {
  calculateFriendsAttending,
  calculateMeetupDistanceMiles,
  calculateRemainingCapacity,
  determineMeetupStatusLabel,
  filterMeetups,
  filterMeetupsByRadius,
  sortMeetupsByRelevance,
  type MeetupPopularityContext,
  type MeetupRadiusMiles,
  type OptionalCoordinate,
} from '@/utils/meetup-discovery';

type Props = {
  meetups: readonly Meetup[];
  userLocation?: OptionalCoordinate | null;
  radiusMiles: MeetupRadiusMiles;
  currentUserId?: string | null;
  friendUserIds?: readonly string[];
  recentJoinCountsByMeetupId?: Readonly<Record<string, number>>;
  landmarkPopularityById?: Readonly<Record<string, number>>;
  joiningMeetupId?: string | null;
  now?: Date;
  onJoinMeetup: (meetup: Meetup) => void | Promise<void>;
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

/** Shows nearby meetups without owning or continuously requesting GPS state. */
export function MeetupsTodaySection({
  meetups,
  userLocation,
  radiusMiles,
  currentUserId,
  friendUserIds = [],
  recentJoinCountsByMeetupId,
  landmarkPopularityById,
  joiningMeetupId,
  now: providedNow,
  onJoinMeetup,
  onViewDetails,
}: Props) {
  const window = useWindowDimensions();
  const cardWidth = Math.min(350, Math.max(280, window.width - 48));
  const now = useMemo(() => providedNow ?? new Date(), [providedNow]);

  // One stable context lets all utility functions use the same location and clock.
  const popularityContext = useMemo<MeetupPopularityContext>(() => ({
    userLocation,
    friendUserIds,
    recentJoinCountsByMeetupId,
    landmarkPopularityById,
    now,
  }), [friendUserIds, landmarkPopularityById, now, recentJoinCountsByMeetupId, userLocation]);

  // Filtering and sorting run again only when relevant data or discovery settings change.
  const visibleMeetups = useMemo(() => {
    const today = filterMeetups(meetups, 'today', popularityContext);
    const nearby = filterMeetupsByRadius(today, userLocation, radiusMiles);
    return sortMeetupsByRelevance(nearby, popularityContext);
  }, [meetups, popularityContext, radiusMiles, userLocation]);

  // FlatList reuses this render callback while its real inputs remain unchanged.
  const renderMeetup = useCallback(({ item }: { item: Meetup }) => (
    <MeetupTodayCard
      meetup={item}
      cardWidth={cardWidth}
      currentUserId={currentUserId}
      context={popularityContext}
      joining={joiningMeetupId === item.id}
      onJoin={onJoinMeetup}
      onViewDetails={onViewDetails}
    />
  ), [cardWidth, currentUserId, joiningMeetupId, onJoinMeetup, onViewDetails, popularityContext]);

  return (
    <View accessibilityLabel="Meetups happening today" style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>LIVE SOCIAL MISSIONS</Text>
          <Text style={styles.sectionTitle}>Meetups Today</Text>
          <Text style={styles.sectionSubtitle}>
            Within {radiusMiles} miles · Sorted by relevance
          </Text>
        </View>
        <View accessible accessibilityLabel={`${visibleMeetups.length} nearby meetups`} style={styles.countBadge}>
          <Text style={styles.countText}>{visibleMeetups.length}</Text>
        </View>
      </View>

      {visibleMeetups.length === 0 ? (
        <MeetupsEmptyState radiusMiles={radiusMiles} />
      ) : (
        <FlatList
          horizontal
          data={visibleMeetups}
          keyExtractor={(meetup) => meetup.id}
          renderItem={renderMeetup}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardList}
          ItemSeparatorComponent={MeetupSeparator}
          accessibilityLabel="Nearby meetup cards"
        />
      )}
    </View>
  );
}

type CardProps = {
  meetup: Meetup;
  cardWidth: number;
  currentUserId?: string | null;
  context: MeetupPopularityContext;
  joining: boolean;
  onJoin: (meetup: Meetup) => void | Promise<void>;
  onViewDetails: (meetup: Meetup) => void;
};

/** Displays the social, location, mission, and relic facts for one meetup. */
const MeetupTodayCard = memo(function MeetupTodayCard({
  meetup,
  cardWidth,
  currentUserId,
  context,
  joining,
  onJoin,
  onViewDetails,
}: CardProps) {
  const uniqueAttendeeCount = new Set(meetup.attendeeIds).size;
  const friendsAttending = calculateFriendsAttending(meetup, context.friendUserIds);
  const distanceMiles = calculateMeetupDistanceMiles(context.userLocation, meetup);
  const remainingCapacity = calculateRemainingCapacity(meetup);
  const status = determineMeetupStatusLabel(meetup, context) ?? 'Meetup';
  const joined = Boolean(currentUserId && meetup.attendeeIds.includes(currentUserId));
  const ended = hasMeetupEnded(meetup, context.now ?? new Date());
  const full = remainingCapacity === 0;
  const joinDisabled = joined || meetup.isCancelled || full || ended || joining;
  const joinLabel = getJoinLabel({ joined, cancelled: meetup.isCancelled, full, ended, joining });
  const verificationLabel = meetup.type === 'official'
    ? 'Official'
    : meetup.isVerified
      ? 'Verified'
      : null;

  const accessibilitySummary = [
    meetup.title,
    meetup.landmarkName,
    CATEGORY_LABELS[meetup.category],
    formatMeetupTimeRange(meetup),
    distanceMiles === null ? 'distance unavailable' : `${distanceMiles.toFixed(1)} miles away`,
    `${uniqueAttendeeCount} attending`,
    `${friendsAttending} friends attending`,
    status,
  ].join('. ');

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <View style={styles.cardGlow} pointerEvents="none" />
      <View accessible accessibilityLabel={accessibilitySummary}>
        <View style={styles.badgeRow}>
          <Text style={styles.categoryBadge}>{CATEGORY_LABELS[meetup.category]}</Text>
          <Text style={styles.statusBadge}>{status}</Text>
          {verificationLabel ? (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={12} color={C.green} />
              <Text style={styles.verifiedText}>{verificationLabel}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardTitle}>{meetup.title}</Text>
        <View style={styles.landmarkRow}>
          <Ionicons name="location" size={17} color={C.magenta} />
          <Text style={styles.landmarkName}>{meetup.landmarkName}</Text>
        </View>

        <View style={styles.factGrid}>
          <MeetupFact icon="time-outline" label="Time" value={formatMeetupTimeRange(meetup)} />
          <MeetupFact
            icon="navigate-outline"
            label="Distance"
            value={distanceMiles === null ? 'Unavailable' : `${distanceMiles.toFixed(1)} mi`}
          />
          <MeetupFact icon="people-outline" label="Attending" value={`${uniqueAttendeeCount}${meetup.maxAttendees ? ` / ${meetup.maxAttendees}` : ''}`} />
          <MeetupFact icon="people-circle-outline" label="Friends" value={`${friendsAttending}`} />
        </View>

        {meetup.linkedMissionId || meetup.featuredRelicId ? (
          <View style={styles.connections}>
            {meetup.linkedMissionId ? (
              <ConnectionLine icon="flag-outline" label="Linked mission" value={meetup.linkedMissionId} color={C.cyan} />
            ) : null}
            {meetup.featuredRelicId ? (
              <ConnectionLine icon="diamond-outline" label="Featured relic" value={meetup.featuredRelicId} color={C.magenta} />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${joinLabel}: ${meetup.title}`}
          accessibilityState={{ disabled: joinDisabled, selected: joined, busy: joining }}
          disabled={joinDisabled}
          onPress={() => void onJoin(meetup)}
          style={({ pressed }) => [
            styles.joinButton,
            joined && styles.joinedButton,
            joinDisabled && styles.disabledButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name={joined ? 'checkmark-circle' : 'add-circle-outline'} size={18} color={C.text} />
          <Text style={styles.joinButtonText}>{joinLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View details for ${meetup.title}`}
          onPress={() => onViewDetails(meetup)}
          style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailsButtonText}>View Details</Text>
        </Pressable>
      </View>
    </View>
  );
});

/** Displays a labeled fact so meaning never depends on color alone. */
function MeetupFact({ icon, label, value }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={16} color={C.cyan} />
      <View style={styles.factCopy}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

/** Shows a readable mission or relic connection with an icon and text label. */
function ConnectionLine({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.connectionLine}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={styles.connectionLabel}>{label}:</Text>
      <Text selectable style={[styles.connectionValue, { color }]}>{value}</Text>
    </View>
  );
}

/** Provides guidance when today's radius search has no results. */
function MeetupsEmptyState({ radiusMiles }: { radiusMiles: MeetupRadiusMiles }) {
  return (
    <View accessible accessibilityLabel={`No meetups within ${radiusMiles} miles today`} style={styles.emptyState}>
      <Ionicons name="people-outline" size={32} color={C.purple} />
      <Text style={styles.emptyTitle}>No nearby meetups today</Text>
      <Text style={styles.emptyCopy}>
        No meetups are happening nearby today. Expand your search radius or check again later.
      </Text>
    </View>
  );
}

/** Adds consistent spacing between horizontal cards without creating empty data. */
function MeetupSeparator() {
  return <View style={styles.separator} />;
}

/** Formats today's meetup times with the device's local 12-hour or 24-hour preference. */
function formatMeetupTimeRange(meetup: Meetup): string {
  const start = new Date(meetup.startTime);
  const end = new Date(meetup.endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'Time not provided';
  const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

/** Prevents joining once the meetup's recorded end time has passed. */
function hasMeetupEnded(meetup: Meetup, now: Date): boolean {
  const endTimestamp = Date.parse(meetup.endTime);
  return Number.isFinite(endTimestamp) && endTimestamp <= now.getTime();
}

/** Chooses clear button text for every join state. */
function getJoinLabel({ joined, cancelled, full, ended, joining }: {
  joined: boolean;
  cancelled: boolean;
  full: boolean;
  ended: boolean;
  joining: boolean;
}): string {
  if (joined) return 'Joined';
  if (cancelled) return 'Cancelled';
  if (ended) return 'Ended';
  if (full) return 'Full';
  if (joining) return 'Joining…';
  return 'Join Meetup';
}

const styles = StyleSheet.create({
  section: { paddingVertical: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 13 },
  headingCopy: { flex: 1 },
  eyebrow: { color: C.magenta, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: C.text, fontSize: 24, fontWeight: '900', marginTop: 3 },
  sectionSubtitle: { color: C.textMuted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  countBadge: { minWidth: 44, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: C.cyan, backgroundColor: '#102034', alignItems: 'center', justifyContent: 'center' },
  countText: { color: C.cyan, fontSize: 16, fontWeight: '900' },
  cardList: { paddingHorizontal: 16, paddingBottom: 8 },
  separator: { width: 12 },
  card: { overflow: 'hidden', alignSelf: 'flex-start', borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(20, 10, 34, 0.97)', padding: 16, shadowColor: C.purple, shadowOpacity: 0.26, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  cardGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, top: -90, right: -45, backgroundColor: 'rgba(155, 92, 255, 0.14)' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  categoryBadge: { color: C.cyan, fontSize: 11, fontWeight: '900', borderRadius: 999, borderWidth: 1, borderColor: '#205C71', backgroundColor: '#0C2630', paddingHorizontal: 9, paddingVertical: 5 },
  statusBadge: { color: C.magenta, fontSize: 11, fontWeight: '900', borderRadius: 999, borderWidth: 1, borderColor: '#652460', backgroundColor: '#30102E', paddingHorizontal: 9, paddingVertical: 5 },
  verifiedBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: '#286C4B', backgroundColor: '#102D20', paddingHorizontal: 8 },
  verifiedText: { color: C.green, fontSize: 10, fontWeight: '900' },
  cardTitle: { color: C.text, fontSize: 20, lineHeight: 26, fontWeight: '900', marginTop: 13 },
  landmarkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 7 },
  landmarkName: { flex: 1, color: C.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  fact: { minWidth: '46%', flexGrow: 1, flexBasis: 130, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: 'rgba(28, 16, 48, 0.9)', padding: 10 },
  factCopy: { flex: 1 },
  factLabel: { color: C.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  factValue: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '900', marginTop: 1 },
  connections: { gap: 7, borderTopWidth: 1, borderTopColor: C.border, marginTop: 14, paddingTop: 12 },
  connectionLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  connectionLabel: { color: C.textMuted, fontSize: 11, lineHeight: 17, fontWeight: '700' },
  connectionValue: { flexShrink: 1, fontSize: 11, lineHeight: 17, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  joinButton: { flex: 1, minWidth: 135, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, borderWidth: 1, borderColor: C.magenta, backgroundColor: '#702288', paddingHorizontal: 12 },
  joinedButton: { borderColor: C.green, backgroundColor: '#18563A' },
  disabledButton: { opacity: 0.48 },
  joinButtonText: { color: C.text, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  detailsButton: { flex: 1, minWidth: 120, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: C.cyan, backgroundColor: '#0D2431', paddingHorizontal: 12 },
  detailsButtonText: { color: C.cyan, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  emptyState: { marginHorizontal: 16, minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', backgroundColor: C.surface, padding: 24 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  emptyCopy: { color: C.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7 },
});
