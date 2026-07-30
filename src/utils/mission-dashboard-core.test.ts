import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MISSION_DASHBOARD_SECTION_ORDER,
  clampProgress,
  getCompanionDashboardMessage,
  getMissionCollectionState,
  getMissionDisplayStatus,
  summarizeMissionDashboard,
} from './mission-dashboard-core.ts';

test('assigned missions drive counts, percentage, and available XP', () => {
  const summary = summarizeMissionDashboard([
    { required: true, state: 'claimed', rewardXp: 100 },
    { required: true, state: 'completed', rewardXp: 75 },
    { required: true, state: 'active', rewardXp: 50 },
  ]);
  assert.deepEqual(summary, {
    completedCount: 2,
    totalCount: 3,
    availableXp: 125,
    claimableXp: 75,
    earnedXp: 100,
    progressPercent: 67,
    allRequiredComplete: false,
  });
});

test('zero missions stays an empty day instead of ordinary 0 of 0 progress', () => {
  assert.equal(getMissionCollectionState({
    isLoading: false,
    missionCount: 0,
    hasError: false,
    isUsingCache: false,
  }), 'empty');
  assert.equal(summarizeMissionDashboard([]).allRequiredComplete, false);
});

test('mission loading, error, cached offline, and loaded states remain distinct', () => {
  assert.equal(getMissionCollectionState({ isLoading: true, missionCount: 0, hasError: false, isUsingCache: false }), 'loading');
  assert.equal(getMissionCollectionState({ isLoading: false, missionCount: 0, hasError: true, isUsingCache: false }), 'error');
  assert.equal(getMissionCollectionState({ isLoading: false, missionCount: 2, hasError: true, isUsingCache: true }), 'offline-cache');
  assert.equal(getMissionCollectionState({ isLoading: false, missionCount: 2, hasError: false, isUsingCache: false }), 'loaded');
});

test('card taps never influence status and local target progress remains verifying', () => {
  assert.equal(getMissionDisplayStatus('active', 0, 100), 'Not Started');
  assert.equal(getMissionDisplayStatus('active', 50, 100), 'In Progress');
  assert.equal(getMissionDisplayStatus('active', 100, 100), 'Verifying');
  assert.equal(getMissionDisplayStatus('completed', 100, 100), 'Ready to Claim');
  assert.equal(getMissionDisplayStatus('claimed', 100, 100), 'Completed');
});

test('Rare and Legendary bars calculate independently', () => {
  assert.equal(clampProgress(4, 5), 0.8);
  assert.equal(clampProgress(4, 10), 0.4);
});

test('companion messages never invent activity', () => {
  const base = {
    name: 'Novah',
    hasCompanion: true,
    todaySteps: 0,
    todayMiles: 0,
    hasReadyMission: false,
    allRequiredComplete: false,
    energyPercent: 100,
  };
  assert.equal(
    getCompanionDashboardMessage(base),
    'Novah is ready for today’s first adventure.',
  );
  assert.equal(
    getCompanionDashboardMessage({ ...base, todaySteps: 500 }),
    'Novah is keeping pace with you.',
  );
  assert.equal(
    getCompanionDashboardMessage({ ...base, hasReadyMission: true }),
    'A mission is ready to be claimed!',
  );
  assert.equal(
    getCompanionDashboardMessage({ ...base, allRequiredComplete: true }),
    'Amazing work—today’s adventure is complete.',
  );
  assert.equal(
    getCompanionDashboardMessage({ ...base, energyPercent: 20 }),
    'Novah needs food or rest before another mission.',
  );
});

test('missions appear before relic, companion, and player progression sections', () => {
  assert.ok(MISSION_DASHBOARD_SECTION_ORDER.indexOf('missions') < MISSION_DASHBOARD_SECTION_ORDER.indexOf('relics'));
  assert.ok(MISSION_DASHBOARD_SECTION_ORDER.indexOf('missions') < MISSION_DASHBOARD_SECTION_ORDER.indexOf('companion'));
  assert.ok(MISSION_DASHBOARD_SECTION_ORDER.indexOf('missions') < MISSION_DASHBOARD_SECTION_ORDER.indexOf('level'));
});
