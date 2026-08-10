import assert from 'node:assert/strict';
import test from 'node:test';

import type { Trail } from '@/types/trails';
import { filterTrails } from './trail-filters.ts';

function makeTrail(overrides: Partial<Trail>): Trail {
  return {
    id: 'trail', name: 'Nearby Trail', latitude: 38.2, longitude: -122.0,
    distanceMiles: 1, category: 'trail', source: 'openstreetmap', activityType: 'hiking',
    city: 'Nearby', imageKey: 'mission-landscape', lengthMiles: 2, estimatedDurationMinutes: 45,
    difficulty: 'easy', terrain: 'Trail', rating: 0, publicAccess: true, status: 'open',
    xpReward: 0, relicsPossible: false, accessible: false, accessibility: 'Not provided.',
    startLocation: 'Entrance', amenities: [], petRules: 'Not provided.', safetyNotes: [],
    ...overrides,
  };
}

test('trail filters constrain category, activity, known length, and accessibility', () => {
  const park = makeTrail({ id: 'park', category: 'park', activityType: 'walking', accessible: true, lengthMiles: 6 });
  const trail = makeTrail({ id: 'trail', category: 'trail', activityType: 'hiking', accessible: false, lengthMiles: 2 });

  assert.deepEqual(filterTrails([park, trail], { selected: ['parks'] }, [], '').map(({ id }) => id), ['park']);
  assert.deepEqual(filterTrails([park, trail], { selected: ['walking', '5_plus', 'accessible'] }, [], '').map(({ id }) => id), ['park']);
  assert.deepEqual(filterTrails([park, trail], { selected: ['hiking', 'easy'] }, [], '').map(({ id }) => id), ['trail']);
});

test('Near Me narrows the provider radius to five miles', () => {
  const near = makeTrail({ id: 'near', distanceMiles: 4.9 });
  const farther = makeTrail({ id: 'farther', distanceMiles: 5.1 });

  assert.deepEqual(
    filterTrails([near, farther], { selected: ['near_me'] }, [], '').map(({ id }) => id),
    ['near'],
  );
});

test('walking and hiking filters use compatible outdoor categories', () => {
  const runningPath = makeTrail({ id: 'running', category: 'walking_path', activityType: 'walking' });
  const natureArea = makeTrail({ id: 'nature', category: 'nature_area', activityType: 'hiking' });

  assert.deepEqual(
    filterTrails([runningPath, natureArea], { selected: ['walking'] }, [], '').map(({ id }) => id),
    ['running'],
  );
  assert.deepEqual(
    filterTrails([runningPath, natureArea], { selected: ['hiking'] }, [], '').map(({ id }) => id),
    ['nature'],
  );
});

test('meetups today shows only trails with a real current-day meetup', () => {
  const trail = makeTrail({ id: 'today' });
  const other = makeTrail({ id: 'other' });
  const today = new Date().toISOString().slice(0, 10);

  assert.deepEqual(
    filterTrails([trail, other], { selected: ['meetups_today'] }, [{
      id: 'meetup', trailId: 'today', title: 'Walk', date: today, startTime: '09:00',
      meetingPoint: 'Entrance', hostName: 'Guide', attendeeCount: 1, maxGroupSize: 4, pace: 'relaxed',
    }], '').map(({ id }) => id),
    ['today'],
  );
});
