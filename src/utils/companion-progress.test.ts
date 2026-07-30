import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampPercent,
  formatCompanionName,
  getEnergyPercent,
} from './companion-progress.ts';

test('Energy and Bond percentages clamp between zero and 100', () => {
  assert.equal(getEnergyPercent(120, 100), 100);
  assert.equal(getEnergyPercent(-10, 100), 0);
  assert.equal(getEnergyPercent(50, 100), 50);
  assert.equal(clampPercent(101), 100);
});

test('missing companion identity remains a real no-active-companion state', () => {
  assert.equal(formatCompanionName(null), null);
  assert.equal(formatCompanionName('nova_fox'), 'Nova Fox');
});
