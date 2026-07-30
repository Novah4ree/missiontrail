import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeGeoapifyPlaces,
  normalizeGeoapifyRoute,
  normalizeOverpassPlaces,
} from './trail-normalization.ts';

test('OpenStreetMap nodes and area centers are normalized and sorted by distance', () => {
  const trails = normalizeOverpassPlaces([
    {
      type: 'way',
      id: 22,
      center: { lat: 37.02, lon: -122 },
      tags: { name: 'Far Park', leisure: 'park' },
    },
    {
      type: 'node',
      id: 11,
      lat: 37.001,
      lon: -122,
      tags: { name: 'Near Trailhead', information: 'trailhead' },
    },
  ], { latitude: 37, longitude: -122 });

  assert.deepEqual(trails.map((trail) => trail.id), ['node:11', 'way:22']);
  assert.equal(trails[0].category, 'trailhead');
  assert.equal(trails[1].category, 'park');
  assert.equal(trails[0].source, 'openstreetmap');
});

test('OpenStreetMap trails require a name and valid coordinates', () => {
  const trails = normalizeOverpassPlaces([
    { type: 'way', id: 1, center: { lat: 37, lon: -122 }, tags: { highway: 'path' } },
    { type: 'way', id: 2, center: { lat: 100, lon: -122 }, tags: { name: 'Invalid' } },
    { type: 'way', id: 3, center: { lat: 37, lon: -122 }, tags: { name: 'Valid', highway: 'path' } },
  ], { latitude: 37, longitude: -122 });

  assert.deepEqual(trails.map((trail) => trail.name), ['Valid']);
  assert.equal(trails[0].category, 'trail');
});

test('repeated OpenStreetMap segments become one nearby trail result', () => {
  const trails = normalizeOverpassPlaces([
    { type: 'way', id: 1, center: { lat: 37.02, lon: -122 }, tags: { name: 'Loop Trail', highway: 'path' } },
    { type: 'way', id: 2, center: { lat: 37.001, lon: -122 }, tags: { name: 'Loop Trail', highway: 'path' } },
  ], { latitude: 37, longitude: -122 });

  assert.equal(trails.length, 1);
  assert.equal(trails[0].id, 'way:2');
});

test('OpenStreetMap accessibility, address, and explicit hiking grade are preserved', () => {
  const [trail] = normalizeOverpassPlaces([
    {
      type: 'relation',
      id: 44,
      center: { lat: 37, lon: -122 },
      tags: {
        name: 'Accessible Reserve',
        boundary: 'protected_area',
        wheelchair: 'yes',
        sac_scale: 'mountain_hiking',
        'addr:street': 'Park Road',
        'addr:city': 'Fairfield',
      },
    },
  ], { latitude: 37, longitude: -122 });

  assert.equal(trail.category, 'nature_reserve');
  assert.equal(trail.accessibility, 'Wheelchair access: yes');
  assert.equal(trail.address, 'Park Road, Fairfield');
  assert.equal(trail.difficulty, 'moderate');
});

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
