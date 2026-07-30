import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampDailySteps,
  estimateActiveCalories,
  getLocalDateKey,
  getLiveMissionProgress,
  metersToMiles,
  reconcilePersistedSteps,
  selectDailyDistance,
  stepsToMeters,
} from './daily-activity-core.ts';
import { getUserDailyStorageKey } from '../services/mission-cache-core.ts';

test('converts steps to meters through the shared stride configuration', () => {
  assert.equal(stepsToMeters(1_000), 762);
});

test('converts meters to miles', () => {
  assert.equal(metersToMiles(1_609.344), 1);
});

test('uses verified GPS instead of adding GPS and estimated step distance', () => {
  assert.deepEqual(selectDailyDistance(2_000, 10_000), {
    meters: 2_000,
    source: 'verified_gps',
  });
  assert.deepEqual(selectDailyDistance(0, 1_000), {
    meters: 762,
    source: 'estimated_steps',
  });
});

test('uses the local calendar date for daily persistence keys', () => {
  const lateLocalTime = new Date(2026, 6, 25, 23, 59, 0);
  const nextLocalDay = new Date(2026, 6, 26, 0, 1, 0);
  assert.equal(getLocalDateKey(lateLocalTime), '2026-07-25');
  assert.equal(getLocalDateKey(nextLocalDay), '2026-07-26');
});

test('isolates persisted activity by user and local date', () => {
  const prefix = 'mission-trail:activity';
  assert.equal(
    getUserDailyStorageKey(prefix, 'user-1', '2026-07-25'),
    'mission-trail:activity:user-1:2026-07-25',
  );
  assert.notEqual(
    getUserDailyStorageKey(prefix, 'user-1', '2026-07-25'),
    getUserDailyStorageKey(prefix, 'user-2', '2026-07-25'),
  );
  assert.notEqual(
    getUserDailyStorageKey(prefix, 'user-1', '2026-07-25'),
    getUserDailyStorageKey(prefix, 'user-1', '2026-07-26'),
  );
});

test('rejects negative changes and caps impossible daily step totals', () => {
  assert.equal(clampDailySteps(-20), 0);
  assert.equal(clampDailySteps(999_999), 100_000);
});

test('calculates clearly defined fallback active calories', () => {
  assert.equal(estimateActiveCalories(2_000), 100);
});

test('updates walking missions from shared activity and clamps at the target', () => {
  const activity = {
    todaySteps: 6_000,
    missionEligibleSteps: 4_500,
    todayDistanceMeters: 2_500,
  };
  assert.equal(getLiveMissionProgress('steps', 4_000, 5_000, activity), 4_500);
  activity.missionEligibleSteps = 6_000;
  assert.equal(getLiveMissionProgress('steps', 4_000, 5_000, activity), 5_000);
  assert.equal(getLiveMissionProgress('distance', 1_000, 3_000, activity), 2_500);
  assert.equal(getLiveMissionProgress('session', 1, 2, activity), 1);
});

test('restores the same local day without carrying yesterday into today', () => {
  const record = { userId: 'user-1', localDate: '2026-07-25', steps: 2_500 };
  assert.equal(reconcilePersistedSteps(record, 'user-1', '2026-07-25'), 2_500);
  assert.equal(reconcilePersistedSteps(record, 'user-1', '2026-07-26'), 0);
  assert.equal(reconcilePersistedSteps(record, 'user-2', '2026-07-25'), 0);
});
