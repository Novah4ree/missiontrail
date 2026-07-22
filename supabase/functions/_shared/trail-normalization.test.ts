import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeGeoapifyPlaces, normalizeGeoapifyRoute } from './trail-normalization.ts';

test('places are normalized and sorted by calculated user distance', () => {
  const trails = normalizeGeoapifyPlaces([
    { geometry: { coordinates: [-122, 37.02] }, properties: { place_id: 'far', name: 'Far Park', categories: ['leisure.park'] } },
    { geometry: { coordinates: [-122, 37.001] }, properties: { place_id: 'near', name: 'Near Path', categories: ['highway.footway'] } },
  ], { latitude: 37, longitude: -122 });
  assert.deepEqual(trails.map((trail) => trail.id), ['near', 'far']);
  assert.equal(trails[0].category, 'walking_path');
  assert.equal(trails[1].category, 'park');
});

test('difficulty is not invented when source data omits it', () => {
  const [trail] = normalizeGeoapifyPlaces([
    { geometry: { coordinates: [-122, 37.001] }, properties: { place_id: 'plain', name: 'Plain Trail', categories: ['highway.path'] } },
  ], { latitude: 37, longitude: -122 });
  assert.equal(trail.difficulty, 'unknown');
  assert.equal(trail.accessibility, undefined);
});

test('explicit hiking grade is mapped to difficulty', () => {
  const [trail] = normalizeGeoapifyPlaces([
    { geometry: { coordinates: [-122, 37.001] }, properties: { place_id: 'graded', categories: ['highway.path'], datasource: { raw: { sac_scale: 'mountain_hiking' } } } },
  ], { latitude: 37, longitude: -122 });
  assert.equal(trail.difficulty, 'moderate');
});

test('route exposes geometry and leaves elevation absent when not returned', () => {
  const route = normalizeGeoapifyRoute({
    geometry: { type: 'MultiLineString', coordinates: [[[-122, 37], [-122.01, 37.01]]] },
    properties: { distance: 1609.344, time: 1800 },
  });
  assert.equal(route.distanceMiles, 1);
  assert.equal(route.durationMinutes, 30);
  assert.equal(route.elevationGainFeet, undefined);
  assert.equal(route.geometry.coordinates.length, 2);
});

test('route calculates gain only from provided elevation values', () => {
  const route = normalizeGeoapifyRoute({
    geometry: { type: 'MultiLineString', coordinates: [[[-122, 37, 100], [-122.01, 37.01, 110], [-122.02, 37.02, 105]]] },
    properties: { distance: 2000, time: 2000 },
  });
  assert.ok(route.elevationGainFeet && route.elevationGainFeet > 32 && route.elevationGainFeet < 33);
});

test('route uses Geoapify leg elevation when it is available', () => {
  const route = normalizeGeoapifyRoute({
    geometry: { type: 'MultiLineString', coordinates: [[[-122, 37], [-122.01, 37.01], [-122.02, 37.02]]] },
    properties: { distance: 2000, time: 2000, legs: [{ elevation: [100, 115, 110] }] },
  });
  assert.ok(route.elevationGainFeet && route.elevationGainFeet > 49 && route.elevationGainFeet < 50);
});
