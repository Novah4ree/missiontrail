import assert from 'node:assert/strict';
import test from 'node:test';

import { selectLevelMissions, summarizeLevelMissions } from './level-mission-progress.ts';

const active = { required: true, state: 'active' as const };
const completed = { required: true, state: 'completed' as const };

test('a new user sees every configured Level 1 mission at zero progress', () => {
  const missions = selectLevelMissions([
    { ...active, level: 1 },
    { ...active, level: 1 },
    { ...active, level: 2 },
  ], 1);
  assert.equal(missions.length, 2);
  assert.deepEqual(summarizeLevelMissions(missions), {
    totalCount: 2,
    completedCount: 0,
    completedRequiredCount: 0,
    requiredCount: 2,
    progressPercent: 0,
    nextLevelUnlocked: false,
  });
});

test('one completion updates the shared count and percentage', () => {
  const summary = summarizeLevelMissions([completed, active, active, active, active]);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.totalCount, 5);
  assert.equal(summary.progressPercent, 20);
});

test('Level 2 remains locked until every required Level 1 mission is complete', () => {
  assert.equal(summarizeLevelMissions([completed, active]).nextLevelUnlocked, false);
  assert.equal(summarizeLevelMissions([completed, completed]).nextLevelUnlocked, true);
});

test('optional missions affect visible progress but not the next-level requirement', () => {
  const optionalActive = { required: false, state: 'active' as const };
  const summary = summarizeLevelMissions([completed, optionalActive]);
  assert.equal(summary.progressPercent, 50);
  assert.equal(summary.nextLevelUnlocked, true);
});
