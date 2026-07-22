import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../lib/supabase';
import type { NearbyTrail, TrailSearchCoordinate } from '@/types/trails';

const CACHE_PREFIX = 'mission-trail:nearby-trails:v1:';
const CACHE_TTL_MS = 30 * 60 * 1_000;
const DEFAULT_RADIUS_METERS = 10 * 1_609.344;

type TrailSearchResponse = { trails?: NearbyTrail[] };
type CachedSearch = { savedAt: number; trails: NearbyTrail[] };

export class TrailDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrailDiscoveryError';
  }
}

// Three decimal places groups positions into roughly neighborhood-sized cells,
// so walking a few feet does not spend another Geoapify request.
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
        if (Date.now() - cached.savedAt < CACHE_TTL_MS && Array.isArray(cached.trails)) return cached.trails;
      } catch {
        // Ignore a damaged cache entry and replace it with a server response.
      }
    }
  }

  const { data, error } = await supabase.functions.invoke<TrailSearchResponse>('trail-discovery', {
    body: { action: 'search', center, radiusMeters },
  });
  if (error || !Array.isArray(data?.trails)) {
    throw new TrailDiscoveryError('We couldn’t load nearby trails. Check your connection and try again.');
  }

  const trails = [...data.trails].sort((left, right) => left.distanceMiles - right.distanceMiles);
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), trails } satisfies CachedSearch));
  return trails;
}

export const TRAIL_SEARCH_RADIUS_METERS = DEFAULT_RADIUS_METERS;

