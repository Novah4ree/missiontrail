import type { TrailSearchCoordinate } from '@/types/trails';

/**
 * Controls who creates and can discover a meetup.
 *
 * - official: A public Mission Trails event created or approved by the app team.
 * - community: A public user-created event that can be discovered by the community.
 * - friends: A friends-only event visible to its organizer and invited friends.
 */
export type MeetupType =
  | 'official'
  | 'community'
  | 'friends';

/** The activity group used to organize meetup discovery and filtering. */
export type MeetupCategory =
  | 'adventure'
  | 'games'
  | 'shopping'
  | 'culture'
  | 'food'
  | 'fitness';

/** The specific kind of public place that may be reviewed as a meetup landmark. */
export type ApprovedLandmarkKind =
  | 'public_park'
  | 'beach'
  | 'waterfront'
  | 'hiking_trail_entrance'
  | 'scenic_overlook'
  | 'botanical_garden'
  | 'dave_and_busters'
  | 'scandia'
  | 'arcade'
  | 'bowling_alley'
  | 'mini_golf'
  | 'laser_tag'
  | 'escape_room'
  | 'roller_skating_rink'
  | 'ice_skating_rink'
  | 'trampoline_park'
  | 'go_kart_venue'
  | 'mall'
  | 'premium_outlet'
  | 'nike_factory_store'
  | 'shopping_district'
  | 'farmers_market'
  | 'thrift_shopping_area'
  | 'museum'
  | 'art_gallery'
  | 'public_library'
  | 'zoo'
  | 'aquarium'
  | 'public_plaza'
  | 'street_art_district'
  | 'outdoor_movie_location'
  | 'festival'
  | 'coffee_shop'
  | 'food_hall'
  | 'food_truck_event'
  | 'picnic_area'
  | 'community_garden'
  | 'recreation_center'
  | 'basketball_court'
  | 'skate_park'
  | 'climbing_gym'
  | 'outdoor_fitness_area';

/** All meetup visibility values accepted from storage or an API response. */
export const MEETUP_TYPES: readonly MeetupType[] = [
  'official',
  'community',
  'friends',
];

/** All meetup category values accepted from storage or an API response. */
export const MEETUP_CATEGORIES: readonly MeetupCategory[] = [
  'adventure',
  'games',
  'shopping',
  'culture',
  'food',
  'fitness',
];

const meetupTypeValues: ReadonlySet<string> = new Set(MEETUP_TYPES);
const meetupCategoryValues: ReadonlySet<string> = new Set(MEETUP_CATEGORIES);

/** Safely checks an unknown API value before using it as a MeetupType. */
export function isMeetupType(value: unknown): value is MeetupType {
  return typeof value === 'string' && meetupTypeValues.has(value);
}

/** Safely checks an unknown API value before using it as a MeetupCategory. */
export function isMeetupCategory(value: unknown): value is MeetupCategory {
  return typeof value === 'string' && meetupCategoryValues.has(value);
}

/**
 * A scheduled social activity at an approved public meeting point.
 * Coordinates describe the public landmark, never an attendee's live location.
 */
export type Meetup = TrailSearchCoordinate & {
  id: string;
  title: string;
  description?: string;
  type: MeetupType;
  category: MeetupCategory;
  landmarkId?: string;
  landmarkName: string;
  address?: string;
  imageUrl?: string;
  startTime: string;
  endTime: string;
  organizerId: string;
  attendeeIds: string[];
  invitedUserIds?: string[];
  maxAttendees?: number;
  minimumAge?: number;
  isVerified: boolean;
  isCancelled: boolean;
  linkedMissionId?: string;
  featuredRelicId?: string;
  bonusXp?: number;
  badgeId?: string;
  createdAt: string;
};

/** A reviewed public place where a meetup is allowed to be scheduled. */
export type ApprovedLandmark = TrailSearchCoordinate & {
  id: string;
  name: string;
  category: MeetupCategory;
  kind?: ApprovedLandmarkKind;
  address?: string;
  city?: string;
  imageUrl?: string;
  isVerified: boolean;
  isActive: boolean;
};
