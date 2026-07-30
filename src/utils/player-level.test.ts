import assert from 'node:assert/strict';
import test from 'node:test';

import { getPlayerLevelProgress, xpForLevel } from './player-level.ts';

test('uses the configured exponential XP curve', () => {
  assert.equal(xpForLevel(1), 100);
  assert.equal(xpForLevel(2), 255);
  assert.equal(xpForLevel(3), 441);
});

test('starts a new player at level one with no progress', () => {
  assert.deepEqual(getPlayerLevelProgress(0), {
    level: 1,
    totalXp: 0,
    xpIntoLevel: 0,
    xpForNextLevel: 100,
    xpRemaining: 100,
    progressPercent: 0,
  });
});

test('advances at the exact XP boundary', () => {
  assert.deepEqual(getPlayerLevelProgress(100), {
    level: 2,
    totalXp: 100,
    xpIntoLevel: 0,
    xpForNextLevel: 255,
    xpRemaining: 255,
    progressPercent: 0,
  });
});

test('supports crossing multiple levels with one lifetime XP total', () => {
  assert.deepEqual(getPlayerLevelProgress(420), {
    level: 3,
    totalXp: 420,
    xpIntoLevel: 65,
    xpForNextLevel: 441,
    xpRemaining: 376,
    progressPercent: 15,
  });
});

test('clamps invalid or negative XP to zero', () => {
  assert.equal(getPlayerLevelProgress(-10).totalXp, 0);
  assert.equal(getPlayerLevelProgress(Number.NaN).totalXp, 0);
});
