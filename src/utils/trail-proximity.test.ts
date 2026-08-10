import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatTrailheadProximityRadius,
  getActiveTrailTransition,
  isActiveTrailCurrent,
  isTrailNearUser,
  isWithinMissionStepRange,
} from './trail-proximity.ts';

const origin = { latitude: 32.8328, longitude: -117.0424 };

test('nearby discovery includes local trails and rejects distant trails', () => {
  assert.equal(isTrailNearUser(origin, { latitude: 32.84, longitude: -117.03 }), true);
  assert.equal(isTrailNearUser(origin, { latitude: 33.40, longitude: -117.60 }), false);
});

test('mission steps qualify only inside the destination radius', () => {
  assert.equal(
    isWithinMissionStepRange(origin, { latitude: 32.835, longitude: -117.0424 }),
    true,
  );
  assert.equal(
    isWithinMissionStepRange(origin, { latitude: 32.84, longitude: -117.0424 }),
    false,
  );
  assert.equal(
    isWithinMissionStepRange(origin, { latitude: 32.835, longitude: -117.0424 }, 400),
    false,
  );
  assert.match(formatTrailheadProximityRadius(), /^(\d+ ft|\d+\.\d{2} mi)$/);
});

test('destination gating expires after the navigation window', () => {
  const now = new Date('2026-07-29T18:00:00.000Z');
  const activity = {
    trail: {
      id: 'trail',
      name: 'Trail',
      latitude: origin.latitude,
      longitude: origin.longitude,
      distanceMiles: 0,
      category: 'trail' as const,
      source: 'mission_trails' as const,
    },
    startedAt: '2026-07-29T17:00:00.000Z',
  };
  assert.equal(isActiveTrailCurrent(activity, now), true);
  assert.equal(
    isActiveTrailCurrent(
      { ...activity, startedAt: '2026-07-28T17:00:00.000Z' },
      now,
    ),
    false,
  );
});

test('one active trail must be resumed, explicitly switched, or allowed to expire', () => {
  const now = new Date('2026-08-09T20:00:00.000Z');
  const active = {
    trail: {
      id: 'copper-alley',
      name: 'Copper Alley',
      latitude: origin.latitude,
      longitude: origin.longitude,
      distanceMiles: 0,
      category: 'trail' as const,
      source: 'mission_trails' as const,
    },
    startedAt: '2026-08-09T19:00:00.000Z',
  };

  assert.equal(getActiveTrailTransition(active, 'copper-alley', false, now), 'resume');
  assert.equal(getActiveTrailTransition(active, 'new-trail', false, now), 'conflict');
  assert.equal(getActiveTrailTransition(active, 'new-trail', true, now), 'switch');
  assert.equal(
    getActiveTrailTransition(active, 'new-trail', false, new Date('2026-08-10T12:00:00.000Z')),
    'start',
  );
});
