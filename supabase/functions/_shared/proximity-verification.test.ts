import assert from 'node:assert/strict';
import test from 'node:test';

import { destinationPoint } from './spawn-algorithm.ts';
import {
  bearingDegrees,
  distanceInFeet,
  distanceInFeetWhenNearby,
  verifyProximitySamples,
  type ProximitySample,
} from './proximity-verification.ts';

const exact = { latitude: 37, longitude: -122 };
const now = new Date('2026-07-19T20:00:00.000Z');
const options = {
  serverNow: now, targetRadiusMeters: 4.57, fallbackRadiusMeters: 9,
  requiredReadings: 3, maxAccuracyMeters: 12, maxSpeedMetersPerSecond: 8.9408,
  clueBandsMeters: [500, 200, 75] as const,
};

function readings(distance: number, accuracy = 3): ProximitySample[] {
  return [15, 10, 5].map((secondsAgo, index) => ({
    ...destinationPoint(exact, distance, 90), sampleId: `sample-${index}`,
    capturedAt: new Date(now.getTime() - secondsAgo * 1000).toISOString(),
    accuracyMeters: accuracy, speedMetersPerSecond: 0, provider: 'gps', mocked: false,
  }));
}

test('Haversine-backed verification accepts exactly inside the target radius', () => {
  const result = verifyProximitySamples(readings(4.56), exact, options);
  assert.equal(result.status, 'revealed');
  assert.equal(result.radiusUsedMeters, 4.57);
});

test('a reading outside the target radius is not revealed', () => {
  assert.notEqual(verifyProximitySamples(readings(4.58), exact, options).status, 'revealed');
});

test('fallback radius is used only for acceptable fallback accuracy', () => {
  assert.equal(verifyProximitySamples(readings(8.9, 7), exact, options).status, 'revealed');
  assert.equal(verifyProximitySamples(readings(8.9, 7), exact, options).radiusUsedMeters, 9);
  assert.equal(verifyProximitySamples(readings(8.9, 10), exact, options).status, 'improving_accuracy');
});

test('three consecutive readings are required', () => {
  assert.equal(verifyProximitySamples(readings(3).slice(0, 2), exact, options).status, 'invalid_movement');
});

test('stale and out-of-order samples are rejected', () => {
  const stale = readings(3).map((reading) => ({ ...reading, capturedAt: '2026-07-19T19:00:00Z' }));
  assert.equal(verifyProximitySamples(stale, exact, options).rejectionCode, 'STALE_OR_FUTURE');
  const reversed = readings(3).reverse();
  assert.equal(verifyProximitySamples(reversed, exact, options).rejectionCode, 'OUT_OF_ORDER');
});

test('impossible movement and mocked providers are rejected', () => {
  const jumped = readings(3);
  jumped[1] = { ...jumped[1], ...destinationPoint(exact, 500, 0) };
  assert.equal(verifyProximitySamples(jumped, exact, options).status, 'invalid_movement');
  assert.equal(
    verifyProximitySamples(readings(3).map((reading) => ({ ...reading, mocked: true })), exact, options).rejectionCode,
    'MOCKED_LOCATION',
  );
});

test('clue responses expose only a band strength, not directions', () => {
  const result = verifyProximitySamples(readings(150), exact, options);
  assert.equal(result.status, 'approaching');
  assert.equal(result.clueStrength, 2);
  assert.equal('bearing' in result, false);
});

test('nearest relic guidance reports feet and compass bearings', () => {
  assert.equal(distanceInFeet(1.524), 5);
  assert.equal(Math.round(bearingDegrees(exact, destinationPoint(exact, 100, 0))), 0);
  assert.equal(Math.round(bearingDegrees(exact, destinationPoint(exact, 100, 90))), 90);
  assert.equal(Math.round(bearingDegrees(exact, destinationPoint(exact, 100, 180))), 180);
  assert.equal(Math.round(bearingDegrees(exact, destinationPoint(exact, 100, 270))), 270);
});

test('foot distance is disclosed only inside the 10-foot nearby search', () => {
  assert.equal(distanceInFeetWhenNearby(3.048), 10);
  assert.equal(distanceInFeetWhenNearby(1.524), 5);
  assert.equal(distanceInFeetWhenNearby(3.049), null);
  assert.equal(distanceInFeetWhenNearby(null), null);
});
