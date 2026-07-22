import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allRequiredMissionsComplete,
  calculateEarnedEligibility,
  getSafeLocalDate,
  LEGENDARY_DISTANCE_METERS,
  RARE_DISTANCE_METERS,
  rangesOverlap,
  validateGpsSamples,
  type GpsSample,
} from './daily-verification.ts';

const serverNow = new Date('2026-07-19T20:00:00.000Z');

function samples(overrides: Partial<GpsSample> = {}): GpsSample[] {
  return [
    {
      sampleId: 'one', latitude: 37, longitude: -122, accuracyMeters: 5,
      capturedAt: '2026-07-19T19:59:40.000Z', movementKind: 'walking', ...overrides,
    },
    {
      sampleId: 'two', latitude: 37.0001, longitude: -122, accuracyMeters: 5,
      capturedAt: '2026-07-19T19:59:50.000Z', movementKind: 'walking', ...overrides,
    },
  ];
}

test('Rare is earned at exactly five miles and not below it', () => {
  assert.equal(calculateEarnedEligibility(RARE_DISTANCE_METERS - 0.001, false).rareEarned, false);
  assert.equal(calculateEarnedEligibility(RARE_DISTANCE_METERS, false).rareEarned, true);
});

test('Legendary is earned at exactly ten miles and not below it', () => {
  assert.equal(
    calculateEarnedEligibility(LEGENDARY_DISTANCE_METERS - 0.001, false).legendaryEarned,
    false,
  );
  assert.equal(calculateEarnedEligibility(LEGENDARY_DISTANCE_METERS, false).legendaryEarned, true);
});

test('all required missions override both thresholds', () => {
  assert.deepEqual(calculateEarnedEligibility(0, true), {
    rareEarned: true,
    legendaryEarned: true,
    reason: 'daily_missions',
  });
  assert.equal(calculateEarnedEligibility(0, false).legendaryEarned, false);
});

test('partial required missions do not unlock and optional missions are excluded', () => {
  assert.equal(allRequiredMissionsComplete([
    { required: true, completed: true },
    { required: true, completed: false },
    { required: false, completed: true },
  ]), false);
  assert.equal(allRequiredMissionsComplete([
    { required: true, completed: true },
    { required: false, completed: false },
  ]), true);
});

test('valid offline walking segments are validated before counting', () => {
  const result = validateGpsSamples(samples(), { serverNow });
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 0);
});

test('driving and cycling never count', () => {
  for (const movementKind of ['driving', 'cycling'] as const) {
    const result = validateGpsSamples(samples({ movementKind }), { serverNow });
    assert.equal(result.accepted.length, 0);
    assert.equal(result.rejected[0].code, 'UNSUPPORTED_MOVEMENT');
  }
});

test('inaccurate, speeding, and teleporting GPS segments never count', () => {
  assert.equal(validateGpsSamples(samples({ accuracyMeters: 30 }), { serverNow }).accepted.length, 0);
  assert.equal(
    validateGpsSamples(samples({ reportedSpeedMetersPerSecond: 10 }), { serverNow }).rejected[0].code,
    'SPEED_TOO_HIGH',
  );
  const teleported = samples();
  teleported[1] = { ...teleported[1], latitude: 37.02 };
  assert.equal(validateGpsSamples(teleported, { serverNow }).rejected[0].code, 'GPS_TELEPORT');
});

test('overlapping health and GPS time ranges are detectable for deduplication', () => {
  assert.equal(
    rangesOverlap(
      { startedAt: '2026-07-19T10:00:00Z', endedAt: '2026-07-19T10:30:00Z' },
      { startedAt: '2026-07-19T10:15:00Z', endedAt: '2026-07-19T10:45:00Z' },
    ),
    true,
  );
});

test('local days handle DST and safely fall back to UTC', () => {
  assert.deepEqual(getSafeLocalDate(new Date('2026-03-08T07:30:00Z'), 'America/Los_Angeles'), {
    localDate: '2026-03-07', timezone: 'America/Los_Angeles',
  });
  assert.deepEqual(getSafeLocalDate(new Date('2026-03-08T10:30:00Z'), 'America/Los_Angeles'), {
    localDate: '2026-03-08', timezone: 'America/Los_Angeles',
  });
  assert.deepEqual(getSafeLocalDate(new Date('2026-07-19T01:00:00Z'), 'Not/A_Zone'), {
    localDate: '2026-07-19', timezone: 'UTC',
  });
});
