import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activateGps,
  activateZip,
  applyGpsAddress,
  applyLocationFailure,
  applyPassiveGps,
  applyPassiveGpsFailure,
  INITIAL_LOCATION_STATE,
  isLocationActionCurrent,
} from './location-transitions.ts';
import {
  getActiveSearchCoordinate,
  getNearbyLocationAction,
  getTrailAreaSummary,
} from './nearby-location-policy.ts';

const gpsA = {
  latitude: 38.45,
  longitude: -121.82,
  accuracy: 8,
  timestamp: 1_800_000_000_000,
  source: 'gps' as const,
};
const gpsB = { ...gpsA, latitude: 38.46, longitude: -121.81, timestamp: gpsA.timestamp + 1_000 };
const zipCoordinate = { latitude: 38.67, longitude: -120.81 };

test('GPS becomes both current GPS and active search location', () => {
  const state = activateGps(INITIAL_LOCATION_STATE, gpsA);
  assert.deepEqual(state.currentGpsLocation, gpsA);
  assert.deepEqual(state.activeLocation, gpsA);
});

test('ZIP becomes active without replacing current GPS or inheriting its label', () => {
  const state = activateZip(activateGps(INITIAL_LOCATION_STATE, gpsA), zipCoordinate, '95619');
  assert.deepEqual(state.currentGpsLocation, gpsA);
  assert.deepEqual(state.activeLocation, { ...zipCoordinate, zipCode: '95619', source: 'zip' });
  assert.equal(getTrailAreaSummary({
    source: state.activeLocation?.source ?? 'none',
    areaLabel: 'San Francisco, CA',
    zipCode: state.activeLocation?.zipCode,
  }), 'Search area: 95619 · within 25 mi');
});

test('passive GPS updates current GPS but cannot replace active ZIP', () => {
  const zipState = activateZip(activateGps(INITIAL_LOCATION_STATE, gpsA), zipCoordinate, '95619');
  const next = applyPassiveGps(zipState, gpsB);
  assert.deepEqual(next.currentGpsLocation, gpsB);
  assert.deepEqual(next.activeLocation, zipState.activeLocation);

  const invalidSample = applyPassiveGpsFailure(next, 'Invalid watcher sample.');
  assert.deepEqual(invalidSample.currentGpsLocation, gpsB);
  assert.deepEqual(invalidSample.activeLocation, zipState.activeLocation);

  // A delayed watcher sample is a true no-op and cannot move current GPS back
  // behind the newest accepted timestamp.
  assert.equal(applyPassiveGps(next, gpsA), next);
});

test('Use My Location explicitly switches ZIP back to fresh GPS', () => {
  const zipState = activateZip(activateGps(INITIAL_LOCATION_STATE, gpsA), zipCoordinate, '95619');
  const next = activateGps(zipState, gpsB);
  assert.deepEqual(next.activeLocation, gpsB);
  assert.equal(next.activeLocation ? 'zipCode' in next.activeLocation : false, false);
});

test('Use My Location activates the newest GPS sample when an older request resolves late', () => {
  const zipState = activateZip(activateGps(INITIAL_LOCATION_STATE, gpsB), zipCoordinate, '95619');
  const next = activateGps(zipState, gpsA);
  assert.deepEqual(next.currentGpsLocation, gpsB);
  assert.deepEqual(next.activeLocation, gpsB);
});

test('stale GPS work cannot overwrite a newer ZIP selection', () => {
  const gpsRequestRevision = 4;
  const currentRevision = 5;
  let state = activateZip(activateGps(INITIAL_LOCATION_STATE, gpsA), zipCoordinate, '95619');

  if (isLocationActionCurrent(gpsRequestRevision, currentRevision)) {
    state = activateGps(state, gpsB);
  }

  assert.equal(state.activeLocation?.source, 'zip');
  assert.equal(state.activeLocation?.zipCode, '95619');
  // A stale reverse-geocode result is a true no-op and preserves state identity.
  assert.equal(applyGpsAddress(state, gpsA, { city: 'Old GPS City', state: 'CA' }), state);
});

test('permission failure preserves ZIP without creating fake GPS', () => {
  const zipState = activateZip(INITIAL_LOCATION_STATE, zipCoordinate, '95619');
  const next = applyLocationFailure(zipState, 'denied', 'Location permission denied.');
  assert.deepEqual(next.activeLocation, zipState.activeLocation);
  assert.equal(next.currentGpsLocation, null);
});

test('failed GPS refresh preserves the last valid GPS coordinates', () => {
  const gpsState = activateGps(INITIAL_LOCATION_STATE, gpsA);
  const next = applyLocationFailure(gpsState, 'services_off', 'Location Services are off.');
  assert.deepEqual(next.currentGpsLocation, gpsA);
  assert.deepEqual(next.activeLocation, gpsA);
  assert.equal(next.error, 'Location Services are off.');
});

test('mount and refresh policy follows the live active source', () => {
  assert.equal(getNearbyLocationAction(null), 'request_gps');
  assert.equal(getNearbyLocationAction(gpsA), 'load_gps');
  assert.equal(getNearbyLocationAction({ ...zipCoordinate, source: 'zip', zipCode: '95619' }), 'load_zip');
});

test('trail search coordinate comes only from activeLocation', () => {
  const zip = { ...zipCoordinate, source: 'zip' as const, zipCode: '95619' };
  assert.deepEqual(getActiveSearchCoordinate(zip), zipCoordinate);
  assert.equal(getActiveSearchCoordinate(null), null);
});

test('moving the display camera does not mutate centralized GPS or ZIP state', () => {
  const state = activateZip(activateGps(INITIAL_LOCATION_STATE, gpsA), zipCoordinate, '95619');
  const before = structuredClone(state);
  const mapCameraLocation = { latitude: 40, longitude: -74 };
  assert.deepEqual(mapCameraLocation, { latitude: 40, longitude: -74 });
  assert.deepEqual(state, before);
});
