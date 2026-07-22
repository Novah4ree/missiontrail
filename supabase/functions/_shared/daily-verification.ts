import { distanceMeters, type Coordinate } from './spawn-algorithm.ts';
import { validateLocationPoint } from './mission-requirements.ts';

export const METERS_PER_MILE = 1_609.344;
export const RARE_DISTANCE_METERS = 8_046.72;
export const LEGENDARY_DISTANCE_METERS = 16_093.44;
export const DEFAULT_MAX_SPEED_METERS_PER_SECOND = 8.9408; // Existing app limit: 20 mph.
export const DEFAULT_MAX_GPS_ACCURACY_METERS = 12;
export const DEFAULT_MAX_OFFLINE_AGE_HOURS = 24;

export type DistanceProvider =
  | 'gps'
  | 'healthkit'
  | 'health_connect'
  | 'development_mock';

export type MovementKind = 'walking' | 'running' | 'cycling' | 'driving' | 'unknown';

export type GpsSample = Coordinate & {
  sampleId: string;
  capturedAt: string;
  accuracyMeters: number;
  reportedSpeedMetersPerSecond?: number | null;
  mocked?: boolean;
  movementKind?: MovementKind;
};

export type VerifiedSegment = {
  startSampleId: string;
  endSampleId: string;
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  speedMetersPerSecond: number;
};

export type RejectedSegment = {
  startSampleId: string;
  endSampleId: string;
  code:
    | 'INACCURATE_GPS'
    | 'INVALID_COORDINATE'
    | 'MOCKED_LOCATION'
    | 'INVALID_TIMESTAMP'
    | 'STALE_SAMPLE'
    | 'FUTURE_SAMPLE'
    | 'UNSUPPORTED_MOVEMENT'
    | 'SPEED_TOO_HIGH'
    | 'GPS_TELEPORT'
    | 'NO_MOVEMENT';
};

type GpsValidationOptions = {
  serverNow: Date;
  maxAccuracyMeters?: number;
  maxSpeedMetersPerSecond?: number;
  maxOfflineAgeHours?: number;
  maximumSegmentSeconds?: number;
  teleportDistanceMeters?: number;
  allowMocked?: boolean;
};

export function validateGpsSamples(
  samples: GpsSample[],
  {
    serverNow,
    maxAccuracyMeters = DEFAULT_MAX_GPS_ACCURACY_METERS,
    maxSpeedMetersPerSecond = DEFAULT_MAX_SPEED_METERS_PER_SECOND,
    maxOfflineAgeHours = DEFAULT_MAX_OFFLINE_AGE_HOURS,
    maximumSegmentSeconds = 120,
    teleportDistanceMeters = 500,
    allowMocked = false,
  }: GpsValidationOptions,
) {
  const accepted: VerifiedSegment[] = [];
  const rejected: RejectedSegment[] = [];

  for (let index = 1; index < samples.length; index += 1) {
    const start = samples[index - 1];
    const end = samples[index];
    const reject = (code: RejectedSegment['code']) =>
      rejected.push({ startSampleId: start.sampleId, endSampleId: end.sampleId, code });
    if (
      [start.movementKind, end.movementKind].some(
        (kind) => kind === 'cycling' || kind === 'driving',
      )
    ) {
      reject('UNSUPPORTED_MOVEMENT');
      continue;
    }

    const validation = validateLocationPoint(start, end, {
      serverNow,
      maxAccuracyMeters,
      maxSpeedMetersPerSecond,
      maxOfflineAgeHours,
      maximumSegmentSeconds,
      teleportDistanceMeters,
      allowMocked,
      distanceBetween: distanceMeters,
    });
    if (!validation.accepted) {
      reject(validation.code);
      continue;
    }

    accepted.push({
      startSampleId: start.sampleId,
      endSampleId: end.sampleId,
      startedAt: new Date(Date.parse(start.capturedAt)).toISOString(),
      endedAt: new Date(Date.parse(end.capturedAt)).toISOString(),
      distanceMeters: validation.distanceMeters,
      durationSeconds: validation.durationSeconds,
      speedMetersPerSecond: validation.speedMetersPerSecond,
    });
  }

  return { accepted, rejected };
}

export function calculateEarnedEligibility(distanceMetersValue: number, missionOverride: boolean) {
  return {
    rareEarned: missionOverride || distanceMetersValue >= RARE_DISTANCE_METERS,
    legendaryEarned: missionOverride || distanceMetersValue >= LEGENDARY_DISTANCE_METERS,
    reason: missionOverride ? ('daily_missions' as const) : ('distance' as const),
  };
}

export function allRequiredMissionsComplete(
  missions: Array<{ required: boolean; completed: boolean }>,
) {
  const required = missions.filter((mission) => mission.required);
  return required.length > 0 && required.every((mission) => mission.completed);
}

export function getSafeLocalDate(at: Date, timezoneName: string | null | undefined) {
  const fallbackTimezone = 'UTC';
  let timezone = timezoneName || fallbackTimezone;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(at);
  } catch {
    timezone = fallbackTimezone;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return { localDate: `${value.year}-${value.month}-${value.day}`, timezone };
}

export function rangesOverlap(
  left: { startedAt: string; endedAt: string },
  right: { startedAt: string; endedAt: string },
) {
  return Date.parse(left.startedAt) < Date.parse(right.endedAt) &&
    Date.parse(right.startedAt) < Date.parse(left.endedAt);
}
