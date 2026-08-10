import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocationState } from '@/providers/location-provider';
import {
  getFavoriteTrailIds,
  getTrailMeetups,
  getTrails,
  setTrailFavorite,
} from '@/services/trail-data-service';
import { searchZipLocation, TrailDiscoveryError } from '@/services/trail-discovery-service';
import type { Trail, TrailFilters, TrailSearchCoordinate } from '@/types/trails';
import { calculateDistanceMeters } from '@/utils/distance';
import { normalizeUsZipCode } from '@/utils/location-validation';
import {
  getActiveSearchCoordinate,
  getNearbyLocationAction,
} from '@/utils/nearby-location-policy';
import { EMPTY_TRAIL_FILTERS, filterTrails } from '@/utils/trail-filters';

const SEARCH_AREA_MOVEMENT_METERS = 250;
const REVERSE_GEOCODE_MIN_INTERVAL_MS = 5 * 60 * 1_000;
const US_STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY',
  Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
  Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC',
};
export type TrailLocationResult =
  | { kind: 'located'; coordinate: TrailSearchCoordinate; source: 'gps' }
  | { kind: 'denied' | 'services_off' | 'unavailable' }
  | { kind: 'superseded' };

// Prints technical details only during development, keeping user messages simple.
function logLocationProblem(message: string, error?: unknown) {
  if (!__DEV__) return;
  const diagnostic = error instanceof TrailDiscoveryError
    ? {
      name: error.name,
      code: error.code,
      operation: error.operation ?? null,
      status: error.status ?? null,
      technicalCode: error.technicalCode ?? null,
      message: error.message,
    }
    : error instanceof Error
      ? { name: error.name, message: error.message }
      : error ?? null;
  console.warn('[LOCATION ERROR]', { message, error: diagnostic });
}

export function useNearbyTrails() {
  const {
    location,
    requestCurrentLocation,
    setGpsLocation,
    setZipLocation,
    updateGpsAddress,
    beginLocationSearch,
  } = useLocationState();
  const [mapCameraLocation, setMapCameraLocation] = useState<TrailSearchCoordinate | null>(null);
  const [allTrails, setAllTrails] = useState<Trail[]>([]);
  const [meetups, setMeetups] = useState<Awaited<ReturnType<typeof getTrailMeetups>>>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteBusyIds, setFavoriteBusyIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<TrailFilters>(EMPTY_TRAIL_FILTERS);
  const [query, setQuery] = useState('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [isSearchingZip, setIsSearchingZip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const locationRequestRef = useRef<Promise<TrailLocationResult> | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const locationActionRef = useRef(0);
  const catalogRequestIdRef = useRef(0);
  const geocodeRequestIdRef = useRef(0);
  const loadedLocationRef = useRef<TrailSearchCoordinate | null>(null);
  const loadedLocationSourceRef = useRef<'gps' | 'zip' | null>(null);
  const reverseGeocodeRef = useRef<{ coordinate: TrailSearchCoordinate; requestedAt: number } | null>(null);
  const loggedInitialGpsRef = useRef(false);
  // Tracks the center represented by the currently displayed result set.
  // This is intentionally separate from loadedLocationRef, which reserves a
  // center while an async request is in flight to prevent duplicate loads.
  const catalogLocationRef = useRef<TrailSearchCoordinate | null>(null);
  const favoriteMutationIdsRef = useRef(new Set<string>());

  const startLiveLocationUpdates = useCallback(async (actionId: number) => {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 25,
          timeInterval: 5_000,
        },
        (position) => {
          if (mountedRef.current && actionId === locationActionRef.current) {
            setGpsLocation(position);
          }
        },
      );
      if (!mountedRef.current || actionId !== locationActionRef.current) {
        subscription.remove();
        return;
      }
      locationSubscriptionRef.current = subscription;
    } catch (watchError) {
      logLocationProblem('Foreground GPS updates could not start.', watchError);
    }
  }, [setGpsLocation]);

  // Uses the device's reverse-geocoder only for readable UI copy. Coordinates
  // remain the source of truth for all nearby searches and distance math.
  const updateAreaLabel = useCallback(async (center: TrailSearchCoordinate) => {
    const requestId = ++geocodeRequestIdRef.current;
    try {
      const [place] = await Location.reverseGeocodeAsync(center);
      if (!mountedRef.current || requestId !== geocodeRequestIdRef.current || !place) return;
      const city = [place.city, place.subregion, place.district]
        .map((value) => value?.trim())
        .find(Boolean);
      const region = place.region?.trim();
      const state = region
        ? US_STATE_ABBREVIATIONS[region] ?? region
        : undefined;
      updateGpsAddress(center, {
        city,
        state,
        zipCode: place.postalCode?.trim() || undefined,
      });
    } catch (geocodeError) {
      logLocationProblem('Reverse geocoding was unavailable.', geocodeError);
    }
  }, [updateGpsAddress]);

  // Loads trail cards for one coordinate and ignores responses from stale searches.
  const loadCatalog = useCallback(async (
    activeLocation?: TrailSearchCoordinate | null,
    options: { forceRefresh?: boolean; source?: 'gps' | 'zip' } = {},
  ) => {
    const requestId = ++catalogRequestIdRef.current;
    if (!activeLocation) {
      if (!mountedRef.current) return;
      setAllTrails([]);
      loadedLocationRef.current = null;
      loadedLocationSourceRef.current = null;
      catalogLocationRef.current = null;
      setError(null);
      setMeetups(await getTrailMeetups());
      setFavoriteIds(await getFavoriteTrailIds());
      setIsLoadingCatalog(false);
      setIsRefreshingCatalog(false);
      return;
    }

    const displayedCenter = catalogLocationRef.current;
    const isDifferentSearchArea = !displayedCenter
      || displayedCenter.latitude !== activeLocation.latitude
      || displayedCenter.longitude !== activeLocation.longitude;
    if (isDifferentSearchArea && mountedRef.current) {
      // Never present trails from the previous GPS/ZIP area beneath a newly
      // active location while its request is pending or after it fails.
      setAllTrails([]);
      catalogLocationRef.current = null;
      setIsLoadingCatalog(true);
      setIsRefreshingCatalog(false);
    } else if (mountedRef.current) {
      setIsRefreshingCatalog(true);
    }
    try {
      const [trails, trailMeetups, favorites] = await Promise.all([
        getTrails(activeLocation, options),
        getTrailMeetups(),
        getFavoriteTrailIds(),
      ]);
      if (!mountedRef.current || requestId !== catalogRequestIdRef.current) return;
      setAllTrails(trails);
      setMeetups(trailMeetups);
      setFavoriteIds(favorites);
      loadedLocationRef.current = activeLocation;
      loadedLocationSourceRef.current = options.source ?? null;
      catalogLocationRef.current = activeLocation;
      setError(null);
      if (__DEV__) {
        console.info('[TRAIL SEARCH COORDINATES]', {
          source: options.source ?? 'unknown',
          latitude: activeLocation.latitude,
          longitude: activeLocation.longitude,
          radiusMiles: 25,
          resultCount: trails.length,
        });
      }
    } catch (catalogError) {
      logLocationProblem('Trail catalog loading failed.', catalogError);
      if (mountedRef.current && requestId === catalogRequestIdRef.current) {
        setError(
          catalogError instanceof TrailDiscoveryError
            ? catalogError.message
            : "Couldn't load nearby trails right now. Check your connection and try again.",
        );
      }
    } finally {
      if (mountedRef.current && requestId === catalogRequestIdRef.current) {
        setIsLoadingCatalog(false);
        setIsRefreshingCatalog(false);
      }
    }
  }, []);

  // Requests a fresh GPS fix from the centralized foreground-location provider.
  const runLocationRequest = useCallback(async (forceRefresh = false): Promise<TrailLocationResult> => {
    const actionId = ++locationActionRef.current;
    const preserveZipOnFailure = location.activeLocation?.source === 'zip';
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    if (mountedRef.current) {
      setError(null);
      setIsSearchingZip(false);
    }

    try {
      const result = await requestCurrentLocation();
      if (result.kind === 'superseded' || actionId !== locationActionRef.current) return { kind: 'superseded' };
      if (result.kind !== 'located') {
        if (!preserveZipOnFailure) await loadCatalog(null);
        return { kind: result.kind };
      }

      if (__DEV__ && !loggedInitialGpsRef.current) {
        loggedInitialGpsRef.current = true;
        console.info('[GPS] First accepted position', result.coordinate);
      }
      loadedLocationRef.current = result.coordinate;
      if (mountedRef.current) {
        setMapCameraLocation(result.coordinate);
      }
      await loadCatalog(result.coordinate, { forceRefresh, source: 'gps' });
      if (!mountedRef.current || actionId !== locationActionRef.current) {
        return { kind: 'superseded' };
      }
      void startLiveLocationUpdates(actionId);
      return result;
    } catch (locationError) {
      logLocationProblem('Location request failed.', locationError);
      if (actionId === locationActionRef.current && !preserveZipOnFailure) await loadCatalog(null);
      return { kind: 'unavailable' };
    } finally {
      if (mountedRef.current && actionId === locationActionRef.current) {
        setIsLoadingCatalog(false);
        setIsRefreshingCatalog(false);
      }
    }
  }, [loadCatalog, location.activeLocation?.source, requestCurrentLocation, startLiveLocationUpdates]);

  // Shares one request promise so fast repeated taps cannot start overlapping GPS work.
  const requestGpsLocation = useCallback((forceRefresh = false): Promise<TrailLocationResult> => {
    if (locationRequestRef.current) return locationRequestRef.current;
    const request = runLocationRequest(forceRefresh).finally(() => {
      if (locationRequestRef.current === request) locationRequestRef.current = null;
    });
    locationRequestRef.current = request;
    return request;
  }, [runLocationRequest]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, []);

  // Live centralized state decides the mount behavior. Existing GPS/ZIP
  // locations are loaded by the active-location effect below; only NONE asks
  // for GPS, and the stable dependency prevents a request loop.
  const activeLocationSource = location.activeLocation?.source ?? 'none';
  useEffect(() => {
    if (activeLocationSource === 'none') {
      void requestGpsLocation();
      return;
    }
    if (activeLocationSource !== 'gps') return;
    // A request that just activated GPS owns watcher startup after its catalog
    // finishes. This branch is only for a remount with pre-existing GPS state.
    if (locationRequestRef.current) return;

    const actionId = ++locationActionRef.current;
    void startLiveLocationUpdates(actionId);
    return () => {
      if (actionId !== locationActionRef.current) return;
      locationActionRef.current += 1;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, [activeLocationSource, requestGpsLocation, startLiveLocationUpdates]);

  // Any validated active-location coordinate update moves the camera and
  // refreshes nearby results. The service cache absorbs same-area requests.
  useEffect(() => {
    const active = location.activeLocation;
    const center = getActiveSearchCoordinate(active);
    if (!active || !center || !mountedRef.current) return;
    const lastReverseGeocode = reverseGeocodeRef.current;
    const shouldReverseGeocode = active.source === 'gps'
      && !active.city
      && !active.state
      && (!lastReverseGeocode
        || Date.now() - lastReverseGeocode.requestedAt >= REVERSE_GEOCODE_MIN_INTERVAL_MS
        || calculateDistanceMeters(lastReverseGeocode.coordinate, center) >= SEARCH_AREA_MOVEMENT_METERS);
    if (shouldReverseGeocode) {
      reverseGeocodeRef.current = { coordinate: center, requestedAt: Date.now() };
      void updateAreaLabel(center);
    }

    const previousLoadedLocation = loadedLocationRef.current;
    const movedEnough = !previousLoadedLocation
      || calculateDistanceMeters(previousLoadedLocation, center) >= SEARCH_AREA_MOVEMENT_METERS;
    const sourceChanged = active.source !== loadedLocationSourceRef.current;
    if (
      sourceChanged || movedEnough
    ) {
      loadedLocationRef.current = center;
      void loadCatalog(center, { source: active.source === 'zip' ? 'zip' : 'gps' });
    }
  }, [
    loadCatalog,
    location.activeLocation,
    updateAreaLabel,
  ]);

  // Pull-to-refresh and retry reload the active search area. They must not
  // convert an explicit ZIP search back into GPS mode.
  const refresh = useCallback(async (forceRefresh = false) => {
    const active = location.activeLocation;
    if (getNearbyLocationAction(active) === 'load_zip' && active) {
      if (mountedRef.current) {
        setError(null);
      }
      await loadCatalog(
        { latitude: active.latitude, longitude: active.longitude },
        { forceRefresh, source: 'zip' },
      );
      return;
    }
    await requestGpsLocation(forceRefresh);
  }, [
    loadCatalog,
    location.activeLocation,
    requestGpsLocation,
  ]);

  const trails = useMemo(
    () => filterTrails(allTrails, filters, meetups, query),
    [allTrails, filters, meetups, query],
  );

  const meetupCounts = useMemo(() => meetups.reduce<Record<string, number>>((counts, meetup) => {
    counts[meetup.trailId] = (counts[meetup.trailId] ?? 0) + 1;
    return counts;
  }, {}), [meetups]);

  const activeLocation = location.activeLocation;
  const currentUserLocation = location.currentGpsLocation;

  const locationStatus = activeLocation
    ? 'granted'
    : location.permissionStatus === 'granted'
      ? 'unavailable'
      : location.permissionStatus === 'unknown'
        ? 'not_requested'
        : location.permissionStatus;
  const activeCoordinate = getActiveSearchCoordinate(activeLocation);
  const hasPendingAreaSearch = Boolean(
    mapCameraLocation && activeCoordinate
      && calculateDistanceMeters(mapCameraLocation, activeCoordinate) >= SEARCH_AREA_MOVEMENT_METERS,
  );

  // Resolves a US ZIP into an active search area. Non-numeric text continues
  // to act only as the existing trail/park name filter.
  const searchLocation = useCallback(async (query: string) => {
    const search = query.trim();
    if (mountedRef.current) {
      setIsSearchingZip(true);
      setError(null);
    }
    if (!search) {
      if (mountedRef.current) {
        setError('Enter a five-digit US ZIP code or a trail or park name.');
        setIsSearchingZip(false);
      }
      return null;
    }
    if (!/^\d/.test(search)) {
      if (mountedRef.current) setIsSearchingZip(false);
      return null;
    }
    const zipCode = normalizeUsZipCode(search);
    if (!zipCode) {
      if (mountedRef.current) {
        setError('Enter a five-digit US ZIP code.');
        setIsSearchingZip(false);
      }
      return null;
    }
    const actionId = ++locationActionRef.current;
    geocodeRequestIdRef.current += 1;
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    beginLocationSearch();
    locationRequestRef.current = null;
    try {
      const zipLocation = await searchZipLocation(zipCode);
      if (actionId !== locationActionRef.current) return null;
      const center = { latitude: zipLocation.latitude, longitude: zipLocation.longitude };
      if (!mountedRef.current) return null;
      loadedLocationRef.current = center;
      if (!setZipLocation(center, zipCode)) {
        setError('That ZIP code did not resolve to a valid search location.');
        return null;
      }
      if (__DEV__) {
        console.info('[ZIP SEARCH RESULT]', {
          zipCode,
          latitude: center.latitude,
          longitude: center.longitude,
        });
      }
      setMapCameraLocation(center);
      await loadCatalog(center, { forceRefresh: true, source: 'zip' });
      if (!mountedRef.current || actionId !== locationActionRef.current) return null;
      return zipLocation;
    } catch (searchError) {
      logLocationProblem('City/area search failed.', searchError);
      if (mountedRef.current && actionId === locationActionRef.current) {
        setError(searchError instanceof TrailDiscoveryError
          ? searchError.message
          : "Couldn't load nearby trails right now. Check your connection and try again.");
      }
      return null;
    } finally {
      if (mountedRef.current && actionId === locationActionRef.current) {
        setIsSearchingZip(false);
      }
    }
  }, [beginLocationSearch, loadCatalog, setZipLocation]);

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
    activeLocation,
    currentUserLocation,
    mapCameraLocation,
    locationSource: location.activeLocation?.source ?? 'none',
    areaLabel: location.activeLocation?.source === 'zip'
      ? `Search area: ${location.activeLocation.zipCode}`
      : [location.activeLocation?.city, location.activeLocation?.state].filter(Boolean).join(', ')
        || (location.activeLocation?.source === 'gps' ? 'Current location' : null),
    setMapCameraLocation,
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
    isLoading: isLoadingCatalog,
    isRefreshing: isRefreshingCatalog || isSearchingZip,
    isLoadingCatalog,
    isRefreshingCatalog,
    isSearchingZip,
    isLocating: location.isRequestingGps,
    isRequestingGps: location.isRequestingGps,
    error,
    locationStatus,
    locationWarning: location.error,
    hasPendingAreaSearch,
    searchLocation,
    refresh,
    useMyLocation: requestGpsLocation,
  };
}
