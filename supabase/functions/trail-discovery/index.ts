import { createClient } from 'npm:@supabase/supabase-js@2.106.2';

import {
  METERS_PER_MILE,
  normalizeGeoapifyRoute,
  normalizeOverpassPlaces,
  type OverpassElement,
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

// Purpose: Implements the response operation.
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Purpose: Implements the require environment operation.
function requireEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}

// Purpose: Implements the valid coordinate operation.
function validCoordinate(value: Coordinate | undefined): value is Required<Coordinate> {
  return typeof value?.latitude === 'number' && Number.isFinite(value.latitude) &&
    value.latitude >= -90 && value.latitude <= 90 &&
    typeof value.longitude === 'number' && Number.isFinite(value.longitude) &&
    value.longitude >= -180 && value.longitude <= 180;
}

// Purpose: Implements the require user operation.
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

// Purpose: Implements the geoapify operation.
async function geoapify(path: string, parameters: URLSearchParams) {
  parameters.set('apiKey', requireEnvironment('GEOAPIFY_API_KEY'));
  const result = await fetch(`https://api.geoapify.com${path}?${parameters.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!result.ok) throw new Error(`GEOAPIFY_${result.status}`);
  return result.json() as Promise<Record<string, unknown>>;
}

const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

// Purpose: Implements the bounding box operation.
function boundingBox(center: Required<Coordinate>, radiusMeters: number) {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeScale = Math.max(0.1, Math.cos(center.latitude * Math.PI / 180));
  const longitudeDelta = radiusMeters / (111_320 * longitudeScale);
  return [
    center.latitude - latitudeDelta,
    center.longitude - longitudeDelta,
    center.latitude + latitudeDelta,
    center.longitude + longitudeDelta,
  ].map((value) => value.toFixed(6)).join(',');
}

// Purpose: Implements the overpass query operation.
async function overpassQuery(query: string) {
  let lastFailure = 'OVERPASS_UNAVAILABLE';
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const result = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Mission Trails nearby discovery',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!result.ok) {
        lastFailure = `OVERPASS_${result.status}`;
        continue;
      }
      const data = await result.json() as { elements?: unknown };
      if (!Array.isArray(data.elements)) {
        lastFailure = 'OVERPASS_INVALID_RESPONSE';
        continue;
      }
      return data.elements as OverpassElement[];
    } catch (error) {
      lastFailure = error instanceof Error && error.name === 'AbortError'
        ? 'OVERPASS_TIMEOUT'
        : 'OVERPASS_UNAVAILABLE';
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(lastFailure);
}

// Purpose: Implements the overpass operation.
async function overpass(center: Required<Coordinate>, radiusMeters: number) {
  const destinationBox = boundingBox(center, radiusMeters);
  // Dense named path segments are intentionally bounded to 10 km; parks,
  // reserves, and trailheads still use the complete requested radius.
  const trailBox = boundingBox(center, Math.min(radiusMeters, 10_000));
  const destinationsQuery = `
[out:json][timeout:25];
(
  nwr["name"]["leisure"~"^(park|garden|nature_reserve|recreation_ground)$"](${destinationBox});
  nwr["name"]["landuse"="recreation_ground"](${destinationBox});
  nwr["name"]["boundary"~"^(protected_area|national_park)$"](${destinationBox});
  nwr["name"]["information"~"^(trailhead|guidepost|map)$"](${destinationBox});
);
out center 300;
`;
  const trailsQuery = `
[out:json][timeout:25];
(
  nwr["name"]["highway"~"^(path|footway|pedestrian|cycleway|track|trailhead)$"](${trailBox});
  relation["name"]["route"~"^(hiking|foot)$"](${trailBox});
);
out center 200;
`;
  const results = await Promise.allSettled([
    overpassQuery(destinationsQuery),
    overpassQuery(trailsQuery),
  ]);
  const elements = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (elements.length > 0) return elements;
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  throw failure?.reason ?? new Error('OVERPASS_UNAVAILABLE');
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
      const radius = Math.min(25 * METERS_PER_MILE, Math.max(500, body.radiusMeters ?? 25 * METERS_PER_MILE));
      const elements = await overpass(body.center, radius);
      const trails = normalizeOverpassPlaces(elements, body.center)
        .filter((trail) => trail.distanceMiles * METERS_PER_MILE <= radius)
        .slice(0, 100);
      return response({ trails, provider: 'openstreetmap', requestId });
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
    const failure = error instanceof Error ? error.message : 'unknown';
    console.error('Trail discovery request failed', failure);
    if (
      failure === 'Missing server environment: GEOAPIFY_API_KEY'
      || failure === 'GEOAPIFY_401'
      || failure === 'GEOAPIFY_403'
    ) {
      return response({
        error: 'CONFIGURATION_ERROR',
        message: 'Nearby trail discovery is not configured.',
        requestId,
      }, 503);
    }
    if (failure === 'GEOAPIFY_429') {
      return response({
        error: 'RATE_LIMITED',
        message: 'Please wait a moment before searching again.',
        requestId,
      }, 429);
    }
    if (failure === 'OVERPASS_429') {
      return response({
        error: 'RATE_LIMITED',
        message: 'Please wait a moment before searching again.',
        requestId,
      }, 429);
    }
    return response({
      error: 'TRAIL_SERVICE_UNAVAILABLE',
      message: 'Nearby trails are unavailable right now. Please try again.',
      requestId,
    }, 502);
  }
});
