import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRelicHuntStage,
  hasCrossedHuntFallbackMargin,
  isCloserHuntStage,
  isFartherHuntStage,
} from './relic-hunt.ts';

test('hunt stage uses the shared secure-distance thresholds', () => {
  assert.equal(getRelicHuntStage(null, 'approaching'), 'SEARCHING');
  assert.equal(getRelicHuntStage(1_001, 'approaching'), 'FAR');
  assert.equal(getRelicHuntStage(1_000, 'approaching'), 'CLOSING_IN');
  assert.equal(getRelicHuntStage(300, 'approaching'), 'NEARBY');
  assert.equal(getRelicHuntStage(100, 'approaching'), 'VERY_CLOSE');
  assert.equal(getRelicHuntStage(30, 'approaching'), 'SIGNAL_LOCKED');
  assert.equal(getRelicHuntStage(5_000, 'revealed'), 'FOUND');
});

test('closer transitions are distinguished from farther transitions', () => {
  assert.equal(isCloserHuntStage('NEARBY', 'VERY_CLOSE'), true);
  assert.equal(isFartherHuntStage('VERY_CLOSE', 'NEARBY'), true);
  assert.equal(isFartherHuntStage('NEARBY', 'NEARBY'), false);
});

test('fallback margins prevent threshold jitter', () => {
  assert.equal(hasCrossedHuntFallbackMargin('VERY_CLOSE', 101), false);
  assert.equal(hasCrossedHuntFallbackMargin('VERY_CLOSE', 116), true);
  assert.equal(hasCrossedHuntFallbackMargin('SIGNAL_LOCKED', 31), false);
  assert.equal(hasCrossedHuntFallbackMargin('SIGNAL_LOCKED', 41), true);
});
