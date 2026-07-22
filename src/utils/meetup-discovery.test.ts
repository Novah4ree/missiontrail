import assert from 'node:assert/strict';
import test from 'node:test';

import type { Meetup } from '../types/meetups.ts';
import {
  calculateMeetupDistanceMiles,
  calculateMeetupPopularity,
  calculateRemainingCapacity,
  determineMeetupStatusLabel,
  filterMeetups,
  filterMeetupsByRadius,
  sortMeetupsByRelevance,
} from './meetup-discovery.ts';

const NOW = new Date('2026-07-21T12:00:00-07:00');
const USER_LOCATION = { latitude: 38.4455, longitude: -121.8233 };

/** Creates a complete meetup while allowing each test to change only relevant fields. */
function makeMeetup(overrides: Partial<Meetup> = {}): Meetup {
  return {
    id: 'meetup-base',
    title: 'Test Meetup',
    type: 'community',
    category: 'adventure',
    landmarkId: 'landmark-base',
    landmarkName: 'Public Test Landmark',
    latitude: 38.4455,
    longitude: -121.8233,
    startTime: '2026-07-21T15:00:00-07:00',
    endTime: '2026-07-21T17:00:00-07:00',
    organizerId: 'organizer-1',
    attendeeIds: [],
    maxAttendees: 10,
    isVerified: false,
    isCancelled: false,
    createdAt: '2026-07-20T12:00:00-07:00',
    ...overrides,
  };
}

test('distance reuses Haversine miles and safely rejects missing coordinates', () => {
  assert.equal(calculateMeetupDistanceMiles(USER_LOCATION, USER_LOCATION), 0);
  assert.equal(calculateMeetupDistanceMiles(null, USER_LOCATION), null);
  assert.equal(calculateMeetupDistanceMiles(USER_LOCATION, { latitude: null, longitude: -121 }), null);
});

test('radius filters include the boundary and exclude unknown locations', () => {
  const nearby = makeMeetup({ id: 'nearby' });
  const aboutSixMilesAway = makeMeetup({ id: 'far', latitude: 38.5324 });
  assert.deepEqual(filterMeetupsByRadius([nearby, aboutSixMilesAway], USER_LOCATION, 5).map(({ id }) => id), ['nearby']);
  assert.deepEqual(filterMeetupsByRadius([nearby], null, 10), []);
});

test('remaining capacity handles duplicate attendees, full events, and unlimited events', () => {
  assert.equal(calculateRemainingCapacity(makeMeetup({ attendeeIds: ['a', 'a', 'b'], maxAttendees: 3 })), 1);
  assert.equal(calculateRemainingCapacity(makeMeetup({ attendeeIds: ['a', 'b'], maxAttendees: 1 })), 0);
  assert.equal(calculateRemainingCapacity(makeMeetup({ maxAttendees: undefined })), null);
});

test('popularity favors nearby friend activity instead of attendance alone', () => {
  const nearbyFriends = makeMeetup({ id: 'friends', attendeeIds: ['friend-1', 'friend-2'] });
  const crowdedFarAway = makeMeetup({
    id: 'crowded',
    latitude: 39.5,
    attendeeIds: Array.from({ length: 20 }, (_, index) => `person-${index}`),
    maxAttendees: 30,
  });
  const context = { userLocation: USER_LOCATION, friendUserIds: ['friend-1', 'friend-2'], now: NOW };
  assert.ok(calculateMeetupPopularity(nearbyFriends, context).total > calculateMeetupPopularity(crowdedFarAway, context).total);
  assert.equal(sortMeetupsByRelevance([crowdedFarAway, nearbyFriends], context)[0]?.id, 'friends');
});

test('category, social, official, today, weekend, and cancellation filters work', () => {
  const adventure = makeMeetup({ id: 'adventure', attendeeIds: ['friend-1'] });
  const food = makeMeetup({ id: 'food', category: 'food', type: 'official' });
  const weekend = makeMeetup({ id: 'weekend', startTime: '2026-07-25T10:00:00-07:00' });
  const cancelled = makeMeetup({ id: 'cancelled', isCancelled: true });
  const meetups = [adventure, food, weekend, cancelled];
  const context = { friendUserIds: ['friend-1'], now: NOW };

  assert.deepEqual(filterMeetups(meetups, 'food_and_chill', context).map(({ id }) => id), ['food']);
  assert.deepEqual(filterMeetups(meetups, 'friends_attending', context).map(({ id }) => id), ['adventure']);
  assert.deepEqual(filterMeetups(meetups, 'official_meetups', context).map(({ id }) => id), ['food']);
  assert.deepEqual(filterMeetups(meetups, 'today', context).map(({ id }) => id), ['adventure', 'food']);
  assert.deepEqual(filterMeetups(meetups, 'this_weekend', context).map(({ id }) => id), ['weekend']);
});

test('status labels recognize friends, capacity, trends, official, favorite, and new meetups', () => {
  assert.equal(determineMeetupStatusLabel(makeMeetup({ attendeeIds: ['f1', 'f2'] }), { friendUserIds: ['f1', 'f2'], now: NOW }), 'Friends Gathering');
  assert.equal(determineMeetupStatusLabel(makeMeetup({ attendeeIds: Array.from({ length: 9 }, (_, index) => `${index}`) }), { now: NOW }), 'Filling Fast');
  assert.equal(determineMeetupStatusLabel(makeMeetup(), { recentJoinCountsByMeetupId: { 'meetup-base': 4 }, now: NOW }), 'Trending');
  assert.equal(determineMeetupStatusLabel(makeMeetup({ type: 'official' }), { now: NOW }), 'Official Meetup');
  assert.equal(determineMeetupStatusLabel(makeMeetup({ attendeeIds: Array.from({ length: 10 }, (_, index) => `${index}`), maxAttendees: 20, createdAt: '2026-01-01T12:00:00-08:00' }), { now: NOW }), 'Community Favorite');
  assert.equal(determineMeetupStatusLabel(makeMeetup(), { now: NOW }), 'New Meetup');
});
