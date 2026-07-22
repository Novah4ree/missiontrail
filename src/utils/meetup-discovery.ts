import type { Meetup, MeetupCategory } from '../types/meetups.ts';
import { calculateDistanceMeters, type Coordinate } from './distance.ts';

const METERS_PER_MILE = 1_609.344;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;

export const MEETUP_RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export type MeetupRadiusMiles = (typeof MEETUP_RADIUS_OPTIONS)[number];

export type MeetupFilter =
  | 'all'
  | MeetupCategory
  | 'food_and_chill'
  | 'friends_attending'
  | 'official_meetups'
  | 'today'
  | 'this_weekend';

export type MeetupStatusLabel =
  | 'Trending'
  | 'Friends Gathering'
  | 'Filling Fast'
  | 'Community Favorite'
  | 'New Meetup'
  | 'Official Meetup';

export type OptionalCoordinate = {
  latitude?: number | null;
  longitude?: number | null;
};

export type MeetupPopularityContext = {
  userLocation?: OptionalCoordinate | null;
  friendUserIds?: readonly string[];
  recentJoinCountsByMeetupId?: Readonly<Record<string, number>>;
  landmarkPopularityById?: Readonly<Record<string, number>>;
  now?: Date;
};

export type MeetupPopularityBreakdown = {
  total: number;
  distance: number;
  attendance: number;
  friends: number;
  recentJoins: number;
  verified: number;
  startingSoon: number;
  landmarkPopularity: number;
  availableCapacity: number;
};

/** Public constants make the ranking behavior easy to explain and tune later. */
export const MEETUP_POPULARITY_WEIGHTS = {
  distance: 30,
  friends: 20,
  startingSoon: 15,
  verified: 10,
  attendance: 8,
  recentJoins: 7,
  landmarkPopularity: 5,
  availableCapacity: 5,
} as const;

/** Checks coordinates before passing them to the shared Haversine helper. */
function isValidCoordinate(value?: OptionalCoordinate | null): value is Coordinate {
  if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return false;
  const latitude = value.latitude as number;
  const longitude = value.longitude as number;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/** Keeps a number inside a safe scoring range. */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Counts unique attendees so repeated IDs cannot inflate popularity or capacity. */
function attendeeCount(meetup: Meetup): number {
  return new Set(meetup.attendeeIds).size;
}

/** Counts the current user's friends that are already attending this meetup. */
export function calculateFriendsAttending(
  meetup: Meetup,
  friendUserIds: readonly string[] = [],
): number {
  if (friendUserIds.length === 0) return 0;
  const friendSet = new Set(friendUserIds);
  return new Set(meetup.attendeeIds.filter((id) => friendSet.has(id))).size;
}

/** Returns meetup distance in miles, or null when either coordinate is missing or invalid. */
export function calculateMeetupDistanceMiles(
  userLocation: OptionalCoordinate | null | undefined,
  meetupLocation: OptionalCoordinate | null | undefined,
): number | null {
  if (!isValidCoordinate(userLocation) || !isValidCoordinate(meetupLocation)) return null;
  return calculateDistanceMeters(userLocation, meetupLocation) / METERS_PER_MILE;
}

/** Keeps only meetups whose valid public landmark coordinate is inside the radius. */
export function filterMeetupsByRadius(
  meetups: readonly Meetup[],
  userLocation: OptionalCoordinate | null | undefined,
  radiusMiles: MeetupRadiusMiles,
): Meetup[] {
  if (!isValidCoordinate(userLocation)) return [];
  return meetups.filter((meetup) => {
    const distance = calculateMeetupDistanceMiles(userLocation, meetup);
    return distance !== null && distance <= radiusMiles;
  });
}

/** Returns spaces left, zero for a full meetup, or null when capacity is unlimited. */
export function calculateRemainingCapacity(meetup: Meetup): number | null {
  if (meetup.maxAttendees === undefined) return null;
  if (!Number.isFinite(meetup.maxAttendees)) return null;
  return Math.max(0, Math.floor(meetup.maxAttendees) - attendeeCount(meetup));
}

/** Turns distance into a score that strongly favors nearby public landmarks. */
function distanceScore(distanceMiles: number | null): number {
  if (distanceMiles === null) return 0;
  if (distanceMiles <= 1) return 1;
  if (distanceMiles <= 5) return 0.85;
  if (distanceMiles <= 10) return 0.65;
  if (distanceMiles <= 25) return 0.35;
  if (distanceMiles <= 50) return 0.15;
  return 0;
}

/** Turns time until start into a score while preventing past meetups from ranking highly. */
function startingSoonScore(startTime: string, now: Date): number {
  const startTimestamp = Date.parse(startTime);
  if (!Number.isFinite(startTimestamp)) return 0;
  const hoursUntilStart = (startTimestamp - now.getTime()) / MILLISECONDS_PER_HOUR;
  if (hoursUntilStart < 0) return 0;
  if (hoursUntilStart <= 2) return 1;
  if (hoursUntilStart <= 6) return 0.9;
  if (hoursUntilStart <= 24) return 0.75;
  if (hoursUntilStart <= 72) return 0.4;
  if (hoursUntilStart <= 168) return 0.2;
  return 0;
}

/** Rewards meetups that still have room instead of rewarding full events. */
function availableCapacityScore(meetup: Meetup): number {
  const remaining = calculateRemainingCapacity(meetup);
  if (remaining === null) return 1;
  if (remaining === 0 || !meetup.maxAttendees || meetup.maxAttendees <= 0) return 0;
  return clamp(remaining / meetup.maxAttendees, 0, 1);
}

/** Calculates a balanced 0–100 discovery score and exposes each weighted part. */
export function calculateMeetupPopularity(
  meetup: Meetup,
  context: MeetupPopularityContext = {},
): MeetupPopularityBreakdown {
  const now = context.now ?? new Date();
  const distanceMiles = calculateMeetupDistanceMiles(context.userLocation, meetup);
  const friends = calculateFriendsAttending(meetup, context.friendUserIds);
  const recentJoins = Math.max(0, context.recentJoinCountsByMeetupId?.[meetup.id] ?? 0);
  const landmarkPopularity = meetup.landmarkId
    ? context.landmarkPopularityById?.[meetup.landmarkId] ?? 0
    : 0;

  const breakdown: Omit<MeetupPopularityBreakdown, 'total'> = {
    distance: distanceScore(distanceMiles) * MEETUP_POPULARITY_WEIGHTS.distance,
    friends: clamp(friends / 3, 0, 1) * MEETUP_POPULARITY_WEIGHTS.friends,
    startingSoon: startingSoonScore(meetup.startTime, now) * MEETUP_POPULARITY_WEIGHTS.startingSoon,
    verified: (meetup.isVerified ? 1 : 0) * MEETUP_POPULARITY_WEIGHTS.verified,
    attendance: clamp(attendeeCount(meetup) / 20, 0, 1) * MEETUP_POPULARITY_WEIGHTS.attendance,
    recentJoins: clamp(recentJoins / 5, 0, 1) * MEETUP_POPULARITY_WEIGHTS.recentJoins,
    landmarkPopularity: clamp(landmarkPopularity, 0, 1) * MEETUP_POPULARITY_WEIGHTS.landmarkPopularity,
    availableCapacity: availableCapacityScore(meetup) * MEETUP_POPULARITY_WEIGHTS.availableCapacity,
  };
  const total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
  return { total: Math.round(total * 10) / 10, ...breakdown };
}

/** Sorts by relevance while calculating each meetup score only once per call. */
export function sortMeetupsByRelevance(
  meetups: readonly Meetup[],
  context: MeetupPopularityContext = {},
): Meetup[] {
  const scored = meetups.map((meetup) => ({
    meetup,
    distance: calculateMeetupDistanceMiles(context.userLocation, meetup),
    score: calculateMeetupPopularity(meetup, context).total,
  }));

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftDistance = left.distance ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.distance ?? Number.POSITIVE_INFINITY;
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    const timeDifference = Date.parse(left.meetup.startTime) - Date.parse(right.meetup.startTime);
    if (Number.isFinite(timeDifference) && timeDifference !== 0) return timeDifference;
    return left.meetup.id.localeCompare(right.meetup.id);
  });

  return scored.map(({ meetup }) => meetup);
}

/** Checks whether two dates share the same local calendar day. */
function isSameLocalDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

/** Checks Saturday and Sunday for the current or upcoming local weekend. */
function isThisWeekend(date: Date, now: Date): boolean {
  const saturday = new Date(now);
  const currentDay = now.getDay();
  const daysUntilSaturday = currentDay === 0 ? -1 : (6 - currentDay + 7) % 7;
  saturday.setDate(now.getDate() + daysUntilSaturday);
  saturday.setHours(0, 0, 0, 0);
  const monday = new Date(saturday);
  monday.setDate(saturday.getDate() + 2);
  return date.getTime() >= saturday.getTime() && date.getTime() < monday.getTime();
}

/** Applies one discovery chip without importing React or a UI component. */
export function filterMeetups(
  meetups: readonly Meetup[],
  filter: MeetupFilter,
  context: MeetupPopularityContext = {},
): Meetup[] {
  const now = context.now ?? new Date();
  return meetups.filter((meetup) => {
    if (meetup.isCancelled) return false;
    if (filter === 'all') return true;
    if (filter === 'food_and_chill') return meetup.category === 'food';
    if (filter === 'friends_attending') {
      return calculateFriendsAttending(meetup, context.friendUserIds) > 0;
    }
    if (filter === 'official_meetups') return meetup.type === 'official';
    const startDate = new Date(meetup.startTime);
    if (!Number.isFinite(startDate.getTime())) return false;
    if (filter === 'today') return isSameLocalDay(startDate, now);
    if (filter === 'this_weekend') return isThisWeekend(startDate, now);
    return meetup.category === filter;
  });
}

/** Chooses one short badge using friends, capacity, momentum, and meetup age. */
export function determineMeetupStatusLabel(
  meetup: Meetup,
  context: MeetupPopularityContext = {},
): MeetupStatusLabel | null {
  const now = context.now ?? new Date();
  const friends = calculateFriendsAttending(meetup, context.friendUserIds);
  const remaining = calculateRemainingCapacity(meetup);
  const recentJoins = Math.max(0, context.recentJoinCountsByMeetupId?.[meetup.id] ?? 0);
  const popularity = calculateMeetupPopularity(meetup, context).total;
  const landmarkPopularity = meetup.landmarkId
    ? context.landmarkPopularityById?.[meetup.landmarkId] ?? 0
    : 0;

  if (friends >= 2 || meetup.type === 'friends') return 'Friends Gathering';
  if (
    remaining !== null
    && remaining > 0
    && meetup.maxAttendees !== undefined
    && remaining / meetup.maxAttendees <= 0.2
  ) return 'Filling Fast';
  if (recentJoins >= 4 || popularity >= 70) return 'Trending';
  if (meetup.type === 'official') return 'Official Meetup';
  if (attendeeCount(meetup) >= 10 || landmarkPopularity >= 0.75) return 'Community Favorite';

  const createdTimestamp = Date.parse(meetup.createdAt);
  const ageHours = (now.getTime() - createdTimestamp) / MILLISECONDS_PER_HOUR;
  if (Number.isFinite(ageHours) && ageHours >= 0 && ageHours <= 72) return 'New Meetup';
  return null;
}
