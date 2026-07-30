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
import { TrailDiscoveryError } from '@/services/trail-discovery-service';
import type { Trail, TrailFilters, TrailSearchCoordinate } from '@/types/trails';
import { calculateDistanceMeters } from '@/utils/distance';
import { EMPTY_TRAIL_FILTERS, filterTrails } from '@/utils/trail-filters';

const SEARCH_AREA_MOVEMENT_METERS = 250;
const CATALOG_REFRESH_MOVEMENT_METERS = 500;
const CURRENT_LOCATION_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1_000;
const LAST_KNOWN_REQUIRED_ACCURACY_METERS = 1_000;

export type TrailLocationStatus =
  | 'checking'
  | 'not_requested'
  | 'granted'
  | 'denied'
  | 'services_off'
  | 'simulator_fallback'
  | 'unavailable';

export type TrailLocationResult =
  | { kind: 'located'; coordinate: TrailSearchCoordinate; isPhysicalDevice: boolean }
  | { kind: 'simulator_fallback' }
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

function logTrailDebug(message: string, details?: unknown) {
  if (__DEV__) console.info(`[Trails discovery] ${message}`, details ?? '');
}

export function useNearbyTrails() {
  const [userLocation, setUserLocation] = useState<TrailSearchCoordinate | null>(null);
  const [locationCenter, setLocationCenter] = useState<TrailSearchCoordinate | null>(null);
  const [searchCenter, setSearchCenter] = useState<TrailSearchCoordinate | null>(null);
  const [mapCenter, setMapCenter] = useState<TrailSearchCoordinate | null>(null);
  const [allTrails, setAllTrails] = useState<Trail[]>([]);
  const [meetups, setMeetups] = useState<Awaited<ReturnType<typeof getTrailMeetups>>>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteBusyIds, setFavoriteBusyIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<TrailFilters>(EMPTY_TRAIL_FILTERS);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationStatus, setLocationStatus] = useState<TrailLocationStatus>('not_requested');
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const locationRequestRef = useRef<Promise<TrailLocationResult> | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const locationSubscriptionStartingRef = useRef(false);
  const catalogRequestIdRef = useRef(0);
  const searchCenterRef = useRef<TrailSearchCoordinate | null>(null);
  const favoriteMutationIdsRef = useRef(new Set<string>());

  // Loads trail cards for one coordinate and ignores responses from stale searches.
  const loadCatalog = useCallback(async (
    center?: TrailSearchCoordinate | null,
    options: { forceRefresh?: boolean } = {},
  ) => {
    const requestId = ++catalogRequestIdRef.current;
    if (!center) {
      if (!mountedRef.current) return;
      setAllTrails([]);
      setError(null);
      setMeetups(await getTrailMeetups());
      setFavoriteIds(await getFavoriteTrailIds());
      setIsLoading(false);
      setIsRefreshing(false);
      logTrailDebug('No fallback/mock catalog used because no device coordinate is available.');
      return;
    }

    logTrailDebug('Coordinates sent to nearby trail search.', {
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMiles: 25,
      forceRefresh: Boolean(options.forceRefresh),
    });
    try {
      const [trails, trailMeetups, favorites] = await Promise.all([
        getTrails(center, options),
        getTrailMeetups(),
        getFavoriteTrailIds(),
      ]);
      if (!mountedRef.current || requestId !== catalogRequestIdRef.current) return;
      setAllTrails(trails);
      setMeetups(trailMeetups);
      setFavoriteIds(favorites);
      searchCenterRef.current = center;
      setSearchCenter(center);
      setMapCenter(center);
      setError(null);
      logTrailDebug('Nearby trail search completed.', {
        resultCount: trails.length,
        closestDistanceMiles: trails[0]?.distanceMiles ?? null,
        fallbackOrMockUsed: false,
      });
    } catch (catalogError) {
      logLocationProblem('Trail catalog loading failed.', catalogError);
      if (mountedRef.current && requestId === catalogRequestIdRef.current) {
        setError(
          catalogError instanceof TrailDiscoveryError
            ? catalogError.message
            : 'The nearby trail service is temporarily unavailable. Try again shortly.',
        );
      }
    } finally {
      if (mountedRef.current && requestId === catalogRequestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Gives simulators a clear no-location state without inventing GPS coordinates.
  const activateSimulatorPreview = useCallback(async (): Promise<TrailLocationResult> => {
    // Development preview only: this coordinate is never saved as the user's location.
    if (!__DEV__ || Platform.OS !== 'ios' || Device.isDevice) return { kind: 'unavailable' };
    if (mountedRef.current) {
      setUserLocation(null);
      setLocationCenter(null);
      setLocationStatus('simulator_fallback');
      setLocationWarning('Simulator location unavailable. Choose a simulated location from Xcode Features > Location.');
    }
    await loadCatalog(null);
    return { kind: 'simulator_fallback' };
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

          setUserLocation(coordinate);
          setLocationStatus('granted');
          setLocationWarning(null);
          logTrailDebug('Foreground device coordinate updated.', coordinate);

          if (
            !searchCenterRef.current
            || calculateDistanceMeters(coordinate, searchCenterRef.current)
              >= CATALOG_REFRESH_MOVEMENT_METERS
          ) {
            // Reserve this coordinate before starting the async request so a
            // burst of watch updates cannot issue duplicate nearby searches.
            searchCenterRef.current = coordinate;
            void loadCatalog(coordinate);
          }
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
  }, [loadCatalog]);

  // Checks permission once, uses cached GPS immediately, then tries for a fresh fix.
  const runLocationRequest = useCallback(async (forceRefresh = false): Promise<TrailLocationResult> => {
    const isIosSimulator = Platform.OS === 'ios' && !Device.isDevice;
    if (mountedRef.current) {
      setIsRefreshing(true);
      setLocationStatus('checking');
      setLocationWarning(null);
      setError(null);
    }

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      logTrailDebug('Location services status checked.', { servicesEnabled });
      if (!servicesEnabled) {
        if (isIosSimulator) return activateSimulatorPreview();
        if (mountedRef.current) {
          setLocationStatus('services_off');
          setLocationWarning('Turn on Location Services to explore trails and parks near you.');
        }
        await loadCatalog(null);
        return { kind: 'services_off' };
      }

      let permission = await Location.getForegroundPermissionsAsync();
      logTrailDebug('Foreground location permission status.', {
        status: permission.status,
        canAskAgain: permission.canAskAgain,
      });
      if (
        permission.status !== Location.PermissionStatus.GRANTED
        && permission.canAskAgain
      ) {
        permission = await Location.requestForegroundPermissionsAsync();
        logTrailDebug('Foreground location permission request completed.', {
          status: permission.status,
          canAskAgain: permission.canAskAgain,
        });
      }
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        if (isIosSimulator) return activateSimulatorPreview();
        if (mountedRef.current) {
          setLocationStatus('denied');
          setLocationWarning('Mission Trails needs location access to find trails and parks near you.');
        }
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
          logTrailDebug('Recent cached device coordinate accepted.', lastKnownCoordinate);
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
          setLocationWarning('We couldn’t determine your location. Move to an open area and try again.');
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
      logTrailDebug('Current device coordinate accepted.', coordinate);
      await loadCatalog(coordinate, { forceRefresh });
      await startLiveLocationUpdates();
      return { kind: 'located', coordinate, isPhysicalDevice: Device.isDevice };
    } catch (locationError) {
      logLocationProblem('Location request failed.', locationError);
      if (isIosSimulator) return activateSimulatorPreview();
      if (mountedRef.current) {
        setLocationStatus('unavailable');
        setLocationWarning('We couldn’t determine your location. Move to an open area and try again.');
      }
      await loadCatalog(null);
      return { kind: 'unavailable' };
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [activateSimulatorPreview, loadCatalog, startLiveLocationUpdates]);

  // Shares one request promise so fast repeated taps cannot start overlapping GPS work.
  const refresh = useCallback((forceRefresh = false): Promise<TrailLocationResult> => {
    if (locationRequestRef.current) return locationRequestRef.current;
    const request = runLocationRequest(forceRefresh).finally(() => {
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

  const hasPendingAreaSearch = Boolean(
    locationStatus === 'granted' && mapCenter && searchCenter
      && calculateDistanceMeters(mapCenter, searchCenter) >= SEARCH_AREA_MOVEMENT_METERS,
  );

  // Re-centers discovery on the real user; remote map panning must not expose
  // trails outside the nearby radius.
  const searchThisArea = useCallback(async () => {
    if (mountedRef.current) setIsRefreshing(true);
    if (userLocation && mountedRef.current) setMapCenter(userLocation);
    await loadCatalog(userLocation);
  }, [loadCatalog, userLocation]);

  // Saves or removes one trail favorite using the existing trail service.
  const toggleFavorite = useCallback(async (trailId: string) => {
    if (favoriteMutationIdsRef.current.has(trailId)) return;
    favoriteMutationIdsRef.current.add(trailId);
    const wasFavorite = favoriteIds.includes(trailId);
    if (mountedRef.current) {
      setFavoriteBusyIds((current) => [...current, trailId]);
      setFavoriteIds((current) => wasFavorite
        ? current.filter((id) => id !== trailId)
        : [...new Set([...current, trailId])]);
    }
    try {
      const next = await setTrailFavorite(trailId, !wasFavorite);
      if (mountedRef.current) setFavoriteIds(next);
    } catch (favoriteError) {
      if (mountedRef.current) {
        setFavoriteIds((current) => wasFavorite
          ? [...new Set([...current, trailId])]
          : current.filter((id) => id !== trailId));
      }
      throw favoriteError;
    } finally {
      favoriteMutationIdsRef.current.delete(trailId);
      if (mountedRef.current) {
        setFavoriteBusyIds((current) => current.filter((id) => id !== trailId));
      }
    }
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
    favoriteBusyIds,
    toggleFavorite,
    isLoading,
    isRefreshing,
    error,
    locationStatus,
    locationWarning,
    hasPendingAreaSearch,
    searchThisArea,
    refresh,
  };
}
