import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Trail } from '@/types/trails';
import { getTrailDestinationCoordinate } from '@/utils/trail-location';

const SELECTED_TRAIL_KEY = 'mission-trail:selected-trail:v1';

// The route parameter carries only an ID. The full normalized object stays in a
// small local handoff record instead of being placed in a navigation URL.
export async function saveSelectedTrail(trail: Trail) {
  if (!trail.id?.trim() || !getTrailDestinationCoordinate(trail)) {
    throw new Error('The selected trail identity or coordinates are invalid.');
  }
  await AsyncStorage.setItem(SELECTED_TRAIL_KEY, JSON.stringify(trail));
}

export async function loadSelectedTrail(trailId?: string) {
  const value = await AsyncStorage.getItem(SELECTED_TRAIL_KEY);
  if (!value) return null;
  try {
    const trail = JSON.parse(value) as Trail;
    return (
      typeof trail.id === 'string'
      && trail.id.trim().length > 0
      && (!trailId || trail.id === trailId)
      && getTrailDestinationCoordinate(trail)
    ) ? trail : null;
  } catch {
    return null;
  }
}

/** Clears the navigation handoff only when it still belongs to this session. */
export async function clearSelectedTrail(expectedTrailId: string) {
  const value = await AsyncStorage.getItem(SELECTED_TRAIL_KEY);
  if (!value) return false;
  try {
    const trail = JSON.parse(value) as Trail;
    if (trail.id !== expectedTrailId) return false;
    await AsyncStorage.removeItem(SELECTED_TRAIL_KEY);
    return true;
  } catch {
    await AsyncStorage.removeItem(SELECTED_TRAIL_KEY);
    return true;
  }
}
