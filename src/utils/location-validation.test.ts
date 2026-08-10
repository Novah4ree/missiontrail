import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeUsZipCode, validateGpsPosition } from './location-validation.ts';

const NOW = 1_800_000_000_000;

function position(overrides: Record<string, unknown> = {}) {
  return {
    coords: {
      latitude: 38.4455,
      longitude: -121.8233,
      accuracy: 12,
      ...(overrides.coords as object | undefined),
    },
    timestamp: NOW - 1_000,
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'coords')),
  };
}

test('accepts a fresh, accurate GPS sample', () => {
  assert.deepEqual(validateGpsPosition(position(), NOW), {
    latitude: 38.4455,
    longitude: -121.8233,
    accuracy: 12,
    timestamp: NOW - 1_000,
    source: 'gps',
  });
});

test('rejects missing and malformed position data', () => {
  assert.equal(validateGpsPosition(null, NOW), null);
  assert.equal(validateGpsPosition(undefined, NOW), null);
  assert.equal(validateGpsPosition({}, NOW), null);
  assert.equal(validateGpsPosition({ coords: null, timestamp: NOW }, NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { latitude: undefined } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { latitude: '38.4' } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { longitude: Number.NaN } }), NOW), null);
});

test('rejects coordinates outside Earth bounds and the zero-zero sentinel', () => {
  assert.equal(validateGpsPosition(position({ coords: { latitude: 91 } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { latitude: -91 } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { longitude: 181 } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { longitude: -181 } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { latitude: 0, longitude: 0 } }), NOW), null);
});

test('rejects missing, non-finite, negative, and implausible accuracy', () => {
  assert.equal(validateGpsPosition(position({ coords: { accuracy: null } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { accuracy: undefined } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { accuracy: Number.NaN } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { accuracy: -1 } }), NOW), null);
  assert.equal(validateGpsPosition(position({ coords: { accuracy: 1_001 } }), NOW), null);
});

test('rejects missing, invalid, stale, and implausibly future timestamps', () => {
  assert.equal(validateGpsPosition(position({ timestamp: undefined }), NOW), null);
  assert.equal(validateGpsPosition(position({ timestamp: Number.NaN }), NOW), null);
  assert.equal(validateGpsPosition(position({ timestamp: 0 }), NOW), null);
  assert.equal(validateGpsPosition(position({ timestamp: NOW - 5 * 60 * 1_000 - 1 }), NOW), null);
  assert.equal(validateGpsPosition(position({ timestamp: NOW + 60 * 1_000 + 1 }), NOW), null);
});

test('accepts only normalized five-digit US ZIP codes', () => {
  assert.equal(normalizeUsZipCode('95620'), '95620');
  assert.equal(normalizeUsZipCode(' 95620 '), '95620');
  assert.equal(normalizeUsZipCode(''), null);
  assert.equal(normalizeUsZipCode('9562'), null);
  assert.equal(normalizeUsZipCode('956200'), null);
  assert.equal(normalizeUsZipCode('9562A'), null);
  assert.equal(normalizeUsZipCode(undefined), null);
});
