import { distanceMeters, type Coordinate } from './spawn-algorithm.ts';

export type ProximitySample = Coordinate & {
  sampleId: string;
  capturedAt: string;
  accuracyMeters: number;
  speedMetersPerSecond?: number | null;
  provider?: string;
  mocked?: boolean;
};

export type ProximityStatus =
  | 'too_far'
  | 'approaching'
  | 'improving_accuracy'
  | 'revealed'
  | 'expired'
  | 'ineligible'
  | 'invalid_movement'
  | 'already_collected';

export type ProximityResult = {
  status: Exclude<ProximityStatus, 'expired' | 'ineligible' | 'already_collected'>;
  clueStrength: 0 | 1 | 2 | 3;
  radiusUsedMeters: number | null;
  maximumAccuracyMeters: number | null;
  medianPoint: Coordinate | null;
  measuredDistanceMeters: number | null;
  acceptedReadingCount: number;
  rejectionCode: string | null;
};

export function distanceInFeet(distanceInMeters: number | null) {
  if (distanceInMeters === null || !Number.isFinite(distanceInMeters) || distanceInMeters < 0) {
    return null;
  }
  return Math.max(0, Math.round(distanceInMeters / 0.3048));
}

export function bearingDegrees(from: Coordinate, to: Coordinate) {
  const fromLatitude = from.latitude * (Math.PI / 180);
  const toLatitude = to.latitude * (Math.PI / 180);
  const longitudeDelta = (to.longitude - from.longitude) * (Math.PI / 180);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

export function distanceInFeetWhenNearby(
  distanceInMeters: number | null,
  searchRadiusFeet = 10,
) {
  if (distanceInMeters === null || !Number.isFinite(distanceInMeters) || distanceInMeters < 0) {
    return null;
  }
  const preciseDistanceFeet = distanceInMeters / 0.3048;
  if (preciseDistanceFeet > searchRadiusFeet) return null;
  return distanceInFeet(distanceInMeters);
}

type Options = {
  serverNow: Date;
  targetRadiusMeters: number;
  fallbackRadiusMeters: number;
  requiredReadings: number;
  maxAccuracyMeters: number;
  maxSpeedMetersPerSecond: number;
  clueBandsMeters: readonly [number, number, number];
};

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function invalid(rejectionCode: string): ProximityResult {
  return {
    status: 'invalid_movement', clueStrength: 0, radiusUsedMeters: null,
    maximumAccuracyMeters: null, medianPoint: null, measuredDistanceMeters: null,
    acceptedReadingCount: 0, rejectionCode,
  };
}

export function verifyProximitySamples(
  samples: ProximitySample[],
  exactPoint: Coordinate,
  options: Options,
): ProximityResult {
  if (samples.length < options.requiredReadings) return invalid('INSUFFICIENT_READINGS');
  const readings = samples.slice(-options.requiredReadings);
  const now = options.serverNow.getTime();
  let previousTime = 0;

  for (const reading of readings) {
    const capturedAt = Date.parse(reading.capturedAt);
    if (
      !Number.isFinite(reading.latitude) || Math.abs(reading.latitude) > 90 ||
      !Number.isFinite(reading.longitude) || Math.abs(reading.longitude) > 180
    ) return invalid('INVALID_COORDINATE');
    if (!Number.isFinite(capturedAt) || capturedAt <= previousTime) return invalid('OUT_OF_ORDER');
    if (capturedAt < now - 30_000 || capturedAt > now + 5_000) return invalid('STALE_OR_FUTURE');
    if (previousTime && (capturedAt - previousTime < 1_000 || capturedAt - previousTime > 12_000)) {
      return invalid('INVALID_SAMPLE_INTERVAL');
    }
    if (reading.mocked) return invalid('MOCKED_LOCATION');
    if ((reading.speedMetersPerSecond ?? 0) > options.maxSpeedMetersPerSecond) {
      return invalid('SPEED_TOO_HIGH');
    }
    previousTime = capturedAt;
  }

  for (let index = 1; index < readings.length; index += 1) {
    const elapsed = (Date.parse(readings[index].capturedAt) - Date.parse(readings[index - 1].capturedAt)) / 1_000;
    const traveled = distanceMeters(readings[index - 1], readings[index]);
    if (traveled / elapsed > options.maxSpeedMetersPerSecond) return invalid('IMPOSSIBLE_SPEED');
    if (traveled >= 250 && elapsed <= 12) return invalid('GPS_TELEPORT');
  }

  const maximumAccuracy = Math.max(...readings.map((reading) => reading.accuracyMeters));
  const medianAccuracy = median(readings.map((reading) => reading.accuracyMeters));
  if (
    readings.some((reading) => !Number.isFinite(reading.accuracyMeters) || reading.accuracyMeters < 0) ||
    maximumAccuracy > options.maxAccuracyMeters || medianAccuracy > options.fallbackRadiusMeters
  ) {
    return {
      status: 'improving_accuracy', clueStrength: 0, radiusUsedMeters: null,
      maximumAccuracyMeters: Number.isFinite(maximumAccuracy) ? maximumAccuracy : null,
      medianPoint: null, measuredDistanceMeters: null, acceptedReadingCount: 0,
      rejectionCode: 'POOR_ACCURACY',
    };
  }

  // The strict radius is used only when every reading is at least that accurate.
  // Otherwise the configured fallback is allowed, but it is never expanded.
  const radius = maximumAccuracy <= options.targetRadiusMeters
    ? options.targetRadiusMeters
    : options.fallbackRadiusMeters;
  const distances = readings.map((reading) => distanceMeters(reading, exactPoint));
  const medianDistance = median(distances);
  const medianPoint = {
    latitude: median(readings.map((reading) => reading.latitude)),
    longitude: median(readings.map((reading) => reading.longitude)),
  };

  if (distances.every((distance) => distance <= radius)) {
    return {
      status: 'revealed', clueStrength: 3, radiusUsedMeters: radius,
      maximumAccuracyMeters: maximumAccuracy, medianPoint,
      measuredDistanceMeters: medianDistance, acceptedReadingCount: readings.length,
      rejectionCode: null,
    };
  }

  const [far, medium, near] = options.clueBandsMeters;
  const clueStrength: 0 | 1 | 2 | 3 = medianDistance <= near
    ? 3
    : medianDistance <= medium
      ? 2
      : medianDistance <= far
        ? 1
        : 0;
  return {
    status: clueStrength ? 'approaching' : 'too_far', clueStrength,
    radiusUsedMeters: radius, maximumAccuracyMeters: maximumAccuracy, medianPoint,
    measuredDistanceMeters: medianDistance, acceptedReadingCount: readings.length,
    rejectionCode: null,
  };
}
