import { createClient } from 'npm:@supabase/supabase-js@2.106.2';

import {
  createMysteryZone,
  decodeGeohashCenter,
  deterministicIndex,
  destinationPoint,
  distanceMeters,
  encodeGeohash,
  generateDeterministicCandidates,
  hmacDigest,
  selectDeterministicSafeLocations,
  type Coordinate,
} from '../_shared/spawn-algorithm.ts';
import { isDevelopmentRelicTestUser } from '../_shared/daily-config.ts';
import {
  ALLOW_UNVERIFIED_SPAWNS,
  CANDIDATES_PER_WINDOW,
  CLUE_DISTANCE_BANDS_METERS,
  EXPIRATION_GRACE_PERIOD_SECONDS,
  EXPLORATION_REGION_GEOHASH_PRECISION,
  FIELD_RATE_LIMIT_PER_MINUTE,
  MAX_ACCEPTABLE_GPS_ACCURACY_METERS,
  MIN_CANDIDATE_SPACING_METERS,
  SEARCH_RADIUS_METERS,
  SPAWN_WINDOW_MINUTES,
  REQUIRED_ACCURATE_READINGS,
  requireSpawnHmacSecret,
} from '../_shared/spawn-config.ts';

type FieldRequest = {
  action?: 'list' | 'place_test_relic';
  locationReadings?: Array<{
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    capturedAt?: string;
    mocked?: boolean;
  }>;
  provider?: 'gps' | 'development_mock';
};

type CatalogRelic = {
  relic_id: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
};

type WindowRecord = {
  spawn_window_id: string;
  window_id: number;
  starts_at: string;
  ends_at: string;
  grace_ends_at: string;
};

type ZoneRecord = {
  zone_id: string;
  region_geohash: string;
  center_latitude: number;
  center_longitude: number;
  active_until: string;
};

type CandidateRecord = {
  candidate_id: string;
  slot_index: number;
  relic_id: string;
  rarity: string;
  latitude: number;
  longitude: number;
  safety_status: 'verified' | 'unverified';
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireServerEnvironment(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing server environment: ${name}`);
  }

  return value;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateAnchorReadings(body: FieldRequest) {
  const readings = body.locationReadings?.slice(-REQUIRED_ACCURATE_READINGS);

  if (!readings || readings.length < REQUIRED_ACCURATE_READINGS) {
    throw new Error('INVALID_ANCHOR');
  }

  const serverNow = Date.now();
  let previousTimestamp = 0;

  const accepted = readings.map((reading) => {
    const latitude = reading.latitude;
    const longitude = reading.longitude;
    const accuracyMeters = reading.accuracyMeters;
    const capturedAt = reading.capturedAt ? Date.parse(reading.capturedAt) : Number.NaN;

    if (
      !isCoordinate(latitude) ||
      !isCoordinate(longitude) ||
      !isCoordinate(accuracyMeters) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      accuracyMeters < 0 ||
      accuracyMeters > MAX_ACCEPTABLE_GPS_ACCURACY_METERS ||
      !Number.isFinite(capturedAt) ||
      capturedAt <= previousTimestamp ||
      (previousTimestamp > 0 &&
        (capturedAt - previousTimestamp < 1_000 || capturedAt - previousTimestamp > 10_000)) ||
      capturedAt < serverNow - 30_000 ||
      capturedAt > serverNow + 5_000 ||
      (reading.mocked === true && body.provider !== 'development_mock')
    ) {
      throw new Error('INVALID_ANCHOR');
    }

    previousTimestamp = capturedAt;
    return { latitude, longitude, accuracyMeters };
  });

  const latitude = [...accepted].sort((left, right) => left.latitude - right.latitude)[
    Math.floor(accepted.length / 2)
  ].latitude;
  const longitude = [...accepted].sort((left, right) => left.longitude - right.longitude)[
    Math.floor(accepted.length / 2)
  ].longitude;
  const median = { latitude, longitude };

  if (
    accepted.some(
      (reading) =>
        distanceMeters(median, reading) > MAX_ACCEPTABLE_GPS_ACCURACY_METERS * 2,
    )
  ) {
    throw new Error('INVALID_ANCHOR');
  }

  return {
    coordinate: median,
    maximumAccuracyMeters: Math.max(...accepted.map((reading) => reading.accuracyMeters)),
  };
}

async function chooseRelic(
  secret: string,
  regionGeohash: string,
  windowId: number,
  slotIndex: number,
  catalog: CatalogRelic[],
) {
  const rarityRoll = await deterministicIndex(
    secret,
    `rarity|${regionGeohash}|${windowId}|${slotIndex}`,
    100,
  );
  // Common, Uncommon, and Epic are normal tiers. Rare and Legendary candidates
  // are filtered by the database's server-derived daily eligibility.
  const desiredRarity = slotIndex === 0 || rarityRoll < 35
    ? 'common'
    : rarityRoll < 60
      ? 'uncommon'
      : rarityRoll < 80
        ? 'epic'
        : rarityRoll < 92
          ? 'rare'
          : 'legendary';
  const desiredCatalog = catalog.filter((relic) => relic.rarity === desiredRarity);
  // Existing Mission Trails artwork currently has no Common/Uncommon entries,
  // so Epic is the safe normal-tier fallback until those catalog rows are added.
  const eligibleCatalog = desiredCatalog.length
    ? desiredCatalog
    : catalog.filter((relic) => relic.rarity === 'epic');
  const relicIndex = await deterministicIndex(
    secret,
    `relic|${regionGeohash}|${windowId}|${slotIndex}`,
    eligibleCatalog.length,
  );

  return eligibleCatalog[relicIndex];
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', requestId }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'UNAUTHORIZED', requestId }, 401);
    }

    const supabaseUrl = requireServerEnvironment('SUPABASE_URL');
    const anonKey = requireServerEnvironment('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireServerEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const spawnSecret = requireSpawnHmacSecret();

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse({ error: 'UNAUTHORIZED', requestId }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rateAllowed, error: rateError } = await admin.rpc(
      'server_consume_field_rate_limit',
      {
        p_subject_key: `user:${authData.user.id}`,
        p_endpoint: 'relic-field',
        p_limit: FIELD_RATE_LIMIT_PER_MINUTE,
      },
    );

    if (rateError) throw new Error('RATE_LIMIT_CHECK_FAILED');
    if (!rateAllowed) return jsonResponse({ error: 'RATE_LIMITED', requestId }, 429);

    const body = (await request.json().catch(() => ({}))) as FieldRequest;
    const provider = body.provider ?? 'gps';

    if (body.action === 'place_test_relic' && !isDevelopmentRelicTestUser(authData.user.id)) {
      return jsonResponse({
        error: 'DEVELOPMENT_TEST_DISABLED', requestId,
        message: 'Test relic setup is turned off for this account.',
      }, 403);
    }

    if (provider === 'development_mock' && !ALLOW_UNVERIFIED_SPAWNS) {
      return jsonResponse({ error: 'DEVELOPMENT_PROVIDER_DISABLED', requestId }, 403);
    }

    let { data: zoneRows, error: zoneError } = await admin.rpc(
      'server_get_active_exploration_zone',
      { p_user_id: authData.user.id },
    );

    if (!zoneError && !zoneRows?.length) {
      // A new zone requires consecutive fresh, accurate readings. Once created,
      // later movement is ignored until the stable zone expires.
      const anchorResult = validateAnchorReadings(body);
      const anchor = anchorResult.coordinate;
      const requestedRegion = encodeGeohash(anchor, EXPLORATION_REGION_GEOHASH_PRECISION);
      const requestedRegionCenter = decodeGeohashCenter(requestedRegion);
      const anchorDigest = await hmacDigest(
        spawnSecret,
        `zone-anchor|${authData.user.id}|${body.locationReadings
          ?.slice(-REQUIRED_ACCURATE_READINGS)
          .map((reading) => reading.capturedAt)
          .join('|')}`,
      );
      const anchorAttempt = await admin.rpc('server_record_zone_anchor_attempt', {
        p_user_id: authData.user.id,
        p_latitude: anchor.latitude,
        p_longitude: anchor.longitude,
        p_reading_count: REQUIRED_ACCURATE_READINGS,
        p_maximum_accuracy_meters: anchorResult.maximumAccuracyMeters,
        p_payload_digest: anchorDigest,
      });

      if (anchorAttempt.error) throw new Error('ANCHOR_VERIFICATION_FAILED');

      const createdZone = await admin.rpc('server_get_or_create_exploration_zone', {
        p_user_id: authData.user.id,
        p_region_geohash: requestedRegion,
        p_center_latitude: requestedRegionCenter.latitude,
        p_center_longitude: requestedRegionCenter.longitude,
        p_anchor_source: provider === 'development_mock' ? 'development_mock' : 'verified_gps',
      });
      zoneRows = createdZone.data;
      zoneError = createdZone.error;
    }

    if (zoneError || !zoneRows?.[0]) throw new Error('ZONE_UNAVAILABLE');
    const zone = zoneRows[0] as ZoneRecord;
    const zoneCenter: Coordinate = {
      latitude: zone.center_latitude,
      longitude: zone.center_longitude,
    };

    // The database calculates this from clock_timestamp(). The client never sends
    // a window ID or clock value and therefore cannot hold a window open.
    const { data: windowRows, error: windowError } = await admin.rpc(
      'server_get_or_create_current_spawn_window',
      {
        p_region_geohash: zone.region_geohash,
        p_center_latitude: zoneCenter.latitude,
        p_center_longitude: zoneCenter.longitude,
        p_window_minutes: SPAWN_WINDOW_MINUTES,
        p_grace_period_seconds: EXPIRATION_GRACE_PERIOD_SECONDS,
      },
    );

    if (windowError || !windowRows?.[0]) throw new Error('WINDOW_UNAVAILABLE');
    const spawnWindow = windowRows[0] as WindowRecord;

    await admin.rpc('server_expire_old_relic_assignments');

    if (body.action === 'place_test_relic') {
      const anchor = validateAnchorReadings(body).coordinate;
      const bearing = await deterministicIndex(
        spawnSecret,
        `development-five-feet|${authData.user.id}|${spawnWindow.window_id}|${requestId}`,
        360,
      );
      const exactPoint = destinationPoint(anchor, 1.524, bearing);
      const testSlot = 10_000 + bearing;
      const mystery = await createMysteryZone({
        secret: spawnSecret,
        regionGeohash: zone.region_geohash,
        windowId: String(spawnWindow.window_id),
        slotIndex: testSlot,
        exactPoint,
        clueDistanceBandsMeters: CLUE_DISTANCE_BANDS_METERS,
      });
      const { data: testCatalog, error: testCatalogError } = await admin
        .from('relic_catalog')
        .select('relic_id')
        .eq('is_enabled', true)
        .eq('rarity', 'epic')
        .order('relic_id')
        .limit(1);
      if (testCatalogError || !testCatalog?.[0]) throw new Error('TEST_RELIC_UNAVAILABLE');
      const seedDigest = await hmacDigest(
        spawnSecret,
        `development-test-audit|${authData.user.id}|${spawnWindow.window_id}|${requestId}`,
      );
      const placed = await admin.rpc('server_place_development_test_relic', {
        p_user_id: authData.user.id,
        p_zone_id: zone.zone_id,
        p_spawn_window_id: spawnWindow.spawn_window_id,
        p_relic_id: testCatalog[0].relic_id,
        p_exact_latitude: exactPoint.latitude,
        p_exact_longitude: exactPoint.longitude,
        p_mystery_latitude: mystery.center.latitude,
        p_mystery_longitude: mystery.center.longitude,
        p_mystery_radius_meters: mystery.radiusMeters,
        p_clue_distance_band_meters: mystery.clueBandMeters,
        p_seed_digest: seedDigest,
      });
      if (placed.error || !placed.data) throw new Error('TEST_RELIC_PLACEMENT_FAILED');
      return jsonResponse({
        requestId,
        status: 'placed',
        assignmentId: placed.data,
        message: 'Test relic placed 5 feet away. Tap Find Hidden Relic!',
      });
    }

    let { data: candidateRows, error: candidateError } = await admin.rpc(
      'server_list_spawn_candidates',
      { p_spawn_window_id: spawnWindow.spawn_window_id },
    );

    if (candidateError) throw new Error('CANDIDATES_UNAVAILABLE');

    if ((candidateRows?.length ?? 0) < CANDIDATES_PER_WINDOW) {
      const { data: catalogData, error: catalogError } = await admin
        .from('relic_catalog')
        .select('relic_id, rarity')
        .eq('is_enabled', true)
        .order('relic_id');

      if (catalogError || !catalogData?.length) throw new Error('CATALOG_UNAVAILABLE');
      const catalog = catalogData as CatalogRelic[];

      const { data: safeLocationRows, error: safeLocationError } = await admin.rpc(
        'server_get_safe_spawn_locations',
        {
          p_region_geohash: zone.region_geohash,
          p_center_latitude: zoneCenter.latitude,
          p_center_longitude: zoneCenter.longitude,
          p_radius_meters: SEARCH_RADIUS_METERS,
        },
      );

      if (safeLocationError) throw new Error('SAFE_LOCATION_LOOKUP_FAILED');

      const safeLocations = (safeLocationRows ?? []).map((location: {
        safe_location_id: string;
        latitude: number;
        longitude: number;
      }) => ({
        id: location.safe_location_id,
        latitude: location.latitude,
        longitude: location.longitude,
      }));
      const selectedSafeLocations = await selectDeterministicSafeLocations({
        secret: spawnSecret,
        regionGeohash: zone.region_geohash,
        windowId: String(spawnWindow.window_id),
        locations: safeLocations,
        count: CANDIDATES_PER_WINDOW,
        minimumSpacingMeters: MIN_CANDIDATE_SPACING_METERS,
      });

      const generatedLocations =
        selectedSafeLocations.length === CANDIDATES_PER_WINDOW
          ? selectedSafeLocations.map((location) => ({ ...location, safeLocationId: location.id }))
          : ALLOW_UNVERIFIED_SPAWNS
            ? (
                await generateDeterministicCandidates({
                  secret: spawnSecret,
                  regionGeohash: zone.region_geohash,
                  windowId: String(spawnWindow.window_id),
                  center: zoneCenter,
                  count: CANDIDATES_PER_WINDOW,
                  searchRadiusMeters: SEARCH_RADIUS_METERS,
                  minimumSpacingMeters: MIN_CANDIDATE_SPACING_METERS,
                })
              ).map((location) => ({ ...location, safeLocationId: null }))
            : [];

      if (!generatedLocations.length) {
        const refreshAfterSeconds = Math.max(
          1,
          Math.ceil((Date.parse(spawnWindow.ends_at) - Date.now()) / 1_000),
        );
        return jsonResponse({
          requestId,
          refreshAfterSeconds,
          window: {
            startsAt: spawnWindow.starts_at,
            endsAt: spawnWindow.ends_at,
            graceEndsAt: spawnWindow.grace_ends_at,
          },
          zones: [],
          limitation: 'SAFE_WALKING_LOCATION_DATA_UNAVAILABLE',
        });
      }

      for (const point of generatedLocations) {
        const relic = await chooseRelic(
          spawnSecret,
          zone.region_geohash,
          spawnWindow.window_id,
          point.slotIndex,
          catalog,
        );
        const seedDigest = await hmacDigest(
          spawnSecret,
          `audit|${zone.region_geohash}|${spawnWindow.window_id}|${point.slotIndex}`,
        );
        const safetyStatus = point.safeLocationId ? 'verified' : 'unverified';
        const { error: saveError } = await admin.rpc('server_save_spawn_candidate', {
          p_spawn_window_id: spawnWindow.spawn_window_id,
          p_slot_index: point.slotIndex,
          p_relic_id: relic.relic_id,
          p_latitude: point.latitude,
          p_longitude: point.longitude,
          p_safe_location_id: point.safeLocationId,
          p_safety_status: safetyStatus,
          p_safety_limitation: point.safeLocationId
            ? null
            : 'Development-only coordinate; no trusted pedestrian map validation was available',
          p_seed_digest: seedDigest,
        });

        if (saveError) throw new Error('CANDIDATE_SAVE_FAILED');
      }

      const refreshed = await admin.rpc('server_list_spawn_candidates', {
        p_spawn_window_id: spawnWindow.spawn_window_id,
      });
      if (refreshed.error) throw new Error('CANDIDATES_UNAVAILABLE');
      candidateRows = refreshed.data;
    }

    // Exact candidate coordinates are used only inside this server process to make
    // offset clue circles. They are never placed into the response or error text.
    for (const candidate of (candidateRows ?? []) as CandidateRecord[]) {
      const mystery = await createMysteryZone({
        secret: spawnSecret,
        regionGeohash: zone.region_geohash,
        windowId: String(spawnWindow.window_id),
        slotIndex: candidate.slot_index,
        exactPoint: { latitude: candidate.latitude, longitude: candidate.longitude },
        clueDistanceBandsMeters: CLUE_DISTANCE_BANDS_METERS,
      });

      const { error: assignmentError } = await admin.rpc('server_assign_relic_candidate', {
        p_user_id: authData.user.id,
        p_zone_id: zone.zone_id,
        p_candidate_id: candidate.candidate_id,
        p_mystery_latitude: mystery.center.latitude,
        p_mystery_longitude: mystery.center.longitude,
        p_mystery_radius_meters: mystery.radiusMeters,
        p_clue_distance_band_meters: mystery.clueBandMeters,
      });

      if (assignmentError) throw new Error('ASSIGNMENT_FAILED');
    }

    const { data: mysteryZones, error: mysteryError } = await admin.rpc(
      'server_list_client_mystery_zones',
      { p_user_id: authData.user.id, p_zone_id: zone.zone_id },
    );

    if (mysteryError) throw new Error('FIELD_UNAVAILABLE');

    return jsonResponse({
      requestId,
      refreshAfterSeconds: Math.max(
        1,
        Math.ceil((Date.parse(spawnWindow.ends_at) - Date.now()) / 1_000),
      ),
      region: zone.region_geohash,
      zoneExpiresAt: zone.active_until,
      window: {
        startsAt: spawnWindow.starts_at,
        endsAt: spawnWindow.ends_at,
        graceEndsAt: spawnWindow.grace_ends_at,
      },
      zones: mysteryZones ?? [],
    });
  } catch {
    // Do not echo caught messages: database errors may contain identifiers or
    // coordinates. The request ID is enough to correlate sanitized server logs.
    return jsonResponse({ error: 'RELIC_FIELD_UNAVAILABLE', requestId }, 500);
  }
});
