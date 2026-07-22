function readEnvironment(name: string) {
  return Deno.env.get(name);
}

function readBoolean(name: string, fallback: boolean) {
  const value = readEnvironment(name);
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Invalid server configuration: ${name}`);
}

function readPositiveNumber(name: string, fallback: number) {
  const parsed = Number(readEnvironment(name) ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid server configuration: ${name}`);
  }
  return parsed;
}

export const DISTANCE_RATE_LIMIT_PER_MINUTE = readPositiveNumber(
  'RELIC_DISTANCE_RATE_LIMIT_PER_MINUTE',
  10,
);
export const MAX_MOVEMENT_SPEED_METERS_PER_SECOND = readPositiveNumber(
  'RELIC_MAX_MOVEMENT_SPEED_METERS_PER_SECOND',
  8.9408,
);
export const MAX_OFFLINE_SAMPLE_AGE_HOURS = readPositiveNumber(
  'RELIC_MAX_OFFLINE_SAMPLE_AGE_HOURS',
  24,
);
export const HEALTH_SYNC_ENABLED = readBoolean('RELIC_HEALTH_SYNC_ENABLED', false);
export const DEVELOPMENT_DISTANCE_MOCK_ENABLED = readBoolean(
  'RELIC_ALLOW_DEVELOPMENT_DISTANCE_MOCK',
  false,
);
export const DEVELOPMENT_RELIC_TEST_ENABLED = readBoolean(
  'RELIC_ALLOW_DEVELOPMENT_TEST_RELIC',
  false,
);
export const PROXIMITY_VERIFICATIONS_PER_MINUTE = readPositiveNumber(
  'RELIC_PROXIMITY_VERIFICATIONS_PER_MINUTE',
  12,
);
export const COLLECTION_ATTEMPTS_PER_MINUTE = readPositiveNumber(
  'RELIC_COLLECTION_ATTEMPTS_PER_MINUTE',
  6,
);

export function isDevelopmentMockUser(userId: string) {
  const allowList = (readEnvironment('RELIC_DEVELOPMENT_USER_IDS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return DEVELOPMENT_DISTANCE_MOCK_ENABLED && allowList.includes(userId);
}

export function isDevelopmentRelicTestUser(userId: string) {
  const allowList = (readEnvironment('RELIC_DEVELOPMENT_USER_IDS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return DEVELOPMENT_RELIC_TEST_ENABLED && allowList.includes(userId);
}
