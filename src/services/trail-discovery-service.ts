import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import type { NearbyTrail, TrailSearchCoordinate } from '@/types/trails';

const CACHE_PREFIX = 'mission-trail:nearby-trails:v2:';
const CACHE_TTL_MS = 30 * 60 * 1_000;
const DEFAULT_RADIUS_METERS = 25 * 1_609.344;

type TrailSearchResponse = { trails?: NearbyTrail[] };
type CachedSearch = { savedAt: number; trails: NearbyTrail[] };
type TrailErrorResponse = {
  error?: string;
  message?: string;
  requestId?: string;
};

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
  ) {
    super(message);
    this.name = 'TrailDiscoveryError';
  }
}

function developmentLog(message: string, details?: unknown) {
  if (__DEV__) console.log(`[Trails] ${message}`, details ?? '');
}

function configurationMessage() {
  return __DEV__
    ? 'Nearby trail service is not configured correctly.'
    : 'The nearby trail service is temporarily unavailable. Try again shortly.';
}

async function normalizeFunctionError(error: unknown): Promise<TrailDiscoveryError> {
  if (error instanceof FunctionsFetchError) {
    return new TrailDiscoveryError(
      'offline',
      'You appear to be offline. Connect to the internet and try again.',
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

    if (status === 401) {
      return new TrailDiscoveryError(
        'authentication',
        'Your session expired. Sign in again to load nearby trails.',
        status,
        body.requestId,
      );
    }
    if (status === 404 || body.error === 'CONFIGURATION_ERROR') {
      return new TrailDiscoveryError(
        'configuration',
        configurationMessage(),
        status,
        body.requestId,
      );
    }
    if (status === 429 || body.error === 'RATE_LIMITED') {
      return new TrailDiscoveryError(
        'rate_limited',
        'Too many nearby searches were requested. Wait a moment and try again.',
        status,
        body.requestId,
      );
    }
    return new TrailDiscoveryError(
      'server',
      'The nearby trail service is temporarily unavailable. Try again shortly.',
      status,
      body.requestId,
    );
  }

  if (error instanceof FunctionsRelayError) {
    return new TrailDiscoveryError(
      'server',
      'The nearby trail service is temporarily unavailable. Try again shortly.',
    );
  }

  return new TrailDiscoveryError(
    'server',
    'The nearby trail service is temporarily unavailable. Try again shortly.',
  );
}

// Three decimal places groups positions into roughly neighborhood-sized cells,
// so walking a few feet does not spend another nearby-provider request.
export function trailSearchCacheKey(center: TrailSearchCoordinate, radiusMeters = DEFAULT_RADIUS_METERS) {
  return `${CACHE_PREFIX}${center.latitude.toFixed(3)}:${center.longitude.toFixed(3)}:${Math.round(radiusMeters)}`;
}

export async function searchNearbyTrails(
  center: TrailSearchCoordinate,
  options: { radiusMeters?: number; forceRefresh?: boolean } = {},
) {
  const radiusMeters = options.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const cacheKey = trailSearchCacheKey(center, radiusMeters);

  if (!options.forceRefresh) {
    const cachedValue = await AsyncStorage.getItem(cacheKey);
    if (cachedValue) {
      try {
        const cached = JSON.parse(cachedValue) as CachedSearch;
        if (Date.now() - cached.savedAt < CACHE_TTL_MS && Array.isArray(cached.trails)) {
          developmentLog('Response status:', 'local-cache');
          developmentLog('Results received:', cached.trails.length);
          return cached.trails;
        }
      } catch {
        // Ignore a damaged cache entry and replace it with a server response.
      }
    }
  }

  const requestUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/trail-discovery`;
  developmentLog('Request URL:', requestUrl);
  developmentLog('Request coordinates:', {
    latitude: center.latitude,
    longitude: center.longitude,
    radiusMeters,
  });

  const { data, error, response } = await supabase.functions.invoke<TrailSearchResponse>('trail-discovery', {
    body: { action: 'search', center, radiusMeters },
  });
  developmentLog('Response status:', response?.status ?? 'no-response');

  if (error) {
    const normalizedError = await normalizeFunctionError(error);
    developmentLog('Request error:', {
      name: error instanceof Error ? error.name : 'UnknownError',
      code: normalizedError.code,
      status: normalizedError.status ?? null,
      requestId: normalizedError.requestId ?? null,
    });
    throw normalizedError;
  }
  if (!Array.isArray(data?.trails)) {
    const invalidResponse = new TrailDiscoveryError(
      'invalid_response',
      'The nearby trail service returned an invalid response. Try again shortly.',
      response?.status,
    );
    developmentLog('Request error:', {
      code: invalidResponse.code,
      status: invalidResponse.status ?? null,
    });
    throw invalidResponse;
  }

  const trails = [...data.trails].sort((left, right) => left.distanceMiles - right.distanceMiles);
  developmentLog('Results received:', trails.length);
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), trails } satisfies CachedSearch));
  return trails;
}

export const TRAIL_SEARCH_RADIUS_METERS = DEFAULT_RADIUS_METERS;
