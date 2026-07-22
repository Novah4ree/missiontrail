import { createClient } from 'npm:@supabase/supabase-js@2.106.2';

import {
  METERS_PER_MILE,
  normalizeGeoapifyPlaces,
  normalizeGeoapifyRoute,
  type GeoapifyPlaceFeature,
} from '../_shared/trail-normalization.ts';

type Coordinate = { latitude?: number; longitude?: number };
type TrailRequest = {
  action?: 'search' | 'route';
  center?: Coordinate;
  origin?: Coordinate;
  destination?: Coordinate;
  radiusMeters?: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}

function validCoordinate(value: Coordinate | undefined): value is Required<Coordinate> {
  return typeof value?.latitude === 'number' && Number.isFinite(value.latitude) &&
    value.latitude >= -90 && value.latitude <= 90 &&
    typeof value.longitude === 'number' && Number.isFinite(value.longitude) &&
    value.longitude >= -180 && value.longitude <= 180;
}

async function requireUser(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const client = createClient(requireEnvironment('SUPABASE_URL'), requireEnvironment('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const admin = createClient(requireEnvironment('SUPABASE_URL'), requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { userId: data.user.id as string, admin };
}

async function geoapify(path: string, parameters: URLSearchParams) {
  parameters.set('apiKey', requireEnvironment('GEOAPIFY_API_KEY'));
  const result = await fetch(`https://api.geoapify.com${path}?${parameters.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!result.ok) throw new Error(`GEOAPIFY_${result.status}`);
  return result.json() as Promise<Record<string, unknown>>;
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED', requestId }, 405);

  try {
    const authentication = await requireUser(request);
    if (!authentication) return response({ error: 'UNAUTHORIZED', requestId }, 401);
    const body = await request.json().catch(() => ({})) as TrailRequest;
    const limit = Number(Deno.env.get('TRAIL_DISCOVERY_RATE_LIMIT_PER_MINUTE') ?? 20);
    const rate = await authentication.admin.rpc('server_consume_field_rate_limit', {
      p_subject_key: `user:${authentication.userId}`,
      p_endpoint: `trail-discovery:${body.action ?? 'unknown'}`,
      p_limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
    });
    if (rate.error) throw new Error('RATE_CHECK_FAILED');
    if (!rate.data) return response({ error: 'RATE_LIMITED', message: 'Please wait a moment before searching again.', requestId }, 429);

    if (body.action === 'search') {
      if (!validCoordinate(body.center)) return response({ error: 'INVALID_COORDINATE', requestId }, 400);
      const radius = Math.min(25 * METERS_PER_MILE, Math.max(500, body.radiusMeters ?? 10 * METERS_PER_MILE));
      const parameters = new URLSearchParams({
        categories: [
          'highway.footway', 'highway.path', 'leisure.park', 'leisure.park.nature_reserve',
          'natural.protected_area', 'national_park', 'tourism.information.ranger_station',
        ].join(','),
        filter: `circle:${body.center.longitude},${body.center.latitude},${radius}`,
        bias: `proximity:${body.center.longitude},${body.center.latitude}`,
        limit: '100',
      });
      const data = await geoapify('/v2/places', parameters);
      const features = Array.isArray(data.features) ? data.features as GeoapifyPlaceFeature[] : [];
      return response({ trails: normalizeGeoapifyPlaces(features, body.center), requestId });
    }

    if (body.action === 'route') {
      if (!validCoordinate(body.origin) || !validCoordinate(body.destination)) {
        return response({ error: 'INVALID_COORDINATE', requestId }, 400);
      }
      const parameters = new URLSearchParams({
        waypoints: `lonlat:${body.origin.longitude},${body.origin.latitude}|lonlat:${body.destination.longitude},${body.destination.latitude}`,
        mode: 'hike',
        details: 'elevation',
        format: 'geojson',
      });
      const data = await geoapify('/v1/routing', parameters);
      const features = Array.isArray(data.features) ? data.features : [];
      if (!features[0]) return response({ error: 'ROUTE_NOT_FOUND', requestId }, 404);
      return response({ route: normalizeGeoapifyRoute(features[0] as never), requestId });
    }

    return response({ error: 'INVALID_REQUEST', requestId }, 400);
  } catch (error) {
    console.error('Trail discovery request failed', error instanceof Error ? error.message : 'unknown');
    return response({
      error: 'TRAIL_SERVICE_UNAVAILABLE',
      message: 'Nearby trails are unavailable right now. Please try again.',
      requestId,
    }, 502);
  }
});
