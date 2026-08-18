import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ActiveTrailActivity, NearbyTrail, TrailSearchCoordinate } from '@/types/trails';

const ACTIVE_TRAIL_KEY = 'mission-trail:active-trail:v1';
const activityListeners = new Set<(activity: ActiveTrailActivity | null) => void>();

// Starting a trail records context for the Live Map. It does not grant distance;
// the existing GPS queue and Supabase validator remain responsible for progress.
// Purpose: Starts trail activity.
export async function startTrailActivity(
  trail: NearbyTrail,
  startCoordinate?: TrailSearchCoordinate,
  _userId?: string,
) {
  const activity: ActiveTrailActivity = {
    trail,
    ...(startCoordinate ? { startCoordinate } : {}),
    startedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(ACTIVE_TRAIL_KEY, JSON.stringify(activity));
  activityListeners.forEach((listener) => listener(activity));
  return activity;
}

// Purpose: Subscribes to to active trail activity.
export function subscribeToActiveTrailActivity(
  listener: (activity: ActiveTrailActivity | null) => void,
) {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}

// Purpose: Loads active trail activity.
export async function loadActiveTrailActivity() {
  const value = await AsyncStorage.getItem(ACTIVE_TRAIL_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as ActiveTrailActivity;
  } catch {
    return null;
  }
}
