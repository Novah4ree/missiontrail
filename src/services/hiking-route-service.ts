import { supabase } from '../../lib/supabase';
import type { HikingRoute, TrailSearchCoordinate } from '@/types/trails';

type HikingRouteResponse = { route?: HikingRoute };

// Routing stays behind the same Edge Function so the Geoapify key never enters
// the Expo bundle or a committed source file.
export async function getHikingRoute(origin: TrailSearchCoordinate, destination: TrailSearchCoordinate) {
  const { data, error } = await supabase.functions.invoke<HikingRouteResponse>('trail-discovery', {
    body: { action: 'route', origin, destination },
  });
  if (error || !data?.route) throw new Error('We couldn’t calculate a hiking route to this trail.');
  return data.route;
}

