import { createClient } from "npm:@supabase/supabase-js@2.106.2";

import { isDevelopmentRelicTestUser } from "../_shared/daily-config.ts";
import {
  createMysteryZone,
  decodeGeohashCenter,
  destinationPoint,
  deterministicIndex,
  distanceMeters,
  encodeGeohash,
  generateDeterministicCandidates,
  hmacDigest,
  selectDeterministicSafeLocations,
  type Coordinate,
} from "../_shared/spawn-algorithm.ts";
import {
  ALLOW_UNVERIFIED_SPAWNS,
  AMBIENT_CLUE_DISTANCE_BANDS_METERS,
  AMBIENT_ENABLED,
  CLUE_DISTANCE_BANDS_METERS,
  EXPIRATION_GRACE_PERIOD_SECONDS,
  EXPLORATION_REGION_GEOHASH_PRECISION,
  FIELD_RATE_LIMIT_PER_MINUTE,
  LOCAL_CANDIDATES,
  LOCAL_MIN_SPACING_METERS,
  LOCAL_RADIUS_METERS,
  MAX_ACCEPTABLE_GPS_ACCURACY_METERS,
  NEIGHBORHOOD_CANDIDATES,
  NEIGHBORHOOD_MIN_SPACING_METERS,
  NEIGHBORHOOD_RADIUS_METERS,
  REGIONAL_CANDIDATES,
  REGIONAL_MIN_SPACING_METERS,
  REGIONAL_RADIUS_METERS,
  REQUIRED_ACCURATE_READINGS,
  requireSpawnHmacSecret,
  SPAWN_WINDOW_MINUTES,
} from "../_shared/spawn-config.ts";

type FieldRequest = {
  action?: "list" | "place_test_relic";
  locationReadings?: Array<{
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    capturedAt?: string;
    mocked?: boolean;
  }>;
  provider?: "gps" | "development_mock";
};

type CatalogRelic = {
  relic_id: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
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
  safety_status: "verified" | "verified_vicinity" | "unverified";
  spawn_tier: SpawnTierName;
};

type SpawnTierName = "ambient" | "neighborhood" | "local" | "regional";

type SpawnTier = {
  name: SpawnTierName;
  minimumDistanceMeters: number;
  maximumDistanceMeters: number;
  count: number;
  minimumSpacingMeters: number;
  slotOffset: number;
};

const SPAWN_TIERS: SpawnTier[] = [
  {
    name: "neighborhood",
    minimumDistanceMeters: 0,
    maximumDistanceMeters: NEIGHBORHOOD_RADIUS_METERS,
    count: NEIGHBORHOOD_CANDIDATES,
    minimumSpacingMeters: NEIGHBORHOOD_MIN_SPACING_METERS,
    slotOffset: 2_000,
  },
  {
    name: "local",
    minimumDistanceMeters: NEIGHBORHOOD_RADIUS_METERS,
    maximumDistanceMeters: LOCAL_RADIUS_METERS,
    count: LOCAL_CANDIDATES,
    minimumSpacingMeters: LOCAL_MIN_SPACING_METERS,
    slotOffset: 3_000,
  },
  {
    name: "regional",
    minimumDistanceMeters: LOCAL_RADIUS_METERS,
    maximumDistanceMeters: REGIONAL_RADIUS_METERS,
    count: REGIONAL_CANDIDATES,
    minimumSpacingMeters: REGIONAL_MIN_SPACING_METERS,
    slotOffset: 4_000,
  },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Purpose: Implements the json response operation.
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Purpose: Implements the require server environment operation.
function requireServerEnvironment(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing server environment: ${name}`);
  }

  return value;
}

// Purpose: Determines whether is coordinate.
function isCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// Purpose: Validates anchor readings.
function validateAnchorReadings(body: FieldRequest) {
  const readings = body.locationReadings?.slice(-REQUIRED_ACCURATE_READINGS);

  if (!readings || readings.length < REQUIRED_ACCURATE_READINGS) {
    throw new Error("INVALID_ANCHOR");
  }

  const serverNow = Date.now();
  let previousTimestamp = 0;

  const accepted = readings.map((reading) => {
    const latitude = reading.latitude;
    const longitude = reading.longitude;
    const accuracyMeters = reading.accuracyMeters;
    const capturedAt = reading.capturedAt
      ? Date.parse(reading.capturedAt)
      : Number.NaN;

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
        (capturedAt - previousTimestamp < 1_000 ||
          capturedAt - previousTimestamp > 10_000)) ||
      capturedAt < serverNow - 30_000 ||
      capturedAt > serverNow + 5_000 ||
      (reading.mocked === true && body.provider !== "development_mock")
    ) {
      throw new Error("INVALID_ANCHOR");
    }

    previousTimestamp = capturedAt;
    return { latitude, longitude, accuracyMeters };
  });

  const latitude = [...accepted].sort(
    (left, right) => left.latitude - right.latitude,
  )[Math.floor(accepted.length / 2)].latitude;
  const longitude = [...accepted].sort(
    (left, right) => left.longitude - right.longitude,
  )[Math.floor(accepted.length / 2)].longitude;
  const median = { latitude, longitude };

  if (
    accepted.some(
      (reading) =>
        distanceMeters(median, reading) >
        MAX_ACCEPTABLE_GPS_ACCURACY_METERS * 2,
    )
  ) {
    throw new Error("INVALID_ANCHOR");
  }

  return {
    coordinate: median,
    maximumAccuracyMeters: Math.max(
      ...accepted.map((reading) => reading.accuracyMeters),
    ),
  };
}

// Purpose: Implements the choose relic operation.
async function chooseRelic(
  secret: string,
  regionGeohash: string,
  windowId: number,
  slotIndex: number,
  catalog: CatalogRelic[],
  tier: SpawnTierName,
) {
  const rarityRoll = await deterministicIndex(
    secret,
    `rarity|${regionGeohash}|${windowId}|${slotIndex}`,
    100,
  );
  // Ambient never rolls a gated rarity. Wider tiers progressively introduce
  // Epic, Rare, and Legendary opportunities; database eligibility still decides
  // whether special assignments are available to this user.
  const desiredRarity = tier === "ambient"
    ? rarityRoll < 70 ? "common" : "uncommon"
    : tier === "neighborhood"
      ? rarityRoll < 55 ? "common" : rarityRoll < 85 ? "uncommon" : "epic"
      : tier === "local"
        ? rarityRoll < 40
          ? "common"
          : rarityRoll < 70
            ? "uncommon"
            : rarityRoll < 90
              ? "epic"
              : "rare"
        : rarityRoll < 25
          ? "common"
          : rarityRoll < 50
            ? "uncommon"
            : rarityRoll < 70
              ? "epic"
              : rarityRoll < 88
                ? "rare"
                : "legendary";
  const desiredCatalog = catalog.filter(
    (relic) => relic.rarity === desiredRarity,
  );
  const eligibleCatalog = desiredCatalog.length
    ? desiredCatalog
    : catalog.filter((relic) =>
        tier === "ambient"
          ? relic.rarity === "common" || relic.rarity === "uncommon"
          : relic.rarity === "epic"
      );
  const relicIndex = await deterministicIndex(
    secret,
    `relic|${regionGeohash}|${windowId}|${slotIndex}`,
    eligibleCatalog.length,
  );

  return eligibleCatalog[relicIndex];
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED", requestId }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "UNAUTHORIZED", requestId }, 401);
    }

    const supabaseUrl = requireServerEnvironment("SUPABASE_URL");
    const anonKey = requireServerEnvironment("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireServerEnvironment(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    const spawnSecret = requireSpawnHmacSecret();

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } =
      await userClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse({ error: "UNAUTHORIZED", requestId }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rateAllowed, error: rateError } = await admin.rpc(
      "server_consume_field_rate_limit",
      {
        p_subject_key: `user:${authData.user.id}`,
        p_endpoint: "relic-field",
        p_limit: FIELD_RATE_LIMIT_PER_MINUTE,
      },
    );

    if (rateError) throw new Error("RATE_LIMIT_CHECK_FAILED");
    if (!rateAllowed)
      return jsonResponse({ error: "RATE_LIMITED", requestId }, 429);

    const body = (await request.json().catch(() => ({}))) as FieldRequest;
    const provider = body.provider ?? "gps";

    if (
      body.action === "place_test_relic" &&
      !isDevelopmentRelicTestUser(authData.user.id)
    ) {
      return jsonResponse(
        {
          error: "DEVELOPMENT_TEST_DISABLED",
          requestId,
          message: "Test relic setup is turned off for this account.",
        },
        403,
      );
    }

    if (provider === "development_mock" && !ALLOW_UNVERIFIED_SPAWNS) {
      return jsonResponse(
        { error: "DEVELOPMENT_PROVIDER_DISABLED", requestId },
        403,
      );
    }

    // Every field request proves a current anchor. The database keeps the old
    // zone only while a reveal/collection flow is protected by its grace period.
    const anchorResult = validateAnchorReadings(body);
    const anchor = anchorResult.coordinate;
    const requestedRegion = encodeGeohash(
      anchor,
      EXPLORATION_REGION_GEOHASH_PRECISION,
    );
    const requestedRegionCenter = decodeGeohashCenter(requestedRegion);
    const anchorDigest = await hmacDigest(
      spawnSecret,
      `zone-anchor|${authData.user.id}|${body.locationReadings
        ?.slice(-REQUIRED_ACCURATE_READINGS)
        .map((reading) => reading.capturedAt)
        .join("|")}`,
    );
    const anchorAttempt = await admin.rpc(
      "server_record_zone_anchor_attempt",
      {
        p_user_id: authData.user.id,
        p_latitude: anchor.latitude,
        p_longitude: anchor.longitude,
        p_reading_count: REQUIRED_ACCURATE_READINGS,
        p_maximum_accuracy_meters: anchorResult.maximumAccuracyMeters,
        p_payload_digest: anchorDigest,
      },
    );

    if (anchorAttempt.error) throw new Error("ANCHOR_VERIFICATION_FAILED");

    const { data: zoneRows, error: zoneError } = await admin.rpc(
      "server_get_or_create_exploration_zone",
      {
        p_user_id: authData.user.id,
        p_region_geohash: requestedRegion,
        p_center_latitude: requestedRegionCenter.latitude,
        p_center_longitude: requestedRegionCenter.longitude,
        p_anchor_source:
          provider === "development_mock"
            ? "development_mock"
            : "verified_gps",
      },
    );

    if (zoneError || !zoneRows?.[0]) throw new Error("ZONE_UNAVAILABLE");
    const zone = zoneRows[0] as ZoneRecord;
    const zoneCenter: Coordinate = {
      latitude: zone.center_latitude,
      longitude: zone.center_longitude,
    };

    // The database calculates this from clock_timestamp(). The client never sends
    // a window ID or clock value and therefore cannot hold a window open.
    const { data: windowRows, error: windowError } = await admin.rpc(
      "server_get_or_create_current_spawn_window",
      {
        p_region_geohash: zone.region_geohash,
        p_center_latitude: zoneCenter.latitude,
        p_center_longitude: zoneCenter.longitude,
        p_window_minutes: SPAWN_WINDOW_MINUTES,
        p_grace_period_seconds: EXPIRATION_GRACE_PERIOD_SECONDS,
      },
    );

    if (windowError || !windowRows?.[0]) throw new Error("WINDOW_UNAVAILABLE");
    const spawnWindow = windowRows[0] as WindowRecord;

    await admin.rpc("server_expire_old_relic_assignments");

    if (body.action === "place_test_relic") {
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
        .from("relic_catalog")
        .select("relic_id")
        .eq("is_enabled", true)
        .eq("rarity", "epic")
        .order("relic_id")
        .limit(1);
      if (testCatalogError || !testCatalog?.[0])
        throw new Error("TEST_RELIC_UNAVAILABLE");
      const seedDigest = await hmacDigest(
        spawnSecret,
        `development-test-audit|${authData.user.id}|${spawnWindow.window_id}|${requestId}`,
      );
      const placed = await admin.rpc("server_place_development_test_relic", {
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
      if (placed.error || !placed.data)
        throw new Error("TEST_RELIC_PLACEMENT_FAILED");
      return jsonResponse({
        requestId,
        status: "placed",
        assignmentId: placed.data,
        message: "Test relic placed 5 feet away. Tap Find Hidden Relic!",
      });
    }

    let { data: candidateRows, error: candidateError } = await admin.rpc(
      "server_list_spawn_candidates",
      {
        p_spawn_window_id: spawnWindow.spawn_window_id,
        p_user_id: authData.user.id,
      },
    );

    if (candidateError) throw new Error("CANDIDATES_UNAVAILABLE");

    const existingCandidates = (candidateRows ?? []) as CandidateRecord[];
    const missingTierCandidates = SPAWN_TIERS.some(
      (tier) =>
        existingCandidates.filter(
          (candidate) => candidate.spawn_tier === tier.name,
        ).length < tier.count,
    );
    const missingAmbientCandidate = AMBIENT_ENABLED && !existingCandidates.some(
      (candidate) => candidate.spawn_tier === "ambient",
    );

    if (missingTierCandidates || missingAmbientCandidate) {
      const { data: catalogData, error: catalogError } = await admin
        .from("relic_catalog")
        .select("relic_id, rarity")
        .eq("is_enabled", true)
        .order("relic_id");

      if (catalogError || !catalogData?.length)
        throw new Error("CATALOG_UNAVAILABLE");
      const catalog = catalogData as CatalogRelic[];

      if (missingAmbientCandidate) {
        const ambientRelic = await chooseRelic(
          spawnSecret,
          `${zone.region_geohash}|${authData.user.id}`,
          spawnWindow.window_id,
          0,
          catalog,
          "ambient",
        );
        const ambientDigest = await hmacDigest(
          spawnSecret,
          `audit|ambient|${authData.user.id}|${spawnWindow.window_id}`,
        );
        const ambientSave = await admin.rpc(
          "server_save_ambient_spawn_candidate",
          {
            p_user_id: authData.user.id,
            p_spawn_window_id: spawnWindow.spawn_window_id,
            p_relic_id: ambientRelic.relic_id,
            p_latitude: anchor.latitude,
            p_longitude: anchor.longitude,
            p_seed_digest: ambientDigest,
          },
        );
        if (ambientSave.error) throw new Error("AMBIENT_CANDIDATE_SAVE_FAILED");
      }

      const { data: safeLocationRows, error: safeLocationError } = missingTierCandidates
        ? await admin.rpc("server_get_safe_spawn_locations", {
            p_region_geohash: zone.region_geohash,
            p_center_latitude: zoneCenter.latitude,
            p_center_longitude: zoneCenter.longitude,
            p_radius_meters: REGIONAL_RADIUS_METERS,
          })
        : { data: [], error: null };

      if (safeLocationError) throw new Error("SAFE_LOCATION_LOOKUP_FAILED");

      const safeLocations: Array<Coordinate & { id: string }> = (
        safeLocationRows ?? []
      ).map(
        (location: {
          safe_location_id: string;
          latitude: number;
          longitude: number;
        }) => ({
          id: location.safe_location_id,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      );
      for (const tier of missingTierCandidates ? SPAWN_TIERS : []) {
        const existingSlots = new Set(
          existingCandidates
            .filter(
              (candidate) =>
                candidate.spawn_tier === tier.name,
            )
            .map((candidate) => candidate.slot_index),
        );
        if (existingSlots.size >= tier.count) continue;

        const safeLocationsInTier = safeLocations.filter((location) => {
          const distance = distanceMeters(zoneCenter, location);
          return distance >= tier.minimumDistanceMeters &&
            distance <= tier.maximumDistanceMeters;
        });
        const selectedSafeLocations = await selectDeterministicSafeLocations({
          secret: spawnSecret,
          regionGeohash: zone.region_geohash,
          windowId: String(spawnWindow.window_id),
          locations: safeLocationsInTier,
          count: tier.count,
          minimumSpacingMeters: tier.minimumSpacingMeters,
          seedNamespace: `${tier.name}-safe-location`,
          slotIndexOffset: tier.slotOffset,
        });
        const generatedLocations: Array<
          Coordinate & {
            slotIndex: number;
            safeLocationId: string | null;
            safetyLimitation: string | null;
          }
        > = selectedSafeLocations.map((location) => ({
          ...location,
          safeLocationId: location.id,
          safetyLimitation: null,
        }));
        const fallbackCount = ALLOW_UNVERIFIED_SPAWNS
          ? tier.count - generatedLocations.length
          : 0;

        if (fallbackCount > 0) {
          const fallbackLocations = await generateDeterministicCandidates({
            secret: spawnSecret,
            regionGeohash: zone.region_geohash,
            windowId: String(spawnWindow.window_id),
            center: zoneCenter,
            count: fallbackCount,
            minimumDistanceMeters: tier.minimumDistanceMeters,
            searchRadiusMeters: tier.maximumDistanceMeters,
            minimumSpacingMeters: tier.minimumSpacingMeters,
            seedNamespace: `${tier.name}-fallback`,
            slotIndexOffset: tier.slotOffset + generatedLocations.length,
            excludedPoints: generatedLocations,
          });
          generatedLocations.push(
            ...fallbackLocations.map((location) => ({
              ...location,
              safeLocationId: null,
              safetyLimitation:
                "Development-only coordinate; no trusted pedestrian map validation was available",
            })),
          );
        }

        for (const point of generatedLocations) {
          if (existingSlots.has(point.slotIndex)) continue;
          const relic = await chooseRelic(
            spawnSecret,
            zone.region_geohash,
            spawnWindow.window_id,
            point.slotIndex,
            catalog,
            tier.name,
          );
          const seedDigest = await hmacDigest(
            spawnSecret,
            `audit|${tier.name}|${zone.region_geohash}|${spawnWindow.window_id}|${point.slotIndex}`,
          );
          const { error: saveError } = await admin.rpc(
            "server_save_spawn_candidate",
            {
              p_spawn_window_id: spawnWindow.spawn_window_id,
              p_slot_index: point.slotIndex,
              p_relic_id: relic.relic_id,
              p_latitude: point.latitude,
              p_longitude: point.longitude,
              p_safe_location_id: point.safeLocationId,
              p_safety_status: point.safeLocationId ? "verified" : "unverified",
              p_safety_limitation: point.safetyLimitation,
              p_seed_digest: seedDigest,
              p_spawn_tier: tier.name,
            },
          );

          if (saveError) throw new Error("CANDIDATE_SAVE_FAILED");
        }
      }

      const refreshed = await admin.rpc("server_list_spawn_candidates", {
        p_spawn_window_id: spawnWindow.spawn_window_id,
        p_user_id: authData.user.id,
      });
      if (refreshed.error) throw new Error("CANDIDATES_UNAVAILABLE");
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
        exactPoint: {
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        },
        clueDistanceBandsMeters:
          candidate.spawn_tier === "ambient"
            ? AMBIENT_CLUE_DISTANCE_BANDS_METERS
            : CLUE_DISTANCE_BANDS_METERS,
      });

      const { error: assignmentError } = await admin.rpc(
        "server_assign_relic_candidate",
        {
          p_user_id: authData.user.id,
          p_zone_id: zone.zone_id,
          p_candidate_id: candidate.candidate_id,
          p_mystery_latitude: mystery.center.latitude,
          p_mystery_longitude: mystery.center.longitude,
          p_mystery_radius_meters: mystery.radiusMeters,
          p_clue_distance_band_meters: mystery.clueBandMeters,
        },
      );

      if (assignmentError) throw new Error("ASSIGNMENT_FAILED");
    }

    const { data: mysteryZones, error: mysteryError } = await admin.rpc(
      "server_list_client_mystery_zones",
      { p_user_id: authData.user.id, p_zone_id: zone.zone_id },
    );

    if (mysteryError) throw new Error("FIELD_UNAVAILABLE");

    if (Deno.env.get("RELIC_DEV_LOGGING") === "true") {
      const finalCandidates = (candidateRows ?? []) as CandidateRecord[];
      const availabilityRows = (mysteryZones ?? []) as Array<{
        availability_status?: "available" | "locked";
      }>;
      const distances = finalCandidates.map((candidate) =>
        distanceMeters(anchor, {
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        })
      );
      console.log("[RELIC WORLD]", {
        ambient: finalCandidates.filter(
          (candidate) => candidate.spawn_tier === "ambient",
        ).length,
        neighborhood: finalCandidates.filter(
          (candidate) => candidate.spawn_tier === "neighborhood",
        ).length,
        local: finalCandidates.filter(
          (candidate) => candidate.spawn_tier === "local",
        ).length,
        regional: finalCandidates.filter(
          (candidate) => candidate.spawn_tier === "regional",
        ).length,
        available: availabilityRows.filter(
          (assignment) => assignment.availability_status !== "locked",
        ).length,
        locked: availabilityRows.filter(
          (assignment) => assignment.availability_status === "locked",
        ).length,
        nearestAvailableFeet: distances.length
          ? Math.round(Math.min(...distances) * 3.28084)
          : null,
      });
    }

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
  } catch (error) {
    const internalCode =
      error instanceof Error ? error.message : "UNKNOWN_RELIC_FIELD_FAILURE";

    if (internalCode === "INVALID_ANCHOR") {
      return jsonResponse(
        {
          error: "IMPROVING_ACCURACY",
          requestId,
          message:
            "Getting a safer GPS lock… Hold still near a window or step into an open area.",
        },
        422,
      );
    }

    console.error(`[relic-field:${requestId}] ${internalCode}`);

    return jsonResponse(
      {
        error: "RELIC_FIELD_UNAVAILABLE",
        requestId,
      },
      500,
    );
  }
});
