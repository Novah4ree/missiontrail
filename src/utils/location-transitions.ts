import type { TrailSearchCoordinate } from '@/types/trails';
import type { ValidatedGpsPosition } from '@/utils/location-validation';

export type LocationSource = 'gps' | 'zip' | 'none';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  city?: string;
  state?: string;
  zipCode?: string;
  source: LocationSource;
}

export type LocationPermissionStatus =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'services_off';

export type CentralLocationState = {
  activeLocation: UserLocation | null;
  currentGpsLocation: UserLocation | null;
  permissionStatus: LocationPermissionStatus;
  isRequestingGps: boolean;
  error: string | null;
};

export const INITIAL_LOCATION_STATE: CentralLocationState = {
  activeLocation: null,
  currentGpsLocation: null,
  permissionStatus: 'unknown',
  isRequestingGps: false,
  error: null,
};

export function isLocationActionCurrent(expectedRevision: number, currentRevision: number) {
  return expectedRevision === currentRevision;
}

export function applyPassiveGps(
  current: CentralLocationState,
  gps: ValidatedGpsPosition,
): CentralLocationState {
  const currentTimestamp = current.currentGpsLocation?.source === 'gps'
    ? current.currentGpsLocation.timestamp
    : undefined;
  if (typeof currentTimestamp === 'number' && currentTimestamp > gps.timestamp) {
    return current;
  }

  return {
    activeLocation: current.activeLocation ?? gps,
    currentGpsLocation: gps,
    permissionStatus: 'granted',
    isRequestingGps: current.isRequestingGps,
    error: null,
  };
}

/** An invalid watcher sample is ignored without erasing the last valid GPS fix. */
export function applyPassiveGpsFailure(
  current: CentralLocationState,
  error: string,
): CentralLocationState {
  return {
    ...current,
    error,
  };
}

export function activateGps(
  current: CentralLocationState,
  gps: ValidatedGpsPosition,
): CentralLocationState {
  const currentGps = current.currentGpsLocation;
  const freshestGps = currentGps?.source === 'gps'
    && typeof currentGps.timestamp === 'number'
    && currentGps.timestamp > gps.timestamp
    ? currentGps
    : gps;

  return {
    ...current,
    activeLocation: freshestGps,
    currentGpsLocation: freshestGps,
    permissionStatus: 'granted',
    isRequestingGps: false,
    error: null,
  };
}

export function activateZip(
  current: CentralLocationState,
  coordinate: TrailSearchCoordinate,
  zipCode: string,
): CentralLocationState {
  return {
    activeLocation: { ...coordinate, zipCode, source: 'zip' },
    currentGpsLocation: current.currentGpsLocation,
    permissionStatus: current.permissionStatus,
    isRequestingGps: false,
    error: null,
  };
}

export function applyLocationFailure(
  current: CentralLocationState,
  permissionStatus: LocationPermissionStatus,
  error: string,
): CentralLocationState {
  return {
    ...current,
    permissionStatus,
    isRequestingGps: false,
    error,
  };
}

export function applyGpsAddress(
  current: CentralLocationState,
  coordinate: TrailSearchCoordinate,
  address: Pick<UserLocation, 'city' | 'state' | 'zipCode'>,
): CentralLocationState {
  const active = current.activeLocation;
  if (
    active?.source !== 'gps'
    || active.latitude !== coordinate.latitude
    || active.longitude !== coordinate.longitude
  ) return current;
  return { ...current, activeLocation: { ...active, ...address } };
}
