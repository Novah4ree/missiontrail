import assert from 'node:assert/strict';
import test from 'node:test';

import { createTrailNavigationPlan, getTrailNavigationUrl } from './trail-navigation.ts';

const DIXON_TRAIL = { latitude: 38.4455, longitude: -121.8233 };
const DIXON_USER = { latitude: 38.46, longitude: -121.81 };

test('Google walking directions use the selected Dixon-area trail destination', () => {
  const url = getTrailNavigationUrl('other', 'Dixon Trail', DIXON_TRAIL, DIXON_USER);
  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1&destination=38.4455,-121.8233&origin=38.46,-121.81&travelmode=walking&dir_action=navigate',
  );
  assert.doesNotMatch(url ?? '', /37\.7749|-122\.4194/);
});

test('Apple walking directions encode the trail name and preserve its coordinates', () => {
  const url = getTrailNavigationUrl('ios', 'Dixon Ridge & Creek', DIXON_TRAIL, DIXON_USER);
  assert.equal(
    url,
    'https://maps.apple.com/?daddr=38.4455,-121.8233&saddr=38.46,-121.81&q=Dixon%20Ridge%20%26%20Creek&dirflg=w',
  );
});

test('invalid selected-trail destinations cannot produce a navigation URL', () => {
  assert.equal(getTrailNavigationUrl('ios', 'Invalid', { latitude: 91, longitude: 0 }), null);
  assert.equal(getTrailNavigationUrl('other', 'Invalid', { latitude: 0, longitude: 0 }), null);
});

test('navigation plan uses GPS as origin and explicit trailhead as destination', () => {
  const plan = createTrailNavigationPlan({
    id: 'dixon-creek',
    name: 'Dixon Creek Trail',
    latitude: 38.44,
    longitude: -121.82,
    trailheadLatitude: 38.4455,
    trailheadLongitude: -121.8233,
  }, { latitude: 38.46, longitude: -121.81 });

  assert.deepEqual(plan?.origin, { latitude: 38.46, longitude: -121.81 });
  assert.deepEqual(plan?.destination, DIXON_TRAIL);
  assert.ok((plan?.distanceMiles ?? 0) > 0);
});

test('navigation plan falls back only to the selected trail point', () => {
  const plan = createTrailNavigationPlan({
    id: 'dixon-park',
    name: 'Dixon Park',
    latitude: DIXON_TRAIL.latitude,
    longitude: DIXON_TRAIL.longitude,
    trailheadLatitude: Number.NaN,
    trailheadLongitude: Number.NaN,
  });

  assert.deepEqual(plan?.destination, DIXON_TRAIL);
  assert.equal(plan?.origin, null);
  assert.equal(plan?.distanceMiles, null);
});

test('navigation plan blocks trails without valid selected-trail coordinates', () => {
  assert.equal(createTrailNavigationPlan({
    id: 'missing-location',
    name: 'Missing Location',
    latitude: undefined,
    longitude: undefined,
  }, DIXON_TRAIL), null);
});
