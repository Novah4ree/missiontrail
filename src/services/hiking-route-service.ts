import { FunctionsHttpError } from '@supabase/supabase-js';

import type { HikingRoute, TrailSearchCoordinate } from '@/types/trails';
import { validateCoordinate } from '@/utils/location-validation';
import { getValidLineCoordinates } from '@/utils/trail-location';
import { supabase } from '../../lib/supabase';

type HikingRouteResponse = { route?: HikingRoute };

export class HikingRouteError extends Error {
  constructor(
    public readonly code: 'not_configured' | 'unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'HikingRouteError';
  }
}

async function normalizeRouteError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: unknown } | null;
    if (body?.error === 'CONFIGURATION_ERROR') {
      return new HikingRouteError(
        'not_configured',
        'Directions unavailable.',
      );
    }
  }
  return new HikingRouteError(
    'unavailable',
    'Directions unavailable.',
  );
}

// Routing stays behind the same Edge Function so the Geoapify key never enters
// the Expo bundle or a committed source file.
export async function getHikingRoute(origin: TrailSearchCoordinate, destination: TrailSearchCoordinate) {
  if (
    !validateCoordinate(origin.latitude, origin.longitude)
    || !validateCoordinate(destination.latitude, destination.longitude)
  ) {
    throw new Error('Directions require valid origin and trailhead coordinates.');
  }
  const { data, error } = await supabase.functions.invoke<HikingRouteResponse>('trail-discovery', {
    body: { action: 'route', origin, destination },
  });
  if (error) throw await normalizeRouteError(error);
  if (
    !data?.route
    || !Number.isFinite(data.route.distanceMiles)
    || data.route.distanceMiles <= 0
    || !Number.isFinite(data.route.durationMinutes)
    || data.route.durationMinutes <= 0
    || getValidLineCoordinates(data.route.geometry).length < 2
  ) {
    throw new HikingRouteError(
      'unavailable',
      'Directions unavailable.',
    );
  }
  return data.route;
}
