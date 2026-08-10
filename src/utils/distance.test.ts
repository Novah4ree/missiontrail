import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateDistanceMeters, formatDistanceMiles, formatGeographicDistance } from './distance.ts';

test('Haversine distance uses the supplied origin and destination', () => {
  const meters = calculateDistanceMeters(
    { latitude: 38.4455, longitude: -121.8233 },
    { latitude: 38.5816, longitude: -121.4944 },
  );
  assert.ok(meters > 32_000 && meters < 33_000);

  const antipodalMeters = calculateDistanceMeters(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 180 },
  );
  assert.ok(Number.isFinite(antipodalMeters));
});

test('coordinate distances use feet nearby and miles farther away', () => {
  assert.equal(formatGeographicDistance(30), '98 ft');
  assert.equal(formatGeographicDistance(2_253), '1.4 mi');
  assert.equal(formatGeographicDistance(Number.NaN), 'Distance unavailable');
});

test('mile distances are formatted for nearby-result UI', () => {
  assert.equal(formatDistanceMiles(0.24), '0.2 mi');
  assert.equal(formatDistanceMiles(1.36), '1.4 mi');
  assert.equal(formatDistanceMiles(7.84), '7.8 mi');
  assert.equal(formatDistanceMiles(0.02), '<0.1 mi');
  assert.equal(formatDistanceMiles(Number.NaN), 'Distance unavailable');
});
