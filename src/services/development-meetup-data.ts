import type {
  ApprovedLandmark,
  ApprovedLandmarkKind,
  Meetup,
  MeetupCategory,
} from '@/types/meetups';

/** Marks records that exist only to preview Stage 2 during development. */
export type DevelopmentTestRecord<T> = T & {
  readonly isTestData: true;
};

export type DevelopmentApprovedLandmark = DevelopmentTestRecord<ApprovedLandmark>;

export type DevelopmentMeetup = DevelopmentTestRecord<Meetup> & {
  readonly attendeeCount: number;
  readonly friendAttendeeCount: number;
  /** These fake IDs show how friend attendance will look without using real accounts. */
  readonly sampleFriendIds: readonly string[];
};

/** Lists the approved public-place kinds supported by each meetup category. */
export const APPROVED_LANDMARK_KINDS_BY_CATEGORY: Readonly<
  Record<MeetupCategory, readonly ApprovedLandmarkKind[]>
> = {
  adventure: [
    'public_park',
    'beach',
    'waterfront',
    'hiking_trail_entrance',
    'scenic_overlook',
    'botanical_garden',
  ],
  games: [
    'dave_and_busters',
    'scandia',
    'arcade',
    'bowling_alley',
    'mini_golf',
    'laser_tag',
    'escape_room',
    'roller_skating_rink',
    'ice_skating_rink',
    'trampoline_park',
    'go_kart_venue',
  ],
  shopping: [
    'mall',
    'premium_outlet',
    'nike_factory_store',
    'shopping_district',
    'farmers_market',
    'thrift_shopping_area',
  ],
  culture: [
    'museum',
    'art_gallery',
    'public_library',
    'zoo',
    'aquarium',
    'public_plaza',
    'street_art_district',
    'outdoor_movie_location',
    'festival',
  ],
  food: [
    'coffee_shop',
    'food_hall',
    'food_truck_event',
    'picnic_area',
    'community_garden',
  ],
  fitness: [
    'recreation_center',
    'basketball_court',
    'skate_park',
    'climbing_gym',
    'outdoor_fitness_area',
  ],
};

/** Returns true only inside a React Native development bundle. */
function developmentTestDataIsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/** Creates an ISO time today without depending on a real user or database record. */
function testTimeToday(hour: number, minute = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** Builds approved landmark previews only after the development guard succeeds. */
function buildDevelopmentLandmarks(): DevelopmentApprovedLandmark[] {
  return [
    {
      id: 'test-landmark-scandia',
      name: '[TEST DATA] Scandia Family Fun Center',
      category: 'games',
      kind: 'scandia',
      latitude: 38.2205,
      longitude: -122.1274,
      address: 'TEST public venue coordinate',
      city: 'Fairfield, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
    {
      id: 'test-landmark-waterfront',
      name: '[TEST DATA] Public Waterfront Promenade',
      category: 'adventure',
      kind: 'waterfront',
      latitude: 38.2382,
      longitude: -122.0402,
      address: 'TEST public waterfront meeting point',
      city: 'Suisun City, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
    {
      id: 'test-landmark-premium-outlets',
      name: '[TEST DATA] Premium Outlet Public Entrance',
      category: 'shopping',
      kind: 'premium_outlet',
      latitude: 38.3668,
      longitude: -121.9558,
      address: 'TEST public shopping entrance',
      city: 'Vacaville, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
    {
      id: 'test-landmark-arcade',
      name: '[TEST DATA] Public Arcade Entrance',
      category: 'games',
      kind: 'arcade',
      latitude: 38.2606,
      longitude: -122.0542,
      address: 'TEST public arcade meeting point',
      city: 'Fairfield, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
    {
      id: 'test-landmark-community-park',
      name: '[TEST DATA] Community Park Information Board',
      category: 'adventure',
      kind: 'public_park',
      latitude: 38.4484,
      longitude: -121.8272,
      address: 'TEST public park meeting point',
      city: 'Dixon, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
    {
      id: 'test-landmark-mall',
      name: '[TEST DATA] Mall Public Plaza',
      category: 'shopping',
      kind: 'mall',
      latitude: 38.2588,
      longitude: -122.0657,
      address: 'TEST public mall entrance',
      city: 'Fairfield, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
    {
      id: 'test-landmark-library',
      name: '[TEST DATA] Public Library Plaza',
      category: 'culture',
      kind: 'public_library',
      latitude: 38.4458,
      longitude: -121.8231,
      address: 'TEST public library meeting point',
      city: 'Dixon, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
    {
      id: 'test-landmark-coffee',
      name: '[TEST DATA] Coffee Shop Public Patio',
      category: 'food',
      kind: 'coffee_shop',
      latitude: 38.4571,
      longitude: -121.8414,
      address: 'TEST public patio meeting point',
      city: 'Dixon, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
    {
      id: 'test-landmark-recreation-center',
      name: '[TEST DATA] Recreation Center Entrance',
      category: 'fitness',
      kind: 'recreation_center',
      latitude: 38.4512,
      longitude: -121.8299,
      address: 'TEST public recreation entrance',
      city: 'Dixon, CA',
      isVerified: true,
      isActive: true,
      isTestData: true,
    },
  ];
}

/** Returns sample landmarks in development and an empty list in production. */
export function getDevelopmentApprovedLandmarks(): readonly DevelopmentApprovedLandmark[] {
  if (!developmentTestDataIsEnabled()) return [];
  return buildDevelopmentLandmarks();
}

/** Builds sample meetup previews without writing attendees, XP, missions, or relics. */
function buildDevelopmentMeetups(): DevelopmentMeetup[] {
  const createdAt = testTimeToday(6);
  return [
    {
      id: 'test-meetup-scandia-adventure',
      title: '[TEST DATA] Scandia Adventure Meetup',
      description: 'TEST DATA ONLY — Meet at the public entrance for games and a social walk.',
      type: 'community',
      category: 'games',
      landmarkId: 'test-landmark-scandia',
      landmarkName: '[TEST DATA] Scandia Family Fun Center',
      latitude: 38.2205,
      longitude: -122.1274,
      address: 'TEST public venue coordinate',
      startTime: testTimeToday(10),
      endTime: testTimeToday(12),
      organizerId: 'test-organizer-games',
      attendeeIds: ['test-friend-alex', 'test-friend-riley', 'test-attendee-01'],
      invitedUserIds: ['test-friend-jordan'],
      attendeeCount: 3,
      friendAttendeeCount: 2,
      sampleFriendIds: ['test-friend-alex', 'test-friend-riley'],
      maxAttendees: 12,
      isVerified: true,
      isCancelled: false,
      featuredRelicId: 'test-relic-arcade-spark',
      bonusXp: 50,
      createdAt,
      isTestData: true,
    },
    {
      id: 'test-meetup-waterfront-sunset',
      title: '[TEST DATA] Waterfront Sunset Walk',
      description: 'TEST DATA ONLY — A public waterfront walking preview.',
      type: 'official',
      category: 'adventure',
      landmarkId: 'test-landmark-waterfront',
      landmarkName: '[TEST DATA] Public Waterfront Promenade',
      latitude: 38.2382,
      longitude: -122.0402,
      address: 'TEST public waterfront meeting point',
      startTime: testTimeToday(18),
      endTime: testTimeToday(19, 30),
      organizerId: 'test-organizer-official',
      attendeeIds: ['test-friend-maya', 'test-attendee-02', 'test-attendee-03'],
      attendeeCount: 3,
      friendAttendeeCount: 1,
      sampleFriendIds: ['test-friend-maya'],
      maxAttendees: 20,
      isVerified: true,
      isCancelled: false,
      linkedMissionId: 'test-mission-sunset-mile',
      bonusXp: 75,
      createdAt,
      isTestData: true,
    },
    {
      id: 'test-meetup-premium-outlet',
      title: '[TEST DATA] Premium Outlet Explorer Meetup',
      description: 'TEST DATA ONLY — Explore public shopping walkways as a group.',
      type: 'friends',
      category: 'shopping',
      landmarkId: 'test-landmark-premium-outlets',
      landmarkName: '[TEST DATA] Premium Outlet Public Entrance',
      latitude: 38.3668,
      longitude: -121.9558,
      address: 'TEST public shopping entrance',
      startTime: testTimeToday(11),
      endTime: testTimeToday(13),
      organizerId: 'test-organizer-shopping',
      attendeeIds: ['test-friend-sam', 'test-friend-taylor'],
      invitedUserIds: ['test-friend-casey'],
      attendeeCount: 2,
      friendAttendeeCount: 2,
      sampleFriendIds: ['test-friend-sam', 'test-friend-taylor'],
      maxAttendees: 8,
      isVerified: true,
      isCancelled: false,
      linkedMissionId: 'test-mission-outlet-steps',
      createdAt,
      isTestData: true,
    },
    {
      id: 'test-meetup-arcade-relic',
      title: '[TEST DATA] Arcade and Relic Hunt',
      description: 'TEST DATA ONLY — Relic and XP values are display previews, not awards.',
      type: 'community',
      category: 'games',
      landmarkId: 'test-landmark-arcade',
      landmarkName: '[TEST DATA] Public Arcade Entrance',
      latitude: 38.2606,
      longitude: -122.0542,
      address: 'TEST public arcade meeting point',
      startTime: testTimeToday(15),
      endTime: testTimeToday(17),
      organizerId: 'test-organizer-arcade',
      attendeeIds: ['test-friend-devon', 'test-attendee-04', 'test-attendee-05', 'test-attendee-06'],
      attendeeCount: 4,
      friendAttendeeCount: 1,
      sampleFriendIds: ['test-friend-devon'],
      maxAttendees: 16,
      isVerified: true,
      isCancelled: false,
      featuredRelicId: 'test-relic-neon-token',
      bonusXp: 100,
      createdAt,
      isTestData: true,
    },
    {
      id: 'test-meetup-park-circle',
      title: '[TEST DATA] Community Park Walking Circle',
      description: 'TEST DATA ONLY — A relaxed walking-circle preview at a public park.',
      type: 'community',
      category: 'fitness',
      landmarkId: 'test-landmark-community-park',
      landmarkName: '[TEST DATA] Community Park Information Board',
      latitude: 38.4484,
      longitude: -121.8272,
      address: 'TEST public park meeting point',
      startTime: testTimeToday(8),
      endTime: testTimeToday(9),
      organizerId: 'test-organizer-walking',
      attendeeIds: ['test-friend-jules', 'test-friend-avery', 'test-attendee-07'],
      attendeeCount: 3,
      friendAttendeeCount: 2,
      sampleFriendIds: ['test-friend-jules', 'test-friend-avery'],
      maxAttendees: 14,
      isVerified: true,
      isCancelled: false,
      linkedMissionId: 'test-mission-park-mile',
      bonusXp: 40,
      createdAt,
      isTestData: true,
    },
    {
      id: 'test-meetup-mall-steps',
      title: '[TEST DATA] Mall Step Challenge',
      description: 'TEST DATA ONLY — Steps must still be verified; this record cannot award XP.',
      type: 'official',
      category: 'fitness',
      landmarkId: 'test-landmark-mall',
      landmarkName: '[TEST DATA] Mall Public Plaza',
      latitude: 38.2588,
      longitude: -122.0657,
      address: 'TEST public mall entrance',
      startTime: testTimeToday(9),
      endTime: testTimeToday(11),
      organizerId: 'test-organizer-fitness',
      attendeeIds: ['test-friend-morgan', 'test-attendee-08', 'test-attendee-09'],
      attendeeCount: 3,
      friendAttendeeCount: 1,
      sampleFriendIds: ['test-friend-morgan'],
      maxAttendees: 18,
      isVerified: true,
      isCancelled: false,
      linkedMissionId: 'test-mission-mall-steps',
      featuredRelicId: 'test-relic-step-circuit',
      bonusXp: 80,
      createdAt,
      isTestData: true,
    },
  ];
}

/** Returns sample meetups in development and an empty list in production. */
export function getDevelopmentMeetupsToday(): readonly DevelopmentMeetup[] {
  if (!developmentTestDataIsEnabled()) return [];
  return buildDevelopmentMeetups();
}
