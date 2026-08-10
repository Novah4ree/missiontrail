import AsyncStorage from '@react-native-async-storage/async-storage';

import { getVerifiedDailyProgress } from '@/services/verified-distance';
import { clearSelectedTrail } from '@/services/selected-trail-service';
import type { ActiveTrailActivity, NearbyTrail, TrailSearchCoordinate } from '@/types/trails';
import { getTrailDestinationCoordinate } from '@/utils/trail-location';
import { validateCoordinate } from '@/utils/location-validation';
import { getActiveTrailTransition } from '@/utils/trail-proximity';

const ACTIVE_TRAIL_KEY = 'mission-trail:active-trail:v1';
const activityListeners = new Set<(activity: ActiveTrailActivity | null) => void>();
let activityMutationQueue: Promise<void> = Promise.resolve();

export class ActiveTrailConflictError extends Error {
  constructor(public readonly activeActivity: ActiveTrailActivity) {
    super(`${activeActivity.trail.name} is already the active trail.`);
    this.name = 'ActiveTrailConflictError';
  }
}

function serializeActivityMutation<T>(operation: () => Promise<T>) {
  const result = activityMutationQueue.then(operation, operation);
  activityMutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

// Starting a trail records context for the Live Map. It does not grant distance;
// the existing GPS queue and Supabase validator remain responsible for progress.
export async function startTrailActivity(
  trail: NearbyTrail,
  startCoordinate?: TrailSearchCoordinate,
  userId?: string,
  options: { replaceExisting?: boolean } = {},
) {
  const destination = getTrailDestinationCoordinate(trail);
  if (!trail.id?.trim() || !destination) {
    throw new Error('Trail activity requires a valid selected trail and trailhead coordinates.');
  }
  const validatedStart = startCoordinate
    ? validateCoordinate(startCoordinate.latitude, startCoordinate.longitude)
    : null;
  return serializeActivityMutation(async () => {
    const existing = await loadActiveTrailActivity();
    const transition = getActiveTrailTransition(existing, trail.id, options.replaceExisting);
    if (existing && transition === 'conflict') {
      throw new ActiveTrailConflictError(existing);
    }
    if (existing && transition === 'resume') return existing;

    const activity: ActiveTrailActivity = {
      trail: { ...trail, ...destination },
      ...(validatedStart ? { startCoordinate: validatedStart } : {}),
      startedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(ACTIVE_TRAIL_KEY, JSON.stringify(activity));
    activityListeners.forEach((listener) => listener(activity));
    if (userId) await getVerifiedDailyProgress(userId).catch(() => null);
    return activity;
  });
}

/** Ends only the expected active session; permanent progress is untouched. */
export async function cancelActiveTrail(expectedTrailId?: string) {
  return serializeActivityMutation(async () => {
    const existing = await loadActiveTrailActivity();
    if (!existing || (expectedTrailId && existing.trail.id !== expectedTrailId)) return false;
    await AsyncStorage.removeItem(ACTIVE_TRAIL_KEY);
    await clearSelectedTrail(existing.trail.id).catch((clearError: unknown) => {
      if (__DEV__) console.warn('[Trail activity] Selected-trail handoff cleanup failed.', clearError);
    });
    activityListeners.forEach((listener) => listener(null));
    return true;
  });
}

export function subscribeToActiveTrailActivity(
  listener: (activity: ActiveTrailActivity | null) => void,
) {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}

export async function loadActiveTrailActivity() {
  const value = await AsyncStorage.getItem(ACTIVE_TRAIL_KEY);
  if (!value) return null;
  try {
    const activity = JSON.parse(value) as ActiveTrailActivity;
    if (
      !activity
      || typeof activity.startedAt !== 'string'
      || typeof activity.trail?.id !== 'string'
      || !activity.trail.id.trim()
      || !getTrailDestinationCoordinate(activity.trail)
    ) return null;
    return activity;
  } catch {
    return null;
  }
}
