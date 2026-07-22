import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  getFavoriteTrailIds,
  getTrailMeetups,
  getTrails,
  setTrailFavorite,
} from '@/services/trail-data-service';
import type { Trail, TrailFilters, TrailSearchCoordinate } from '@/types/trails';
import { calculateDistanceMeters } from '@/utils/distance';
import { EMPTY_TRAIL_FILTERS, filterTrails } from '@/utils/trail-filters';

const SEARCH_AREA_MOVEMENT_METERS = 250;
const CURRENT_LOCATION_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1_000;
const LAST_KNOWN_REQUIRED_ACCURACY_METERS = 1_000;
const SAN_FRANCISCO_PREVIEW = { latitude: 37.7749, longitude: -122.4194 };

export type TrailLocationStatus =
  | 'checking'
  | 'granted'
  | 'denied'
  | 'services_off'
  | 'simulator_fallback'
  | 'unavailable';

export type TrailLocationResult =
  | { kind: 'located'; coordinate: TrailSearchCoordinate; isPhysicalDevice: boolean }
  | { kind: 'simulator_fallback'; coordinate: TrailSearchCoordinate }
  | { kind: 'denied' | 'services_off' | 'unavailable' };

// Makes sure a GPS object contains finite coordinates inside the Earth's bounds.
function readValidCoordinate(location: Location.LocationObject | null): TrailSearchCoordinate | null {
  if (!location) return null;
  const { latitude, longitude } = location.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

// Stops the screen from waiting forever when the operating system cannot provide GPS.
async function getBalancedPositionWithTimeout(): Promise<Location.LocationObject | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), CURRENT_LOCATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Prints technical details only during development, keeping user messages simple.
function logLocationProblem(message: string, error?: unknown) {
  if (__DEV__) console.warn(`[Trails location] ${message}`, error ?? '');
}

export function useNearbyTrails() {
  const [userLocation, setUserLocation] = useState<TrailSearchCoordinate | null>(null);
  const [locationCenter, setLocationCenter] = useState<TrailSearchCoordinate | null>(null);
  const [searchCenter, setSearchCenter] = useState<TrailSearchCoordinate>(SAN_FRANCISCO_PREVIEW);
  const [mapCenter, setMapCenter] = useState<TrailSearchCoordinate>(SAN_FRANCISCO_PREVIEW);
  const [allTrails, setAllTrails] = useState<Trail[]>([]);
  const [meetups, setMeetups] = useState<Awaited<ReturnType<typeof getTrailMeetups>>>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<TrailFilters>(EMPTY_TRAIL_FILTERS);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<TrailLocationStatus>('checking');
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const locationRequestRef = useRef<Promise<TrailLocationResult> | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const locationSubscriptionStartingRef = useRef(false);

  // Loads trail cards for one coordinate while ignoring late work after unmount.
  const loadCatalog = useCallback(async (center?: TrailSearchCoordinate | null) => {
    try {
      const [trails, trailMeetups, favorites] = await Promise.all([
        getTrails(center),
        getTrailMeetups(),
        getFavoriteTrailIds(),
      ]);
      if (!mountedRef.current) return;
      setAllTrails(trails);
      setMeetups(trailMeetups);
      setFavoriteIds(favorites);
      if (center) {
        setSearchCenter(center);
        setMapCenter(center);
      }
      setError(null);
    } catch (catalogError) {
      logLocationProblem('Trail catalog loading failed.', catalogError);
      if (mountedRef.current) setError('Trail data could not be loaded. Please try again.');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  // Uses a temporary map center for simulator previews without calling it real GPS.
  const activateSimulatorPreview = useCallback(async (): Promise<TrailLocationResult> => {
    // Development preview only: this coordinate is never saved as the user's location.
    if (!__DEV__ || Platform.OS !== 'ios' || Device.isDevice) return { kind: 'unavailable' };
    if (mountedRef.current) {
      setUserLocation(null);
      setLocationCenter(SAN_FRANCISCO_PREVIEW);
      setLocationStatus('simulator_fallback');
      setLocationWarning('Simulator location unavailable. Choose a simulated location from Xcode Features > Location.');
    }
    await loadCatalog(SAN_FRANCISCO_PREVIEW);
    return { kind: 'simulator_fallback', coordinate: SAN_FRANCISCO_PREVIEW };
  }, [loadCatalog]);

  // Keeps the foreground map pin current after the first GPS fix is found.
  const startLiveLocationUpdates = useCallback(async () => {
    if (locationSubscriptionRef.current || locationSubscriptionStartingRef.current) return;
    locationSubscriptionStartingRef.current = true;
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 2,
          timeInterval: 2_000,
        },
        (nextLocation) => {
          const coordinate = readValidCoordinate(nextLocation);
          if (!coordinate || !mountedRef.current) return;

          // This only updates the live pin. Trail API searches remain manual.
          setUserLocation(coordinate);
          setLocationStatus('granted');
          setLocationWarning(null);
        },
      );
      if (!mountedRef.current) {
        subscription.remove();
        return;
      }
      locationSubscriptionRef.current = subscription;
    } catch (watchError) {
      logLocationProblem('Live foreground location updates could not start.', watchError);
    } finally {
      locationSubscriptionStartingRef.current = false;
    }
  }, []);

  // Checks permission once, uses cached GPS immediately, then tries for a fresh fix.
  const runLocationRequest = useCallback(async (): Promise<TrailLocationResult> => {
    const isIosSimulator = Platform.OS === 'ios' && !Device.isDevice;
    if (mountedRef.current) {
      setIsLoading(true);
      setLocationStatus('checking');
      setLocationWarning(null);
    }

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (isIosSimulator) return activateSimulatorPreview();
        if (mountedRef.current) setLocationStatus('services_off');
        await loadCatalog(null);
        return { kind: 'services_off' };
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status === Location.PermissionStatus.UNDETERMINED && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        if (isIosSimulator) return activateSimulatorPreview();
        if (mountedRef.current) setLocationStatus('denied');
        await loadCatalog(null);
        return { kind: 'denied' };
      }

      let lastKnownCoordinate: TrailSearchCoordinate | null = null;
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: LAST_KNOWN_MAX_AGE_MS,
          requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_METERS,
        });
        lastKnownCoordinate = readValidCoordinate(lastKnown);
        if (lastKnownCoordinate && mountedRef.current) {
          setLocationCenter(lastKnownCoordinate);
          // A simulator cache may be stale, so only a fresh simulator fix becomes its blue pin.
          if (!isIosSimulator) {
            setUserLocation(lastKnownCoordinate);
            setLocationStatus('granted');
          }
          await loadCatalog(lastKnownCoordinate);
        }
      } catch (lastKnownError) {
        logLocationProblem('Last-known location was unavailable.', lastKnownError);
      }

      const freshLocation = await getBalancedPositionWithTimeout();
      const freshCoordinate = readValidCoordinate(freshLocation);
      if (isIosSimulator && !freshCoordinate) return activateSimulatorPreview();
      const coordinate = freshCoordinate ?? lastKnownCoordinate;

      if (!coordinate) {
        logLocationProblem('No valid location arrived before the timeout.');
        if (mountedRef.current) {
          setLocationStatus('unavailable');
          setLocationWarning('GPS is temporarily unavailable. Tap the location button to try again.');
        }
        await loadCatalog(null);
        return { kind: 'unavailable' };
      }

      if (mountedRef.current) {
        setUserLocation(coordinate);
        setLocationCenter(coordinate);
        setLocationStatus('granted');
        setLocationWarning(null);
      }
      await loadCatalog(coordinate);
      await startLiveLocationUpdates();
      return { kind: 'located', coordinate, isPhysicalDevice: Device.isDevice };
    } catch (locationError) {
      logLocationProblem('Location request failed.', locationError);
      if (isIosSimulator) return activateSimulatorPreview();
      if (mountedRef.current) {
        setLocationStatus('unavailable');
        setLocationWarning('GPS is temporarily unavailable. Tap the location button to try again.');
      }
      await loadCatalog(null);
      return { kind: 'unavailable' };
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [activateSimulatorPreview, loadCatalog, startLiveLocationUpdates]);

  // Shares one request promise so fast repeated taps cannot start overlapping GPS work.
  const refresh = useCallback((): Promise<TrailLocationResult> => {
    if (locationRequestRef.current) return locationRequestRef.current;
    const request = runLocationRequest().finally(() => {
      if (locationRequestRef.current === request) locationRequestRef.current = null;
    });
    locationRequestRef.current = request;
    return request;
  }, [runLocationRequest]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, [refresh]);

  const trails = useMemo(
    () => filterTrails(allTrails, filters, meetups, query),
    [allTrails, filters, meetups, query],
  );

  const meetupCounts = useMemo(() => meetups.reduce<Record<string, number>>((counts, meetup) => {
    counts[meetup.trailId] = (counts[meetup.trailId] ?? 0) + 1;
    return counts;
  }, {}), [meetups]);

  const hasPendingAreaSearch = calculateDistanceMeters(mapCenter, searchCenter) >= SEARCH_AREA_MOVEMENT_METERS;

  // Searches only after the user deliberately moves the map to a new area.
  const searchThisArea = useCallback(async () => {
    if (mountedRef.current) setIsLoading(true);
    await loadCatalog(mapCenter);
  }, [loadCatalog, mapCenter]);

  // Saves or removes one trail favorite using the existing trail service.
  const toggleFavorite = useCallback(async (trailId: string) => {
    const next = await setTrailFavorite(trailId, !favoriteIds.includes(trailId));
    if (mountedRef.current) setFavoriteIds(next);
  }, [favoriteIds]);

  return {
    isPhysicalDevice: Device.isDevice,
    userLocation,
    locationCenter,
    searchCenter,
    mapCenter,
    setMapCenter,
    trails,
    totalResults: allTrails.length,
    meetups,
    meetupCounts,
    filters,
    setFilters,
    query,
    setQuery,
    favoriteIds,
    toggleFavorite,
    isLoading,
    error,
    locationStatus,
    locationWarning,
    hasPendingAreaSearch,
    searchThisArea,
    refresh,
  };
}
