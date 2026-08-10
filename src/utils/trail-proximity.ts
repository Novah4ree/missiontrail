import type { ActiveTrailActivity, TrailSearchCoordinate } from '../types/trails.ts';
import { TRAILHEAD_PROXIMITY_RADIUS_METERS } from '../constants/trail-proximity.ts';
import { calculateDistanceMeters } from './distance.ts';
import { validateCoordinate } from './location-validation.ts';

export const NEARBY_TRAIL_RADIUS_METERS = 25 * 1_609.344;
export const ACTIVE_TRAIL_MAX_AGE_MS = 12 * 60 * 60 * 1_000;

export function isTrailNearUser(
  userLocation: TrailSearchCoordinate,
  trailLocation: TrailSearchCoordinate,
) {
  return calculateDistanceMeters(userLocation, trailLocation) <= NEARBY_TRAIL_RADIUS_METERS;
}

export function isWithinMissionStepRange(
  userLocation: TrailSearchCoordinate,
  destination: TrailSearchCoordinate,
  accuracyMeters = 0,
) {
  const user = validateCoordinate(userLocation.latitude, userLocation.longitude);
  const trailhead = validateCoordinate(destination.latitude, destination.longitude);
  if (!user || !trailhead || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) return false;

  // Accuracy is added conservatively so an imprecise fix cannot activate a
  // mission while the actual device may still be outside the configured radius.
  return calculateDistanceMeters(user, trailhead) + accuracyMeters
    <= TRAILHEAD_PROXIMITY_RADIUS_METERS;
}

export function formatTrailheadProximityRadius() {
  const miles = TRAILHEAD_PROXIMITY_RADIUS_METERS / 1_609.344;
  return miles < 0.1
    ? `${Math.round(TRAILHEAD_PROXIMITY_RADIUS_METERS * 3.28084)} ft`
    : `${miles.toFixed(2)} mi`;
}

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

export type ActiveTrailTransition = 'start' | 'resume' | 'conflict' | 'switch';

/** Decides a single-session transition without mutating permanent progress. */
export function getActiveTrailTransition(
  current: ActiveTrailActivity | null,
  nextTrailId: string,
  replaceExisting = false,
  now = new Date(),
): ActiveTrailTransition {
  if (!isActiveTrailCurrent(current, now)) return 'start';
  if (current?.trail.id === nextTrailId) return 'resume';
  return replaceExisting ? 'switch' : 'conflict';
}
