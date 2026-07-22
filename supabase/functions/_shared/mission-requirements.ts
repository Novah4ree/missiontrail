export type MissionState = 'locked' | 'active' | 'completed' | 'claimed';

export type MissionRequirementType =
  | 'distance'
  | 'steps'
  | 'relic'
  | 'location'
  | 'daily_set';

export type MissionRequirement = {
  type: MissionRequirementType;
  target: number;
};

export type MissionEvidence = {
  verifiedDistanceMeters?: number;
  verifiedSteps?: number;
  verifiedRelics?: number;
  verifiedLocationEntries?: number;
  requiredMissionStates?: MissionState[];
};

export type MissionRecord = {
  id: string;
  state: MissionState;
  progress: number;
  target: number;
};

export type LocationPoint = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  reportedSpeedMetersPerSecond?: number | null;
  mocked?: boolean;
};

export type LocationValidationOptions = {
  serverNow: Date;
  maxAccuracyMeters: number;
  maxSpeedMetersPerSecond: number;
  maxOfflineAgeHours: number;
  maximumSegmentSeconds: number;
  teleportDistanceMeters: number;
  allowMocked: boolean;
  distanceBetween: (start: LocationPoint, end: LocationPoint) => number;
};

export type LocationValidationResult =
  | { accepted: true; distanceMeters: number; durationSeconds: number; speedMetersPerSecond: number }
  | { accepted: false; code: 'INACCURATE_GPS' | 'INVALID_COORDINATE' | 'MOCKED_LOCATION' | 'INVALID_TIMESTAMP' | 'STALE_SAMPLE' | 'FUTURE_SAMPLE' | 'SPEED_TOO_HIGH' | 'GPS_TELEPORT' | 'NO_MOVEMENT' };

// Checks one pair of GPS readings. Only an accurate, realistic movement segment
// can become mission progress; time passing by itself never adds distance.
export function validateLocationPoint(
  start: LocationPoint,
  end: LocationPoint,
  options: LocationValidationOptions,
): LocationValidationResult {
  const startMs = Date.parse(start.capturedAt);
  const endMs = Date.parse(end.capturedAt);
  const now = options.serverNow.getTime();
  const oldestAllowed = now - options.maxOfflineAgeHours * 60 * 60 * 1_000;

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { accepted: false, code: 'INVALID_TIMESTAMP' };
  }
  if (
    !Number.isFinite(start.latitude) || !Number.isFinite(start.longitude) ||
    !Number.isFinite(end.latitude) || !Number.isFinite(end.longitude) ||
    Math.abs(start.latitude) > 90 || Math.abs(end.latitude) > 90 ||
    Math.abs(start.longitude) > 180 || Math.abs(end.longitude) > 180
  ) {
    return { accepted: false, code: 'INVALID_COORDINATE' };
  }
  if (
    !Number.isFinite(start.accuracyMeters) || !Number.isFinite(end.accuracyMeters) ||
    start.accuracyMeters > options.maxAccuracyMeters ||
    end.accuracyMeters > options.maxAccuracyMeters
  ) {
    return { accepted: false, code: 'INACCURATE_GPS' };
  }
  if (!options.allowMocked && (start.mocked || end.mocked)) {
    return { accepted: false, code: 'MOCKED_LOCATION' };
  }
  if (startMs < oldestAllowed || endMs < oldestAllowed) {
    return { accepted: false, code: 'STALE_SAMPLE' };
  }
  if (startMs > now + 120_000 || endMs > now + 120_000) {
    return { accepted: false, code: 'FUTURE_SAMPLE' };
  }

  const durationSeconds = (endMs - startMs) / 1_000;
  const distance = options.distanceBetween(start, end);
  const impliedSpeed = distance / durationSeconds;
  const reportedSpeed = Math.max(
    start.reportedSpeedMetersPerSecond ?? 0,
    end.reportedSpeedMetersPerSecond ?? 0,
  );

  if (distance < 1) return { accepted: false, code: 'NO_MOVEMENT' };
  if (durationSeconds > options.maximumSegmentSeconds) {
    return {
      accepted: false,
      code: distance >= options.teleportDistanceMeters ? 'GPS_TELEPORT' : 'INVALID_TIMESTAMP',
    };
  }
  if (distance >= options.teleportDistanceMeters && impliedSpeed > options.maxSpeedMetersPerSecond) {
    return { accepted: false, code: 'GPS_TELEPORT' };
  }
  if (impliedSpeed > options.maxSpeedMetersPerSecond || reportedSpeed > options.maxSpeedMetersPerSecond) {
    return { accepted: false, code: 'SPEED_TOO_HIGH' };
  }

  return { accepted: true, distanceMeters: distance, durationSeconds, speedMetersPerSecond: impliedSpeed };
}

// Turns trusted map, step, relic, or location evidence into one comparable number.
export function evaluateMissionRequirement(
  requirement: MissionRequirement,
  evidence: MissionEvidence,
) {
  const progress = requirement.type === 'distance'
    ? evidence.verifiedDistanceMeters ?? 0
    : requirement.type === 'steps'
      ? evidence.verifiedSteps ?? 0
      : requirement.type === 'relic'
        ? evidence.verifiedRelics ?? 0
        : requirement.type === 'location'
          ? evidence.verifiedLocationEntries ?? 0
          : (evidence.requiredMissionStates ?? []).length > 0 &&
              (evidence.requiredMissionStates ?? []).every((state) => state === 'completed' || state === 'claimed')
            ? requirement.target
            : 0;

  return { progress, met: progress >= requirement.target };
}

// Applies new verified evidence to an active mission. A locked mission ignores it.
export function updateMissionProgress(
  mission: MissionRecord,
  requirement: MissionRequirement,
  evidence: MissionEvidence,
): MissionRecord {
  if (mission.state !== 'active') return mission;
  const result = evaluateMissionRequirement(requirement, evidence);
  return completeMission({ ...mission, progress: Math.max(mission.progress, result.progress) });
}

// Completes a mission only after its verified progress reaches the exact target.
export function completeMission(mission: MissionRecord): MissionRecord {
  if (mission.state !== 'active' || mission.progress < mission.target) return mission;
  return { ...mission, state: 'completed' };
}

// Models the one-way reward transition. Production rewards are still written by
// the database transaction, so changing a phone's copy cannot grant XP.
export function claimMissionReward(mission: MissionRecord) {
  if (mission.state !== 'completed') return { awarded: false, mission };
  return { awarded: true, mission: { ...mission, state: 'claimed' as const } };
}

// A card tap only chooses which details to show. It returns the same mission data
// and deliberately has no completion side effect.
export function selectMissionForDetails(missions: MissionRecord[], missionId: string) {
  return missions.find((mission) => mission.id === missionId) ?? null;
}
