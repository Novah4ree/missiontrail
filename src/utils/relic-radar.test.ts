import assert from 'node:assert/strict';
import test from 'node:test';

import {
  describeRelicSignal,
  formatRelicSignalDistance,
  getNearestAvailableRelicSignal,
  getRadarRefreshPolicy,
  getRelicSignalStage,
} from './relic-radar.ts';

test('radar distance uses feet nearby and miles farther away', () => {
  assert.equal(formatRelicSignalDistance(68), '68 FT');
  assert.equal(formatRelicSignalDistance(999.4), '999 FT');
  assert.equal(formatRelicSignalDistance(1_056), '0.2 MI');
  assert.equal(formatRelicSignalDistance(7_392), '1.4 MI');
});

test('signal stages use consistent inclusive boundaries', () => {
  assert.equal(getRelicSignalStage(1_001), 'FAR');
  assert.equal(getRelicSignalStage(1_000), 'CLOSING IN');
  assert.equal(getRelicSignalStage(300), 'NEARBY');
  assert.equal(getRelicSignalStage(100), 'VERY CLOSE');
  assert.equal(getRelicSignalStage(30), 'SIGNAL LOCKED');
});

test('refresh policy becomes responsive without exceeding an eight-second floor', () => {
  assert.deepEqual(getRadarRefreshPolicy(2_000), {
    intervalMs: 25_000,
    movementMeters: 25,
  });
  assert.deepEqual(getRadarRefreshPolicy(20), {
    intervalMs: 8_000,
    movementMeters: 3,
  });
});

test('ambient accessibility copy avoids fake directional navigation', () => {
  const description = describeRelicSignal({
    assignmentId: 'opaque-assignment',
    distanceFeet: 12,
    bearingDegrees: null,
    direction: null,
    clueStrength: 3,
    availability: 'available',
    encounterType: 'ambient',
  });
  assert.match(description, /all around you/);
});

test('auto nearest selects the closest available assignment and skips locked rows', () => {
  const nearest = getNearestAvailableRelicSignal([
    {
      assignmentId: 'locked-nearest',
      distanceFeet: 10,
      bearingDegrees: 0,
      direction: 'N',
      clueStrength: 3,
      availability: 'locked',
      encounterType: 'neighborhood',
    },
    {
      assignmentId: 'available-farther',
      distanceFeet: 240,
      bearingDegrees: 90,
      direction: 'E',
      clueStrength: 2,
      availability: 'available',
      encounterType: 'local',
    },
    {
      assignmentId: 'available-nearest',
      distanceFeet: 72,
      bearingDegrees: 315,
      direction: 'NW',
      clueStrength: 3,
      availability: 'available',
      encounterType: 'neighborhood',
    },
  ]);

  assert.equal(nearest?.assignmentId, 'available-nearest');
  assert.equal(getNearestAvailableRelicSignal([]), null);
});
