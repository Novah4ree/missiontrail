import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import type { NearbyTrail, Trail, TrailSearchCoordinate } from '@/types/trails';
import { calculateDistanceMeters } from '@/utils/distance';
import { normalizeUsZipCode, validateCoordinate } from '@/utils/location-validation';
import { supabase } from '../../lib/supabase';

const CACHE_PREFIX = 'mission-trail:nearby-trails:v2:';
const CACHE_TTL_MS = 30 * 60 * 1_000;
const METERS_PER_MILE = 1_609.344;
const DEFAULT_RADIUS_METERS = 25 * METERS_PER_MILE;
const MIN_RADIUS_METERS = 500;

type TrailSearchResponse = { trails?: NearbyTrail[]; provider?: string; requestId?: string };
type LocationSearchResponse = {
  location?: { latitude?: number; longitude?: number; label?: string; zipCode?: string };
  provider?: string;
  requestId?: string;
};
type ReverseGeocodeResponse = {
  address?: {
    street?: string;
    locality?: string;
    state?: string;
    stateCode?: string;
    postalCode?: string;
    formatted?: string;
  };
};
type TrailDetailsResponse = {
  details?: {
    id?: string;
    routeDistanceMiles?: number;
    estimatedDurationMinutes?: number;
    geometry?: NearbyTrail['geometry'];
    metricSource?: NearbyTrail['metricSource'];
  };
};
type CachedSearch = { savedAt: number; trails: NearbyTrail[] };
type TrailErrorResponse = {
  error?: string;
  message?: string;
  operation?: string;
  technicalCode?: string;
  requestId?: string;
};

type TrailDiscoveryOperation =
  | 'trail_catalog'
  | 'zip_geocode'
  | 'location_geocode'
  | 'reverse_geocode'
  | 'trail_details';

export type TrailDiscoveryErrorCode =
  | 'offline'
  | 'authentication'
  | 'configuration'
  | 'rate_limited'
  | 'server'
  | 'invalid_response';

export class TrailDiscoveryError extends Error {
  constructor(
    public readonly code: TrailDiscoveryErrorCode,
    message: string,
    public readonly status?: number,
    public readonly requestId?: string,
    public readonly operation?: TrailDiscoveryOperation,
    public readonly technicalCode?: string,
    public readonly originalCause?: unknown,
  ) {
    super(message);
    this.name = 'TrailDiscoveryError';
  }
}

export type TrailLocationSearchResult = {
  latitude: number;
  longitude: number;
  label: string;
};

export type TrailAddressResult = NonNullable<ReverseGeocodeResponse['address']>;

function configurationMessage() {
  return __DEV__
    ? 'Nearby trail service is not configured correctly.'
    : 'The nearby trail service is temporarily unavailable. Try again shortly.';
}

function serviceHost() {
  try {
    return new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').host || 'unconfigured';
  } catch {
    return 'unconfigured';
  }
}

async function normalizeFunctionError(
  error: unknown,
  operation: TrailDiscoveryOperation,
): Promise<TrailDiscoveryError> {
  if (error instanceof FunctionsFetchError) {
    return new TrailDiscoveryError(
      'offline',
      "Couldn't load nearby trails right now. Check your connection and try again.",
      undefined,
      undefined,
      operation,
      'FUNCTION_FETCH_ERROR',
      error,
    );
  }

  if (error instanceof FunctionsHttpError) {
    const response = error.context instanceof Response ? error.context : null;
    const status = response?.status;
    let body: TrailErrorResponse = {};
    try {
      body = response ? await response.clone().json() as TrailErrorResponse : {};
    } catch {
      // An empty or non-JSON response is still classified by HTTP status.
    }
    if (body.error === 'ZIP_NOT_FOUND') {
      return new TrailDiscoveryError(
        'invalid_response',
        'That ZIP code was not found. Check it and try again.',
        status,
        body.requestId,
        operation,
        body.technicalCode,
        error,
      );
    }
    if (body.error === 'LOCATION_NOT_FOUND') {
      return new TrailDiscoveryError(
        'invalid_response',
        'That location was not found. Check it and try again.',
        status,
        body.requestId,
        operation,
        body.technicalCode,
        error,
      );
    }

    if (status === 401 || status === 403) {
      return new TrailDiscoveryError(
        'authentication',
        status === 401
          ? 'Your session expired. Sign in again to load nearby trails.'
          : 'Your account is not allowed to use nearby trail discovery.',
        status,
        body.requestId,
        operation,
        body.technicalCode,
        error,
      );
    }
    if (status === 404 || body.error === 'CONFIGURATION_ERROR') {
      return new TrailDiscoveryError(
        'configuration',
        configurationMessage(),
        status,
        body.requestId,
        operation,
        body.technicalCode,
        error,
      );
    }
    if (status === 429 || body.error === 'RATE_LIMITED') {
      return new TrailDiscoveryError(
        'rate_limited',
        'Too many nearby searches were requested. Wait a moment and try again.',
        status,
        body.requestId,
        operation,
        body.technicalCode,
        error,
      );
    }
    return new TrailDiscoveryError(
      'server',
      typeof body.message === 'string' && body.message.trim()
        ? body.message
        : "Couldn't load nearby trails right now. Check your connection and try again.",
      status,
      body.requestId,
      operation,
      body.technicalCode,
      error,
    );
  }

  if (error instanceof FunctionsRelayError) {
    return new TrailDiscoveryError(
      'server',
      "Couldn't load nearby trails right now. Check your connection and try again.",
      undefined,
      undefined,
      operation,
      'FUNCTION_RELAY_ERROR',
      error,
    );
  }

  return new TrailDiscoveryError(
    'server',
    "Couldn't load nearby trails right now. Check your connection and try again.",
    undefined,
    undefined,
    operation,
    'UNKNOWN_FUNCTION_ERROR',
    error,
  );
}

function normalizeRadiusMeters(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_RADIUS_METERS;
  }
  return Math.min(DEFAULT_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, value));
}

// Three decimal places groups positions into roughly neighborhood-sized cells,
// so walking a few feet does not spend another nearby-provider request.
export function trailSearchCacheKey(center: TrailSearchCoordinate, radiusMeters = DEFAULT_RADIUS_METERS) {
  return `${CACHE_PREFIX}${center.latitude.toFixed(3)}:${center.longitude.toFixed(3)}:${Math.round(radiusMeters)}`;
}

function distancesFromActiveLocation(
  trails: NearbyTrail[],
  activeLocation: TrailSearchCoordinate,
  radiusMeters: number,
) {
  return trails.flatMap((trail) => {
    const coordinate = validateCoordinate(trail.latitude, trail.longitude);
    if (!coordinate) return [];
    const distanceMeters = calculateDistanceMeters(activeLocation, coordinate);
    if (distanceMeters > radiusMeters) return [];
    return [{ ...trail, ...coordinate, distanceMiles: distanceMeters / METERS_PER_MILE }];
  }).sort((left, right) => left.distanceMiles - right.distanceMiles);
}

export async function searchNearbyTrails(
  activeLocation: TrailSearchCoordinate,
  options: { radiusMeters?: number; forceRefresh?: boolean } = {},
) {
  const radiusMeters = normalizeRadiusMeters(options.radiusMeters);
  const cacheKey = trailSearchCacheKey(activeLocation, radiusMeters);

  if (!options.forceRefresh) {
    const cachedValue = await AsyncStorage.getItem(cacheKey);
    if (cachedValue) {
      try {
        const cached = JSON.parse(cachedValue) as CachedSearch;
        if (Date.now() - cached.savedAt < CACHE_TTL_MS && Array.isArray(cached.trails)) {
          return distancesFromActiveLocation(cached.trails, activeLocation, radiusMeters);
        }
      } catch {
        // Ignore a damaged cache entry and replace it with a server response.
      }
    }
  }

  if (__DEV__) {
    console.info('[TRAIL REQUEST]', {
      host: serviceHost(),
      latitude: activeLocation.latitude,
      longitude: activeLocation.longitude,
      radiusMiles: radiusMeters / METERS_PER_MILE,
    });
  }
  const { data, error, response } = await supabase.functions.invoke<TrailSearchResponse>('trail-discovery', {
    body: {
      action: 'search',
      center: {
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
      },
      radiusMeters,
    },
  });
  if (error) {
    const normalizedError = await normalizeFunctionError(error, 'trail_catalog');
    if (__DEV__) {
      console.warn('[TRAIL PROVIDER ERROR]', {
        host: serviceHost(),
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
        radiusMiles: radiusMeters / METERS_PER_MILE,
        status: normalizedError.status ?? response?.status ?? null,
        errorType: normalizedError.code,
        technicalCode: normalizedError.technicalCode ?? null,
        message: normalizedError.message,
      });
    }
    throw normalizedError;
  }
  if (!Array.isArray(data?.trails)) {
    const invalidResponse = new TrailDiscoveryError(
      'invalid_response',
      "Couldn't load nearby trails right now. Check your connection and try again.",
      response?.status,
      data?.requestId,
      'trail_catalog',
      'INVALID_TRAIL_RESPONSE',
    );
    if (__DEV__) {
      console.warn('[TRAIL PROVIDER ERROR]', {
        host: serviceHost(),
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
        radiusMiles: radiusMeters / METERS_PER_MILE,
        status: response?.status ?? null,
        errorType: invalidResponse.code,
        technicalCode: invalidResponse.technicalCode,
        message: invalidResponse.message,
      });
    }
    throw invalidResponse;
  }

  const trails = distancesFromActiveLocation(data.trails, activeLocation, radiusMeters);
  if (__DEV__) {
    console.info('[TRAIL RESPONSE]', {
      host: serviceHost(),
      status: response?.status ?? 200,
      provider: data.provider ?? 'unknown',
      resultCount: trails.length,
    });
  }
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), trails } satisfies CachedSearch));
  return trails;
}

/** Finds a city or area without replacing the device's GPS location. */
export async function searchTrailLocation(query: string): Promise<TrailLocationSearchResult> {
  const search = query.trim();
  if (search.length < 2) {
    throw new TrailDiscoveryError('invalid_response', 'Enter a city or area to search.');
  }

  const { data, error } = await supabase.functions.invoke<LocationSearchResponse>('trail-discovery', {
    body: { action: 'geocode', query: search },
  });
  if (error) throw await normalizeFunctionError(error, 'location_geocode');
  const location = data?.location;
  if (
    !location
    || !validateCoordinate(location.latitude, location.longitude)
    || typeof location.label !== 'string'
  ) {
    throw new TrailDiscoveryError(
      'invalid_response',
      `Couldn't find “${search}”. Try a city or area name.`,
      undefined,
      data?.requestId,
      'location_geocode',
      'INVALID_LOCATION_RESPONSE',
    );
  }
  return {
    latitude: location.latitude as number,
    longitude: location.longitude as number,
    label: location.label,
  };
}

export async function searchZipLocation(zipCode: string): Promise<TrailLocationSearchResult> {
  const normalizedZip = normalizeUsZipCode(zipCode);
  if (!normalizedZip) {
    throw new TrailDiscoveryError('invalid_response', 'Enter a five-digit US ZIP code.');
  }

  try {
    const { data, error, response } = await supabase.functions.invoke<LocationSearchResponse>('trail-discovery', {
      body: { action: 'geocode_zip', query: normalizedZip },
    });
    if (__DEV__) {
      console.info('[ZIP REQUEST]', {
        zipCode: normalizedZip,
        urlHost: serviceHost(),
        status: response?.status ?? null,
      });
    }
    if (error) throw await normalizeFunctionError(error, 'zip_geocode');
    const location = data?.location;
    const coordinate = validateCoordinate(location?.latitude, location?.longitude);
    if (__DEV__) {
      console.info('[ZIP RESPONSE]', {
        zipCode: normalizedZip,
        status: response?.status ?? 200,
        resultCount: location ? 1 : 0,
      });
    }
    if (
      !location
      || !coordinate
      || location.zipCode !== normalizedZip
    ) {
      throw new TrailDiscoveryError(
        'invalid_response',
        'That ZIP code was not found. Check it and try again.',
        response?.status,
        data?.requestId,
        'zip_geocode',
        'INVALID_ZIP_RESPONSE',
      );
    }
    return {
      ...coordinate,
      label: `Search area: ${normalizedZip}`,
    };
  } catch (error) {
    const normalizedError = error instanceof TrailDiscoveryError
      ? error
      : new TrailDiscoveryError(
        'server',
        'ZIP lookup failed. Please try again.',
        undefined,
        undefined,
        'zip_geocode',
        'UNKNOWN_ZIP_ERROR',
        error,
      );
    if (__DEV__) {
      console.warn('[ZIP ERROR]', {
        zipCode: normalizedZip,
        status: normalizedError.status ?? null,
        errorType: normalizedError.code,
        technicalCode: normalizedError.technicalCode ?? null,
        message: normalizedError.message,
      });
    }
    if (error instanceof TrailDiscoveryError && error.code === 'offline') {
      throw new TrailDiscoveryError(
        'offline',
        'ZIP lookup needs a network connection. Check your connection and try again.',
        error.status,
        error.requestId,
        'zip_geocode',
        error.technicalCode,
        error.originalCause,
      );
    }
    throw normalizedError;
  }
}

/** Resolves a selected trail point through the existing authenticated OSM geocoder. */
export async function reverseGeocodeTrailLocation(
  coordinate: TrailSearchCoordinate,
): Promise<TrailAddressResult> {
  const validated = validateCoordinate(coordinate.latitude, coordinate.longitude);
  if (!validated) {
    throw new TrailDiscoveryError('invalid_response', 'The trail coordinates are invalid.');
  }

  const { data, error } = await supabase.functions.invoke<ReverseGeocodeResponse>('trail-discovery', {
    body: { action: 'reverse_geocode', center: validated },
  });
  if (error) throw await normalizeFunctionError(error, 'reverse_geocode');

  const address = data?.address;
  if (!address || !Object.values(address).some((value) => typeof value === 'string' && value.trim())) {
    throw new TrailDiscoveryError(
      'invalid_response',
      'No address is available for this trail location.',
      undefined,
      undefined,
      'reverse_geocode',
      'INVALID_REVERSE_GEOCODE_RESPONSE',
    );
  }
  return address;
}

/** Loads metrics only for the exact selected OSM identity. */
export async function enrichTrailDetails(trail: Trail): Promise<Trail> {
  if (trail.source !== 'openstreetmap') return trail;

  const { data, error } = await supabase.functions.invoke<TrailDetailsResponse>('trail-discovery', {
    body: { action: 'trail_details', trailId: trail.id },
  });
  if (error) throw await normalizeFunctionError(error, 'trail_details');
  const details = data?.details;
  if (!details || details.id !== trail.id) return trail;

  const routeDistanceMiles = typeof details.routeDistanceMiles === 'number'
    && Number.isFinite(details.routeDistanceMiles)
    && details.routeDistanceMiles > 0
    ? details.routeDistanceMiles
    : undefined;
  const estimatedDurationMinutes = typeof details.estimatedDurationMinutes === 'number'
    && Number.isFinite(details.estimatedDurationMinutes)
    && details.estimatedDurationMinutes > 0
    ? Math.round(details.estimatedDurationMinutes)
    : undefined;
  const geometry = details.geometry?.type === 'LineString'
    && Array.isArray(details.geometry.coordinates)
    && details.geometry.coordinates.length >= 2
    ? details.geometry
    : undefined;

  return {
    ...trail,
    ...(routeDistanceMiles ? {
      routeDistanceMiles,
      lengthMiles: routeDistanceMiles,
    } : {}),
    ...(estimatedDurationMinutes ? { estimatedDurationMinutes } : {}),
    ...(geometry ? { geometry } : {}),
    ...(details.metricSource ? { metricSource: details.metricSource } : {}),
  };
}

export const TRAIL_SEARCH_RADIUS_METERS = DEFAULT_RADIUS_METERS;
