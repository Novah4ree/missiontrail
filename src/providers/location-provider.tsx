import * as Location from 'expo-location';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { TrailSearchCoordinate } from '@/types/trails';
import {
  validateCoordinate,
  validateGpsPosition,
  normalizeUsZipCode,
  type ValidatedGpsPosition,
} from '@/utils/location-validation';
import {
  activateGps,
  activateZip,
  applyGpsAddress,
  applyLocationFailure,
  applyPassiveGps,
  applyPassiveGpsFailure,
  INITIAL_LOCATION_STATE,
  isLocationActionCurrent,
  type CentralLocationState,
  type LocationPermissionStatus,
  type UserLocation,
} from '@/utils/location-transitions';

export type { LocationPermissionStatus, LocationSource, UserLocation } from '@/utils/location-transitions';

const CURRENT_LOCATION_TIMEOUT_MS = 15_000;

export type ForegroundLocationStatus = LocationPermissionStatus;
export type ForegroundLocationState = CentralLocationState;

export type ForegroundLocationResult =
  | {
    kind: 'located';
    coordinate: TrailSearchCoordinate;
    position: Location.LocationObject;
    source: 'gps';
  }
  | { kind: 'denied' | 'services_off' | 'unavailable'; error: string }
  | { kind: 'superseded' };

type LocationContextValue = {
  location: ForegroundLocationState;
  requestCurrentLocation: () => Promise<ForegroundLocationResult>;
  setGpsLocation: (position: Location.LocationObject) => boolean;
  setZipLocation: (coordinate: TrailSearchCoordinate, zipCode: string) => boolean;
  updateGpsAddress: (
    coordinate: TrailSearchCoordinate,
    address: Pick<UserLocation, 'city' | 'state' | 'zipCode'>,
  ) => void;
  beginLocationSearch: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

async function getHighAccuracyPosition(): Promise<Location.LocationObject | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), CURRENT_LOCATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<ForegroundLocationState>(INITIAL_LOCATION_STATE);
  const requestRef = useRef<{ promise: Promise<ForegroundLocationResult>; revision: number } | null>(null);
  const locationRevisionRef = useRef(0);
  const latestGpsRef = useRef<{
    position: Location.LocationObject;
    validated: ValidatedGpsPosition;
  } | null>(null);

  const commitGpsLocation = useCallback((
    position: Location.LocationObject,
    validated: ValidatedGpsPosition,
    makeActive = false,
  ) => {
    const previous = latestGpsRef.current;
    const latest = previous && previous.validated.timestamp > validated.timestamp
      ? previous
      : { position, validated };

    if (latest !== previous) latestGpsRef.current = latest;

    if (makeActive) {
      setLocation((current) => activateGps(current, latest.validated));
    } else if (latest !== previous) {
      setLocation((current) => applyPassiveGps(current, latest.validated));
    }

    return latest;
  }, []);

  const setGpsLocation = useCallback((position: Location.LocationObject) => {
    const validated = validateGpsPosition(position);
    if (validated) {
      commitGpsLocation(position, validated);
      return true;
    }
    setLocation((current) => applyPassiveGpsFailure(
      current,
      'Your GPS location was unavailable or invalid. Move to an open area and try again.',
    ));
    return false;
  }, [commitGpsLocation]);

  const setZipLocation = useCallback((coordinate: TrailSearchCoordinate, zipCode: string) => {
    locationRevisionRef.current += 1;
    const validated = validateCoordinate(coordinate.latitude, coordinate.longitude);
    const normalizedZip = normalizeUsZipCode(zipCode);
    if (!validated || !normalizedZip) {
      setLocation((current) => ({
        ...current,
        error: 'That ZIP code did not resolve to a valid search location.',
      }));
      return false;
    }
    setLocation((current) => activateZip(current, validated, normalizedZip));
    return true;
  }, []);

  const updateGpsAddress = useCallback((
    coordinate: TrailSearchCoordinate,
    address: Pick<UserLocation, 'city' | 'state' | 'zipCode'>,
  ) => {
    setLocation((current) => applyGpsAddress(current, coordinate, address));
  }, []);

  const beginLocationSearch = useCallback(() => {
    locationRevisionRef.current += 1;
    setLocation((current) => ({ ...current, isRequestingGps: false }));
  }, []);

  const requestCurrentLocation = useCallback((): Promise<ForegroundLocationResult> => {
    if (requestRef.current && requestRef.current.revision === locationRevisionRef.current) {
      return requestRef.current.promise;
    }

    const revision = locationRevisionRef.current + 1;
    locationRevisionRef.current = revision;

    setLocation((current) => ({
      ...current,
      isRequestingGps: true,
      error: null,
    }));

    const request = (async (): Promise<ForegroundLocationResult> => {
      let permissionGranted = false;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!isLocationActionCurrent(revision, locationRevisionRef.current)) return { kind: 'superseded' };
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          const error = 'Mission Trails needs foreground location access to find trails near you. You can search by ZIP code instead.';
          setLocation((current) => applyLocationFailure(current, 'denied', error));
          return { kind: 'denied', error };
        }
        permissionGranted = true;

        if (!(await Location.hasServicesEnabledAsync())) {
          if (!isLocationActionCurrent(revision, locationRevisionRef.current)) return { kind: 'superseded' };
          const error = 'Turn on Location Services to explore trails and parks near you.';
          setLocation((current) => applyLocationFailure(current, 'services_off', error));
          return { kind: 'services_off', error };
        }

        const position = await getHighAccuracyPosition();
        if (!isLocationActionCurrent(revision, locationRevisionRef.current)) return { kind: 'superseded' };
        const validated = validateGpsPosition(position);

        if (!position || !validated) {
          const error = 'Your GPS location was unavailable or invalid. Move to an open area and try again.';
          setLocation((current) => applyLocationFailure(current, 'granted', error));
          return { kind: 'unavailable', error };
        }

        const latest = commitGpsLocation(position, validated, true);
        const coordinate = {
          latitude: latest.validated.latitude,
          longitude: latest.validated.longitude,
        };
        return { kind: 'located', coordinate, position: latest.position, source: 'gps' };
      } catch (locationError) {
        if (!isLocationActionCurrent(revision, locationRevisionRef.current)) return { kind: 'superseded' };
        if (__DEV__) console.warn('[LOCATION ERROR]', {
          operation: 'current_gps_request',
          error: locationError,
        });
        const error = 'We couldn’t determine your GPS location. Move to an open area and try again.';
        setLocation((current) => applyLocationFailure(
          current,
          permissionGranted ? 'granted' : 'unknown',
          error,
        ));
        return { kind: 'unavailable', error };
      }
    })().finally(() => {
      if (requestRef.current?.promise === request) requestRef.current = null;
    });

    requestRef.current = { promise: request, revision };
    return request;
  }, [commitGpsLocation]);

  const value = useMemo(
    () => ({
      location,
      requestCurrentLocation,
      setGpsLocation,
      setZipLocation,
      updateGpsAddress,
      beginLocationSearch,
    }),
    [
      location,
      requestCurrentLocation,
      setGpsLocation,
      setZipLocation,
      updateGpsAddress,
      beginLocationSearch,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationState() {
  const context = useContext(LocationContext);
  if (!context) throw new Error('LocationProvider is missing from the app layout.');
  return context;
}
