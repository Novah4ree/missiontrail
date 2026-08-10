import { createClient } from 'npm:@supabase/supabase-js@2.106.2';

import {
    METERS_PER_MILE,
    normalizeGeoapifyRoute,
    normalizeOverpassPlaces,
    normalizeOverpassTrailDetails,
    type OverpassElement,
} from '../_shared/trail-normalization.ts';

type Coordinate = { latitude?: number; longitude?: number };
type TrailRequest = {
  action?: 'search' | 'route' | 'geocode' | 'geocode_zip' | 'reverse_geocode' | 'trail_details';
  center?: Coordinate;
  origin?: Coordinate;
  destination?: Coordinate;
  radiusMeters?: number;
  query?: string;
  trailId?: string;
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
  try {
    return await result.json() as Record<string, unknown>;
  } catch {
    throw new Error('GEOAPIFY_INVALID_RESPONSE');
  }
}

const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

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

async function overpassQuery(query: string) {
  let lastFailure = 'OVERPASS_UNAVAILABLE';
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    // The query itself permits 25 seconds. Give the provider enough transport
    // time to return that response before failing over to the next endpoint.
    const timeout = setTimeout(() => controller.abort(), 35_000);
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
      let data: { elements?: unknown };
      try {
        data = await result.json() as { elements?: unknown };
      } catch {
        lastFailure = 'OVERPASS_INVALID_RESPONSE';
        continue;
      }
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

async function overpass(center: Required<Coordinate>, radiusMeters: number) {
  const destinationBox = boundingBox(center, radiusMeters);
  // Dense individual path segments are bounded to 10 km so a 25-mile search
  // does not overwhelm public Overpass instances. Named routes, trailheads,
  // parks, reserves, and nature destinations still use the complete radius.
  const trailBox = boundingBox(center, Math.min(radiusMeters, 10_000));
  const destinationsQuery = `
[out:json][timeout:25];
(
    nwr["name"]["leisure"~"^(park|garden|nature_reserve|recreation_ground|common)$"](${destinationBox});
    nwr["name"]["landuse"="recreation_ground"](${destinationBox});
    nwr["name"]["boundary"~"^(protected_area|national_park)$"](${destinationBox});
    nwr["name"]["natural"~"^(wood|heath|grassland|scrub|wetland)$"](${destinationBox});
    nwr["name"]["information"="trailhead"](${destinationBox});
);
out center 300;
`;
  const trailsQuery = `
[out:json][timeout:25];
(
    nwr["name"]["highway"~"^(path|footway|pedestrian|cycleway|track|bridleway)$"](${trailBox});
    nwr["name"]["leisure"="track"](${trailBox});
    relation["name"]["route"~"^(hiking|foot|running|fitness_trail|nature_trail)$"](${destinationBox});
);
out center 250;
`;
  const results = await Promise.allSettled([
    overpassQuery(destinationsQuery),
    overpassQuery(trailsQuery),
  ]);
  const elements = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (elements.length > 0) return elements;
  if (results.every((result) => result.status === 'fulfilled')) return [];
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  throw failure?.reason ?? new Error('OVERPASS_UNAVAILABLE');
}

async function geocode(query: string) {
  const search = query.trim();
  if (search.length < 2 || search.length > 160) throw new Error('INVALID_GEOCODE_QUERY');
  const parameters = new URLSearchParams({ q: search, format: 'jsonv2', limit: '1' });
  const result = await fetch(`https://nominatim.openstreetmap.org/search?${parameters}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mission Trails nearby discovery' },
  });
  if (!result.ok) throw new Error(`GEOCODER_${result.status}`);
  let places: { lat?: string; lon?: string; display_name?: string }[];
  try {
    const payload = await result.json() as unknown;
    if (!Array.isArray(payload)) throw new Error('invalid');
    places = payload;
  } catch {
    throw new Error('GEOCODER_INVALID_RESPONSE');
  }
  const place = places[0];
  const latitude = Number(place?.lat);
  const longitude = Number(place?.lon);
  if (!place || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !place.display_name) {
    throw new Error('GEOCODER_NOT_FOUND');
  }
  return { latitude, longitude, label: place.display_name };
}

async function geocodeZip(zipCode: string) {
  if (!/^\d{5}$/.test(zipCode)) throw new Error('INVALID_ZIP_QUERY');
  const parameters = new URLSearchParams({
    postalcode: zipCode,
    countrycodes: 'us',
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
  });
  const result = await fetch(`https://nominatim.openstreetmap.org/search?${parameters}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mission Trails nearby discovery' },
  });
  if (!result.ok) throw new Error(`GEOCODER_${result.status}`);
  let places: {
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: { postcode?: string; country_code?: string };
  }[];
  try {
    const payload = await result.json() as unknown;
    if (!Array.isArray(payload)) throw new Error('invalid');
    places = payload;
  } catch {
    throw new Error('GEOCODER_INVALID_RESPONSE');
  }
  const place = places[0];
  const latitude = Number(place?.lat);
  const longitude = Number(place?.lon);
  if (
    !place
    || !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
    || place.address?.country_code?.toLowerCase() !== 'us'
    || place.address?.postcode?.slice(0, 5) !== zipCode
  ) {
    throw new Error('ZIP_NOT_FOUND');
  }
  return {
    latitude,
    longitude,
    zipCode,
    label: place.display_name ?? `US ZIP ${zipCode}`,
  };
}

async function reverseGeocode(center: Required<Coordinate>) {
  const parameters = new URLSearchParams({
    lat: String(center.latitude),
    lon: String(center.longitude),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  });
  const result = await fetch(`https://nominatim.openstreetmap.org/reverse?${parameters}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mission Trails nearby discovery' },
  });
  if (!result.ok) throw new Error(`GEOCODER_${result.status}`);

  let place: {
    error?: string;
    display_name?: string;
    address?: Record<string, string | undefined>;
  };
  try {
    place = await result.json() as typeof place;
  } catch {
    throw new Error('GEOCODER_INVALID_RESPONSE');
  }
  if (place.error || !place.address) throw new Error('GEOCODER_NOT_FOUND');

  const address = place.address;
  const road = address.road ?? address.pedestrian ?? address.footway ?? address.path;
  const street = [address.house_number, road].filter(Boolean).join(' ') || undefined;
  const locality = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
  const isoState = address['ISO3166-2-lvl4'];
  const stateCode = isoState?.startsWith('US-') ? isoState.slice(3) : undefined;
  const normalized = {
    street,
    locality,
    state: address.state,
    stateCode,
    postalCode: address.postcode,
    formatted: place.display_name,
  };
  if (!Object.values(normalized).some(Boolean)) throw new Error('GEOCODER_NOT_FOUND');
  return normalized;
}

async function overpassTrailDetails(trailId: string) {
  const match = /^(node|way|relation):(\d+)$/.exec(trailId);
  if (!match) throw new Error('INVALID_TRAIL_ID');
  const [, elementType, elementId] = match;
  const elements = await overpassQuery(`
[out:json][timeout:15];
${elementType}(${elementId});
out tags center geom;
`);
  const element = elements.find((candidate) => candidate.type === elementType && String(candidate.id) === elementId);
  if (!element) throw new Error('TRAIL_DETAILS_NOT_FOUND');
  return normalizeOverpassTrailDetails(element);
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  let operation = 'unknown';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED', requestId }, 405);

  try {
    const authentication = await requireUser(request);
    if (!authentication) return response({ error: 'UNAUTHORIZED', requestId }, 401);
    const body = await request.json().catch(() => ({})) as TrailRequest;
    operation = body.action ?? 'unknown';
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
        .filter((trail) => trail.distanceMiles * METERS_PER_MILE <= radius);
      return response({ trails, provider: 'openstreetmap', requestId });
    }

    if (body.action === 'geocode') {
      if (typeof body.query !== 'string') return response({ error: 'INVALID_QUERY', requestId }, 400);
      return response({ location: await geocode(body.query), provider: 'openstreetmap', requestId });
    }

    if (body.action === 'geocode_zip') {
      if (typeof body.query !== 'string' || !/^\d{5}$/.test(body.query)) {
        return response({ error: 'INVALID_ZIP', message: 'Enter a five-digit US ZIP code.', requestId }, 400);
      }
      return response({ location: await geocodeZip(body.query), provider: 'openstreetmap', requestId });
    }

    if (body.action === 'reverse_geocode') {
      if (!validCoordinate(body.center)) return response({ error: 'INVALID_COORDINATE', requestId }, 400);
      return response({ address: await reverseGeocode(body.center), provider: 'openstreetmap', requestId });
    }

    if (body.action === 'trail_details') {
      if (typeof body.trailId !== 'string') return response({ error: 'INVALID_TRAIL_ID', requestId }, 400);
      const details = await overpassTrailDetails(body.trailId);
      return response({ details, provider: 'openstreetmap', requestId });
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
        operation,
        technicalCode: failure,
        requestId,
      }, 503);
    }
    if (failure === 'GEOAPIFY_429') {
      return response({
        error: 'RATE_LIMITED',
        message: 'Please wait a moment before searching again.',
        operation,
        technicalCode: failure,
        requestId,
      }, 429);
    }
    if (failure === 'OVERPASS_429' || failure === 'GEOCODER_429') {
      return response({
        error: 'RATE_LIMITED',
        message: 'Please wait a moment before searching again.',
        operation,
        technicalCode: failure,
        requestId,
      }, 429);
    }
    if (failure === 'GEOCODER_NOT_FOUND' || failure === 'INVALID_GEOCODE_QUERY') {
      return response({ error: 'LOCATION_NOT_FOUND', message: 'The requested location was not found.', operation, technicalCode: failure, requestId }, 404);
    }
    if (failure === 'ZIP_NOT_FOUND' || failure === 'INVALID_ZIP_QUERY') {
      return response({ error: 'ZIP_NOT_FOUND', message: 'That ZIP code was not found.', operation, technicalCode: failure, requestId }, 404);
    }
    if (failure === 'INVALID_TRAIL_ID' || failure === 'TRAIL_DETAILS_NOT_FOUND') {
      return response({ error: 'TRAIL_DETAILS_NOT_FOUND', message: 'Trail details were not found.', operation, technicalCode: failure, requestId }, 404);
    }
    return response({
      error: 'TRAIL_SERVICE_UNAVAILABLE',
      message: 'Nearby trails are unavailable right now. Please try again.',
      operation,
      technicalCode: /^(OVERPASS|GEOCODER|GEOAPIFY)_/.test(failure)
        ? failure
        : 'INTERNAL_ERROR',
      requestId,
    }, 502);
  }
});
