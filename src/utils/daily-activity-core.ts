import {
  DEFAULT_STRIDE_LENGTH_METERS,
  FALLBACK_ACTIVE_CALORIES_PER_KILOMETER,
  MAX_DAILY_STEPS,
  METERS_PER_MILE,
} from '../config/activity-rules.ts';

export type ActivityDistanceSource = 'verified_gps' | 'estimated_steps';

// Purpose: Returns local date key.
export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Purpose: Starts of local day.
export function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Purpose: Clamps daily steps to its supported range.
export function clampDailySteps(steps: number) {
  if (!Number.isFinite(steps)) return 0;
  return Math.min(MAX_DAILY_STEPS, Math.max(0, Math.floor(steps)));
}

// Purpose: Implements the steps to meters operation.
export function stepsToMeters(
  steps: number,
  strideLengthMeters = DEFAULT_STRIDE_LENGTH_METERS,
) {
  const safeStride = Number.isFinite(strideLengthMeters)
    ? Math.max(0, strideLengthMeters)
    : DEFAULT_STRIDE_LENGTH_METERS;
  return clampDailySteps(steps) * safeStride;
}

// Purpose: Implements the meters to miles operation.
export function metersToMiles(meters: number) {
  return Math.max(0, Number.isFinite(meters) ? meters : 0) / METERS_PER_MILE;
}

// Purpose: Selects daily distance.
export function selectDailyDistance(
  verifiedGpsMeters: number,
  todaySteps: number,
): { meters: number; source: ActivityDistanceSource } {
  const safeGpsMeters = Number.isFinite(verifiedGpsMeters)
    ? Math.max(0, verifiedGpsMeters)
    : 0;
  if (safeGpsMeters > 0) return { meters: safeGpsMeters, source: 'verified_gps' };
  return { meters: stepsToMeters(todaySteps), source: 'estimated_steps' };
}

// Purpose: Estimates active calories.
export function estimateActiveCalories(
  distanceMeters: number,
  caloriesPerKilometer = FALLBACK_ACTIVE_CALORIES_PER_KILOMETER,
) {
  const safeDistance = Number.isFinite(distanceMeters) ? Math.max(0, distanceMeters) : 0;
  const safeRate = Number.isFinite(caloriesPerKilometer)
    ? Math.max(0, caloriesPerKilometer)
    : FALLBACK_ACTIVE_CALORIES_PER_KILOMETER;
  return Math.round((safeDistance / 1_000) * safeRate);
}

// Purpose: Returns live mission progress.
export function getLiveMissionProgress(
  requirementType: string,
  serverProgress: number,
  target: number,
  activity: {
    todaySteps: number;
    missionEligibleSteps?: number;
    todayDistanceMeters: number;
  },
) {
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const safeServerProgress = Number.isFinite(serverProgress) ? Math.max(0, serverProgress) : 0;
  const liveProgress = requirementType === 'steps'
    ? Math.max(
      safeServerProgress,
      activity.missionEligibleSteps ?? activity.todaySteps,
    )
    : requirementType === 'distance'
      ? Math.max(safeServerProgress, activity.todayDistanceMeters)
      : safeServerProgress;
  return Math.min(safeTarget, Math.max(0, liveProgress));
}

// Purpose: Implements the reconcile persisted steps operation.
export function reconcilePersistedSteps(
  record: { userId?: string; localDate?: string; steps?: number } | null,
  userId: string,
  localDate: string,
) {
  if (!record || record.userId !== userId || record.localDate !== localDate) return 0;
  return clampDailySteps(record.steps ?? 0);
}
