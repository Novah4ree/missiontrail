import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateTrailGeometryLengthMiles,
  getTrailDestinationCoordinate,
  getValidLineCoordinates,
} from './trail-location.ts';

test('trailhead coordinates take priority over the general trail point', () => {
  assert.deepEqual(getTrailDestinationCoordinate({
    latitude: 38.4,
    longitude: -121.8,
    trailheadLatitude: 38.41,
    trailheadLongitude: -121.81,
  }), { latitude: 38.41, longitude: -121.81 });
});

test('general trail coordinates are used when no valid trailhead point exists', () => {
  assert.deepEqual(getTrailDestinationCoordinate({
    latitude: 38.4,
    longitude: -121.8,
    trailheadLatitude: Number.NaN,
    trailheadLongitude: -121.81,
  }), { latitude: 38.4, longitude: -121.8 });
});

test('invalid trail and trailhead coordinates do not produce a destination', () => {
  assert.equal(getTrailDestinationCoordinate({ latitude: 200, longitude: -121.8 }), null);
});

test('provider geometry length is calculated only from a wholly valid line', () => {
  const geometry = { type: 'LineString' as const, coordinates: [[-121.8, 38.4], [-121.8, 38.41]] as [number, number][] };
  const miles = calculateTrailGeometryLengthMiles(geometry);
  assert.ok(miles && miles > 0.68 && miles < 0.70);
  assert.equal(getValidLineCoordinates({ type: 'LineString', coordinates: [[-121.8, 38.4], [999, 38.41]] }).length, 0);
});
