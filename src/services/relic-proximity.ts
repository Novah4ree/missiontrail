import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LocationObject } from "expo-location";

import { supabase } from "../../lib/supabase";
import type {
  CollectionResult,
  MysteryZone,
  NearbyRelicSignal,
  ProximityLocationSample,
  RelicProximityStatus,
  RevealedRelic,
} from "@/types/relic-proximity";

const INSTALLATION_ID_KEY = "mission-trail:installation-id:v1";
const CHALLENGE_PREFIX = "mission-trail:relic-challenge:v1:";

type FieldResponse = {
  zones?: {
    assignment_id: string;
    mystery_latitude: number;
    mystery_longitude: number;
    mystery_radius_meters: number;
    clue_distance_band_meters: number;
    status: string;
    availability_status?: "available" | "locked";
    encounter_type: "ambient" | "neighborhood" | "local" | "regional";
    expires_at: string;
    grace_ends_at: string;
  }[];
  limitation?: string;
  refreshAfterSeconds?: number;
};

type DevelopmentPlacementResponse = {
  status: "placed";
  assignmentId: string;
  message: string;
};

type ProximityResponse = {
  status: RelicProximityStatus;
  message: string;
  reason?: "NO_AVAILABLE_ASSIGNMENTS" | "LOCKED_ASSIGNMENTS_ONLY";
  assignmentId?: string;
  distanceFeet?: number;
  bearingDegrees?: number | null;
  direction?: string | null;
  clueStrength?: 0 | 1 | 2 | 3;
  encounterType?: "ambient" | "neighborhood" | "local" | "regional";
  signals?: NearbyRelicSignal[];
  challenge?: { token: string; expiresAt: string };
  relic?: RevealedRelic;
  collection?: CollectionResult;
};

export class RelicProximityError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RelicProximityError";
  }
}

// Purpose: Implements the random installation id operation.
function randomInstallationId() {
  return `install-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// Purpose: Returns installation id.
export async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = randomInstallationId();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, created);
  return created;
}

// Purpose: Implements the locations to proximity samples operation.
export function locationsToProximitySamples(
  locations: LocationObject[],
): ProximityLocationSample[] {
  // iOS can occasionally deliver GPS callbacks slightly out of timestamp order,
  // especially when the first location fix and the live watcher overlap.
  //
  // The relic server intentionally requires strictly increasing readings that
  // are 1–10 seconds apart, so build the newest valid chronological chain here.
  const orderedLocations = [...locations]
    .filter((location) => Number.isFinite(location.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);

  const spacedLocations: LocationObject[] = [];

  for (const location of orderedLocations) {
    const previous = spacedLocations.at(-1);

    if (!previous) {
      spacedLocations.push(location);
      continue;
    }

    const deltaMs = location.timestamp - previous.timestamp;

    // Two callbacks can represent nearly the same GPS moment.
    // Keep the newer one rather than sending both to the server.
    if (deltaMs < 1_000) {
      spacedLocations[spacedLocations.length - 1] = location;
      continue;
    }

    // A gap larger than the server's anchor window starts a fresh chain.
    if (deltaMs > 10_000) {
      spacedLocations.length = 0;
      spacedLocations.push(location);
      continue;
    }

    spacedLocations.push(location);

    if (spacedLocations.length > 3) {
      spacedLocations.shift();
    }
  }

  return spacedLocations.slice(-3).map((location) => ({
    // Keep coordinates out of identifiers so request metadata and error tools do
    // not accidentally turn an opaque ID into another copy of a location.
    sampleId: `location-${Math.round(location.timestamp)}`,
    capturedAt: new Date(location.timestamp).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? Number.POSITIVE_INFINITY,
    speedMetersPerSecond: location.coords.speed ?? null,
    provider: "gps",
    mocked: location.mocked ?? false,
  }));
}

type FunctionErrorPayload = { error?: string; message?: string };

// Purpose: Implements the as error operation.
async function asError(error: unknown, fallback: string) {
  const context = (error as { context?: unknown } | null)?.context;
  let payload: FunctionErrorPayload | null = null;

  if (context && typeof context === "object") {
    const legacyBody = (context as { body?: FunctionErrorPayload }).body;
    if (legacyBody && typeof legacyBody === "object") {
      payload = legacyBody;
    } else {
      const response = context as {
        clone?: () => Response;
        json?: () => Promise<unknown>;
      };
      try {
        const body = response.clone
          ? await response.clone().json()
          : response.json
            ? await response.json()
            : null;
        if (body && typeof body === "object") {
          payload = body as FunctionErrorPayload;
        }
      } catch {
        payload = null;
      }
    }
  }

  return new RelicProximityError(
    payload?.error ?? "NETWORK_RETRY",
    payload?.message ?? fallback,
  );
}

// Purpose: Returns mystery zones.
export async function getMysteryZones(samples: ProximityLocationSample[]) {
  const { data, error } = await supabase.functions.invoke<FieldResponse>(
    "relic-field",
    {
      body: { provider: "gps", locationReadings: samples },
    },
  );
  if (error || !data) {
    throw await asError(
      error,
      "Hidden Relic Areas could not load. Tap Try Again.",
    );
  }
  return {
    limitation: data.limitation,
    refreshAfterSeconds: Math.max(1, data.refreshAfterSeconds ?? 30 * 60),
    zones: (data.zones ?? []).map((zone): MysteryZone => ({
      assignmentId: zone.assignment_id,
      latitude: zone.mystery_latitude,
      longitude: zone.mystery_longitude,
      radiusMeters: zone.mystery_radius_meters,
      clueBandMeters: zone.clue_distance_band_meters,
      status: zone.status,
      availability: zone.availability_status ?? "available",
      encounterType: zone.encounter_type,
      expiresAt: zone.expires_at,
      graceEndsAt: zone.grace_ends_at,
    })),
  };
}

// Purpose: Implements the place development test relic operation.
export async function placeDevelopmentTestRelic(
  samples: ProximityLocationSample[],
) {
  if (!__DEV__) {
    throw new RelicProximityError(
      "DEVELOPMENT_TEST_DISABLED",
      "Test relic setup is unavailable.",
    );
  }
  const { data, error } =
    await supabase.functions.invoke<DevelopmentPlacementResponse>(
      "relic-field",
      {
        body: {
          action: "place_test_relic",
          provider: "gps",
          locationReadings: samples,
        },
      },
    );
  if (error || !data) {
    throw await asError(
      error,
      "The test relic could not be placed. Tap Try Again.",
    );
  }
  return data;
}

// Purpose: Implements the invoke proximity operation.
async function invokeProximity(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<ProximityResponse>(
    "relic-proximity",
    { body },
  );
  if (error || !data) {
    throw await asError(
      error,
      "We couldn’t check your location. Please try again.",
    );
  }
  if (__DEV__) {
    console.log("[RELIC SUPABASE]", {
      operation: body.action ?? "unknown",
      success: true,
    });
  }
  return data;
}

// Purpose: Verifies relic proximity.
export async function verifyRelicProximity(
  assignmentId: string,
  samples: ProximityLocationSample[],
) {
  const deviceInstallationId = await getInstallationId();
  const result = await invokeProximity({
    action: "verify",
    assignmentId,
    samples,
    deviceInstallationId,
  });
  if (result.challenge) {
    await AsyncStorage.setItem(
      `${CHALLENGE_PREFIX}${assignmentId}`,
      JSON.stringify(result.challenge),
    );
  }
  return result;
}

// Purpose: Implements the scan nearby relics operation.
export async function scanNearbyRelics(
  samples: ProximityLocationSample[],
  targetAssignmentId?: string,
) {
  const result = await invokeProximity({
    action: "find",
    samples,
    targetAssignmentId,
    deviceInstallationId: await getInstallationId(),
  });
  if (result.challenge && result.assignmentId) {
    await AsyncStorage.setItem(
      `${CHALLENGE_PREFIX}${result.assignmentId}`,
      JSON.stringify(result.challenge),
    );
  }
  return result;
}

// Purpose: Implements the collect revealed relic operation.
export async function collectRevealedRelic(
  assignmentId: string,
  samples: ProximityLocationSample[],
) {
  const stored = await AsyncStorage.getItem(
    `${CHALLENGE_PREFIX}${assignmentId}`,
  );
  const challenge = stored
    ? (JSON.parse(stored) as { token: string; expiresAt: string })
    : null;
  if (!challenge)
    throw new RelicProximityError(
      "CHALLENGE_REQUIRED",
      "Tap Find Hidden Relic before collecting.",
    );
  const result = await invokeProximity({
    action: "collect",
    assignmentId,
    samples,
    deviceInstallationId: await getInstallationId(),
    challengeToken: challenge.token,
  });
  if (result.status === "collected" || result.status === "already_collected") {
    await AsyncStorage.removeItem(`${CHALLENGE_PREFIX}${assignmentId}`);
  }
  return result;
}
