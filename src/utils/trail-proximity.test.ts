import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
