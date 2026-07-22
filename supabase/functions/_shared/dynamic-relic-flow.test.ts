import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allRequiredMissionsComplete,
  calculateEarnedEligibility,
  getSafeLocalDate,
  LEGENDARY_DISTANCE_METERS,
  RARE_DISTANCE_METERS,
} from './daily-verification.ts';
import { verifyProximitySamples, type ProximitySample } from './proximity-verification.ts';
import {
  createMysteryZone,
  decodeGeohashCenter,
  destinationPoint,
  distanceMeters,
  generateDeterministicCandidates,
  getSpawnWindow,
} from './spawn-algorithm.ts';

const SECRET = 'development-only-full-flow-secret-long-enough';
const REGION = '9q8yy';
const SERVER_NOW = new Date('2026-07-19T20:15:00.000Z');
const EXACT = { latitude: 37.7749, longitude: -122.4194 };

function readingsAt(distanceFromRelic: number, accuracyMeters = 3): ProximitySample[] {
  const center = destinationPoint(EXACT, distanceFromRelic, 45);
  return [6_000, 3_000, 0].map((ago, index) => ({
    sampleId: `reading-${distanceFromRelic}-${index}`,
    capturedAt: new Date(SERVER_NOW.getTime() - ago).toISOString(),
    latitude: center.latitude + index * 0.0000002,
    longitude: center.longitude,
    accuracyMeters,
    speedMetersPerSecond: 0.4,
    mocked: false,
  }));
}

const proximityOptions = {
  serverNow: SERVER_NOW,
  targetRadiusMeters: 4.57,
  fallbackRadiusMeters: 9,
  requiredReadings: 3,
  maxAccuracyMeters: 12,
  maxSpeedMetersPerSecond: 8.9408,
  clueBandsMeters: [500, 200, 75] as const,
};

test('development scenario completes the rotating relic journey without duplicate rewards', async () => {
  // 1–2: a normal-tier relic has an offset search area, never an exact marker.
  const currentWindow = getSpawnWindow(SERVER_NOW);
  const candidates = await generateDeterministicCandidates({
    secret: SECRET,
    regionGeohash: REGION,
    windowId: currentWindow.windowId,
    center: decodeGeohashCenter(REGION),
    count: 1,
    searchRadiusMeters: 16_093.44,
    minimumSpacingMeters: 250,
  });
  assert.equal(candidates.length, 1, 'a Common candidate can be assigned for normal play');
  const hiddenArea = await createMysteryZone({
    secret: SECRET,
    regionGeohash: REGION,
    windowId: currentWindow.windowId,
    slotIndex: 0,
    exactPoint: EXACT,
    clueDistanceBandsMeters: [500, 200, 75],
  });
  assert.ok(distanceMeters(hiddenArea.center, EXACT) > 1);
  assert.notDeepEqual(hiddenArea.center, EXACT);

  // 3–5: clues strengthen without directions, poor readings wait, then reveal.
  assert.equal(verifyProximitySamples(readingsAt(450), EXACT, proximityOptions).clueStrength, 1);
  assert.equal(verifyProximitySamples(readingsAt(150), EXACT, proximityOptions).clueStrength, 2);
  assert.equal(verifyProximitySamples(readingsAt(50), EXACT, proximityOptions).clueStrength, 3);
  assert.equal(verifyProximitySamples(readingsAt(3, 13), EXACT, proximityOptions).status, 'improving_accuracy');
  assert.equal(verifyProximitySamples(readingsAt(3), EXACT, proximityOptions).status, 'revealed');

  // 6–7: this mirrors the database transaction contract: token use, Vault row,
  // and XP happen together, while a retry returns the first result.
  const vault = new Set<string>();
  const usedTokens = new Set<string>();
  let xp = 0;
  const collect = (relicId: string, token: string, reward: number) => {
    if (usedTokens.has(token) || vault.has(relicId)) return { wasNew: false, xp };
    usedTokens.add(token);
    vault.add(relicId);
    xp += reward;
    return { wasNew: true, xp };
  };
  assert.deepEqual(collect('ancient-mystical-coin', 'one-time-token', 20), { wasNew: true, xp: 20 });
  assert.equal(vault.has('ancient-mystical-coin'), true);
  assert.deepEqual(collect('ancient-mystical-coin', 'one-time-token', 20), { wasNew: false, xp: 20 });

  // 8–10: exact thresholds and the all-required-missions shortcut.
  assert.equal(calculateEarnedEligibility(RARE_DISTANCE_METERS, false).rareEarned, true);
  assert.equal(calculateEarnedEligibility(LEGENDARY_DISTANCE_METERS, false).legendaryEarned, true);
  const missionOverride = allRequiredMissionsComplete([
    { required: true, completed: true },
    { required: true, completed: true },
    { required: false, completed: false },
  ]);
  assert.equal(calculateEarnedEligibility(0, missionOverride).legendaryEarned, true);

  // 11: server time moves the field at the half-hour boundary.
  const nextWindow = getSpawnWindow(new Date(currentWindow.endsAt));
  assert.notEqual(nextWindow.windowId, currentWindow.windowId);
  assert.notDeepEqual(
    candidates,
    await generateDeterministicCandidates({
      secret: SECRET,
      regionGeohash: REGION,
      windowId: nextWindow.windowId,
      center: decodeGeohashCenter(REGION),
      count: 1,
      searchRadiusMeters: 16_093.44,
      minimumSpacingMeters: 250,
    }),
  );

  // 12: progress belongs to the server-derived local day and resets next day.
  const today = getSafeLocalDate(SERVER_NOW, 'America/Los_Angeles');
  const tomorrow = getSafeLocalDate(new Date('2026-07-20T20:15:00.000Z'), 'America/Los_Angeles');
  assert.notEqual(today.localDate, tomorrow.localDate);
});
