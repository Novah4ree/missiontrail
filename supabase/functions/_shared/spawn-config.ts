type DenoLikeRuntime = typeof globalThis & {
  Deno?: {
    env: {
      get(name: string): string | undefined;
    };
  };
};

function readServerEnvironment(name: string) {
  return (globalThis as DenoLikeRuntime).Deno?.env.get(name);
}

function readPositiveNumber(name: string, fallback: number) {
  const value = readServerEnvironment(name);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid server configuration: ${name}`);
  }

  return parsed;
}

function readPositiveInteger(name: string, fallback: number) {
  const parsed = readPositiveNumber(name, fallback);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid server configuration: ${name}`);
  }

  return parsed;
}

function readBoolean(name: string, fallback: boolean) {
  const value = readServerEnvironment(name);

  if (!value) {
    return fallback;
  }

  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new Error(`Invalid server configuration: ${name}`);
}

function readDistanceBands() {
  const raw = readServerEnvironment('RELIC_CLUE_DISTANCE_BANDS_METERS');

  if (!raw) {
    return [500, 200, 75] as const;
  }

  const values = raw.split(',').map((value) => Number(value.trim()));

  if (values.length !== 3 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Invalid server configuration: RELIC_CLUE_DISTANCE_BANDS_METERS');
  }

  return values as [number, number, number];
}

// These values are server configuration. Never duplicate the HMAC secret in Expo
// config or an EXPO_PUBLIC_* variable because those values ship inside the app.
export const SPAWN_WINDOW_MINUTES = readPositiveInteger('RELIC_SPAWN_WINDOW_MINUTES', 30);
export const SEARCH_RADIUS_MILES = readPositiveNumber('RELIC_SEARCH_RADIUS_MILES', 10);
export const SEARCH_RADIUS_METERS = readPositiveNumber(
  'RELIC_SEARCH_RADIUS_METERS',
  16_093.44,
);
export const TARGET_REVEAL_RADIUS_METERS = readPositiveNumber(
  'RELIC_TARGET_REVEAL_RADIUS_METERS',
  4.57,
);
export const FALLBACK_REVEAL_RADIUS_METERS = readPositiveNumber(
  'RELIC_FALLBACK_REVEAL_RADIUS_METERS',
  9,
);
export const NEARBY_SEARCH_RADIUS_FEET = readPositiveNumber(
  'RELIC_NEARBY_SEARCH_RADIUS_FEET',
  10,
);
export const NEARBY_SEARCH_RADIUS_METERS = NEARBY_SEARCH_RADIUS_FEET * 0.3048;
export const REQUIRED_ACCURATE_READINGS = readPositiveInteger(
  'RELIC_REQUIRED_ACCURATE_READINGS',
  3,
);
export const MAX_ACCEPTABLE_GPS_ACCURACY_METERS = readPositiveNumber(
  'RELIC_MAX_ACCEPTABLE_GPS_ACCURACY_METERS',
  12,
);
export const RARE_DISTANCE_MILES = readPositiveNumber('RELIC_RARE_DISTANCE_MILES', 5);
export const RARE_DISTANCE_METERS = readPositiveNumber(
  'RELIC_RARE_DISTANCE_METERS',
  8_046.72,
);
export const LEGENDARY_DISTANCE_MILES = readPositiveNumber(
  'RELIC_LEGENDARY_DISTANCE_MILES',
  10,
);
export const LEGENDARY_DISTANCE_METERS = readPositiveNumber(
  'RELIC_LEGENDARY_DISTANCE_METERS',
  16_093.44,
);
export const DAILY_MISSION_OVERRIDE_ENABLED = readBoolean(
  'RELIC_DAILY_MISSION_OVERRIDE_ENABLED',
  true,
);
export const EXPIRATION_GRACE_PERIOD_SECONDS = readPositiveInteger(
  'RELIC_EXPIRATION_GRACE_PERIOD_SECONDS',
  120,
);
export const CLUE_DISTANCE_BANDS_METERS = readDistanceBands();

export const CANDIDATES_PER_WINDOW = readPositiveInteger(
  'RELIC_CANDIDATES_PER_WINDOW',
  6,
);
export const MIN_CANDIDATE_SPACING_METERS = readPositiveNumber(
  'RELIC_MIN_CANDIDATE_SPACING_METERS',
  250,
);
export const EXPLORATION_REGION_GEOHASH_PRECISION = readPositiveInteger(
  'RELIC_REGION_GEOHASH_PRECISION',
  5,
);
export const FIELD_RATE_LIMIT_PER_MINUTE = readPositiveInteger(
  'RELIC_FIELD_RATE_LIMIT_PER_MINUTE',
  12,
);

// This is false by default. Production should fail safely when no trusted walking
// location data exists. Staging can explicitly enable unverified algorithm testing.
export const ALLOW_UNVERIFIED_SPAWNS = readBoolean('RELIC_ALLOW_UNVERIFIED_SPAWNS', false);

export function requireSpawnHmacSecret() {
  const secret = readServerEnvironment('RELIC_SPAWN_HMAC_SECRET');

  if (!secret || secret.length < 32) {
    throw new Error('Server relic spawning is not configured');
  }

  return secret;
}
