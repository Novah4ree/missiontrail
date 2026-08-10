const MAX_LOCATION_AGE_MS = 5 * 60 * 1_000;
const MAX_FUTURE_LOCATION_MS = 60 * 1_000;
const MAX_ACCURACY_METERS = 1_000;

export type ValidatedGpsPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  source: 'gps';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateCoordinate(latitude: unknown, longitude: unknown) {
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) return null;
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function normalizeUsZipCode(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^\d{5}$/.test(normalized) ? normalized : null;
}

/** Rejects malformed, implausible, or stale native GPS samples before state sees them. */
export function validateGpsPosition(
  position: unknown,
  now = Date.now(),
): ValidatedGpsPosition | null {
  if (!isRecord(position) || !isRecord(position.coords)) return null;

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const accuracy = position.coords.accuracy;
  const timestamp = position.timestamp;

  const coordinate = validateCoordinate(latitude, longitude);
  if (!coordinate) return null;

  if (!isFiniteNumber(accuracy) || accuracy < 0 || accuracy > MAX_ACCURACY_METERS) return null;
  if (!isFiniteNumber(timestamp) || timestamp <= 0) return null;

  const age = now - timestamp;
  if (age > MAX_LOCATION_AGE_MS || age < -MAX_FUTURE_LOCATION_MS) return null;

  return { ...coordinate, accuracy, timestamp, source: 'gps' };
}

/** Validates a GPS value already stored in centralized location state. */
export function validateActiveGpsLocation(value: unknown, now = Date.now()) {
  if (!isRecord(value) || value.source !== 'gps') return null;
  return validateGpsPosition({
    coords: {
      latitude: value.latitude,
      longitude: value.longitude,
      accuracy: value.accuracy,
    },
    timestamp: value.timestamp,
  }, now);
}
