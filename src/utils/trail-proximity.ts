import type { ActiveTrailActivity, TrailSearchCoordinate } from '../types/trails.ts';
import { calculateDistanceMeters } from './distance.ts';

export const NEARBY_TRAIL_RADIUS_METERS = 25 * 1_609.344;
export const MISSION_STEP_DESTINATION_RADIUS_METERS = 500;
export const ACTIVE_TRAIL_MAX_AGE_MS = 12 * 60 * 60 * 1_000;

// Purpose: Determines whether is trail near user.
export function isTrailNearUser(
  userLocation: TrailSearchCoordinate,
  trailLocation: TrailSearchCoordinate,
) {
  return calculateDistanceMeters(userLocation, trailLocation) <= NEARBY_TRAIL_RADIUS_METERS;
}

// Purpose: Determines whether is within mission step range.
export function isWithinMissionStepRange(
  userLocation: TrailSearchCoordinate,
  destination: TrailSearchCoordinate,
) {
  return calculateDistanceMeters(userLocation, destination)
    <= MISSION_STEP_DESTINATION_RADIUS_METERS;
}

// Purpose: Determines whether is active trail current.
export function isActiveTrailCurrent(
  activity: ActiveTrailActivity | null,
  now = new Date(),
) {
  if (!activity) return false;
  const startedAt = Date.parse(activity.startedAt);
  return Number.isFinite(startedAt)
    && startedAt <= now.getTime()
    && now.getTime() - startedAt <= ACTIVE_TRAIL_MAX_AGE_MS;
}
