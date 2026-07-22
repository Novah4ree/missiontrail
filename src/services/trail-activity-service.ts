import AsyncStorage from '@react-native-async-storage/async-storage';

import { getVerifiedDailyProgress } from '@/services/verified-distance';
import type { ActiveTrailActivity, NearbyTrail, TrailSearchCoordinate } from '@/types/trails';

const ACTIVE_TRAIL_KEY = 'mission-trail:active-trail:v1';

// Starting a trail records context for the Live Map. It does not grant distance;
// the existing GPS queue and Supabase validator remain responsible for progress.
export async function startTrailActivity(trail: NearbyTrail, startCoordinate: TrailSearchCoordinate) {
  const activity: ActiveTrailActivity = { trail, startCoordinate, startedAt: new Date().toISOString() };
  await AsyncStorage.setItem(ACTIVE_TRAIL_KEY, JSON.stringify(activity));
  await getVerifiedDailyProgress().catch(() => null);
  return activity;
}

export async function loadActiveTrailActivity() {
  const value = await AsyncStorage.getItem(ACTIVE_TRAIL_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as ActiveTrailActivity;
  } catch {
    return null;
  }
}

