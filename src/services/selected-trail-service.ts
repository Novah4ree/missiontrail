import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Trail } from '@/types/trails';

const SELECTED_TRAIL_KEY = 'mission-trail:selected-trail:v1';

// The route parameter carries only an ID. The full normalized object stays in a
// small local handoff record instead of being placed in a navigation URL.
export async function saveSelectedTrail(trail: Trail) {
  await AsyncStorage.setItem(SELECTED_TRAIL_KEY, JSON.stringify(trail));
}

export async function loadSelectedTrail(trailId?: string) {
  const value = await AsyncStorage.getItem(SELECTED_TRAIL_KEY);
  if (!value) return null;
  try {
    const trail = JSON.parse(value) as Trail;
    return !trailId || trail.id === trailId ? trail : null;
  } catch {
    return null;
  }
}
