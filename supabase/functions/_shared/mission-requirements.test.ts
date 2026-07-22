import assert from 'node:assert/strict';
import test from 'node:test';

import {
  claimMissionReward,
  selectMissionForDetails,
  updateMissionProgress,
  validateLocationPoint,
  type MissionRecord,
} from './mission-requirements.ts';
import {
  loadServerMissionProgress,
  saveServerMissionProgress,
} from '../../../src/services/mission-cache-core.ts';

const THREE_MILES_METERS = 4_828.032;

function activeWalk(progress: number): MissionRecord {
  return { id: 'walk-three-miles', state: 'active', progress, target: THREE_MILES_METERS };
}

test('clicking an unfinished mission opens details without completing it', () => {
  const mission = activeWalk(100);
  const selected = selectMissionForDetails([mission], mission.id);
  assert.equal(selected, mission);
  assert.equal(mission.state, 'active');
});

test('a three-mile mission stays active at 2.99 miles', () => {
  const updated = updateMissionProgress(activeWalk(0), { type: 'distance', target: THREE_MILES_METERS }, {
    verifiedDistanceMeters: 2.99 * 1_609.344,
  });
  assert.equal(updated.state, 'active');
});

test('a three-mile mission completes automatically at three verified miles', () => {
  const updated = updateMissionProgress(activeWalk(0), { type: 'distance', target: THREE_MILES_METERS }, {
    verifiedDistanceMeters: THREE_MILES_METERS,
  });
  assert.equal(updated.state, 'completed');
});

test('driving-speed movement does not count', () => {
  const result = validateLocationPoint(
    { latitude: 37, longitude: -122, accuracyMeters: 5, capturedAt: '2026-07-20T10:00:00Z' },
    { latitude: 37.01, longitude: -122, accuracyMeters: 5, capturedAt: '2026-07-20T10:00:10Z' },
    {
      serverNow: new Date('2026-07-20T10:00:20Z'),
      maxAccuracyMeters: 12,
      maxSpeedMetersPerSecond: 8.9408,
      maxOfflineAgeHours: 24,
      maximumSegmentSeconds: 120,
      teleportDistanceMeters: 500,
      allowMocked: false,
      distanceBetween: () => 1_100,
    },
  );
  assert.deepEqual(result, { accepted: false, code: 'GPS_TELEPORT' });
});

test('rewards cannot be claimed early or more than once', () => {
  const early = claimMissionReward(activeWalk(THREE_MILES_METERS - 1));
  assert.equal(early.awarded, false);
  const first = claimMissionReward({ ...activeWalk(THREE_MILES_METERS), state: 'completed' });
  assert.equal(first.awarded, true);
  const second = claimMissionReward(first.mission);
  assert.equal(second.awarded, false);
});

test('server progress remains available after a simulated app restart', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
  };
  await saveServerMissionProgress(storage, 'progress', { verifiedDistanceMeters: THREE_MILES_METERS });
  const restartedStore = { ...storage };
  assert.deepEqual(await loadServerMissionProgress(restartedStore, 'progress'), {
    verifiedDistanceMeters: THREE_MILES_METERS,
  });
});
