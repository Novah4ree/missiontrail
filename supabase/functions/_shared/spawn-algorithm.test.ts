import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMysteryZone,
  decodeGeohashCenter,
  distanceMeters,
  encodeGeohash,
  generateDeterministicCandidates,
  getSpawnWindow,
} from './spawn-algorithm.ts';

const SECRET = 'test-only-secret-that-is-long-enough-for-hmac-tests';
const REGION = '9q8yy';
const CENTER = decodeGeohashCenter(REGION);
const SEARCH_RADIUS_METERS = 16_093.44;
const MINIMUM_SPACING_METERS = 250;

test('30-minute window boundaries use half-open server-time intervals', () => {
  const beforeBoundary = getSpawnWindow(new Date('2026-07-19T12:29:59.999Z'));
  const atBoundary = getSpawnWindow(new Date('2026-07-19T12:30:00.000Z'));
  const laterInWindow = getSpawnWindow(new Date('2026-07-19T12:59:59.999Z'));

  assert.notEqual(beforeBoundary.windowId, atBoundary.windowId);
  assert.equal(atBoundary.windowId, laterInWindow.windowId);
  assert.equal(atBoundary.startsAt, '2026-07-19T12:30:00.000Z');
  assert.equal(atBoundary.endsAt, '2026-07-19T13:00:00.000Z');
});

test('grace begins after expiration and is configurable', () => {
  const window = getSpawnWindow(new Date('2026-07-19T12:42:00.000Z'), 30, 180);

  assert.equal(window.endsAt, '2026-07-19T13:00:00.000Z');
  assert.equal(window.graceEndsAt, '2026-07-19T13:03:00.000Z');
});

test('the same secret, region, and window produce identical candidates', async () => {
  const input = {
    secret: SECRET,
    regionGeohash: REGION,
    windowId: '991234',
    center: CENTER,
    count: 6,
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    minimumSpacingMeters: MINIMUM_SPACING_METERS,
  };

  assert.deepEqual(
    await generateDeterministicCandidates(input),
    await generateDeterministicCandidates(input),
  );
});

test('a different window produces different candidates', async () => {
  const base = {
    secret: SECRET,
    regionGeohash: REGION,
    center: CENTER,
    count: 6,
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    minimumSpacingMeters: MINIMUM_SPACING_METERS,
  };

  assert.notDeepEqual(
    await generateDeterministicCandidates({ ...base, windowId: '991234' }),
    await generateDeterministicCandidates({ ...base, windowId: '991235' }),
  );
});

test('a different region produces different candidates', async () => {
  const otherRegion = encodeGeohash({ latitude: 34.0522, longitude: -118.2437 }, 5);

  assert.notDeepEqual(
    await generateDeterministicCandidates({
      secret: SECRET,
      regionGeohash: REGION,
      windowId: '991234',
      center: CENTER,
      count: 6,
      searchRadiusMeters: SEARCH_RADIUS_METERS,
      minimumSpacingMeters: MINIMUM_SPACING_METERS,
    }),
    await generateDeterministicCandidates({
      secret: SECRET,
      regionGeohash: otherRegion,
      windowId: '991234',
      center: decodeGeohashCenter(otherRegion),
      count: 6,
      searchRadiusMeters: SEARCH_RADIUS_METERS,
      minimumSpacingMeters: MINIMUM_SPACING_METERS,
    }),
  );
});

test('every generated candidate stays within 10 miles', async () => {
  const candidates = await generateDeterministicCandidates({
    secret: SECRET,
    regionGeohash: REGION,
    windowId: '991234',
    center: CENTER,
    count: 12,
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    minimumSpacingMeters: MINIMUM_SPACING_METERS,
  });

  for (const candidate of candidates) {
    assert.ok(distanceMeters(CENTER, candidate) <= SEARCH_RADIUS_METERS + 0.001);
  }
});

test('generated candidates obey minimum spacing', async () => {
  const candidates = await generateDeterministicCandidates({
    secret: SECRET,
    regionGeohash: REGION,
    windowId: '991234',
    center: CENTER,
    count: 12,
    searchRadiusMeters: SEARCH_RADIUS_METERS,
    minimumSpacingMeters: MINIMUM_SPACING_METERS,
  });

  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      assert.ok(
        distanceMeters(candidates[left], candidates[right]) >= MINIMUM_SPACING_METERS,
      );
    }
  }
});

test('mystery zones contain but are not centered on the exact point', async () => {
  const exactPoint = { latitude: 37.7749, longitude: -122.4194 };
  const mystery = await createMysteryZone({
    secret: SECRET,
    regionGeohash: REGION,
    windowId: '991234',
    slotIndex: 0,
    exactPoint,
    clueDistanceBandsMeters: [500, 200, 75],
  });
  const offset = distanceMeters(exactPoint, mystery.center);

  assert.ok(offset > 1);
  assert.ok(offset < mystery.radiusMeters);
  assert.notDeepEqual(mystery.center, exactPoint);
  assert.ok([500, 200, 75].includes(mystery.clueBandMeters));
});

