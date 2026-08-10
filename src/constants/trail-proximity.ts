const DEFAULT_TRAILHEAD_PROXIMITY_RADIUS_METERS = 500;

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * One configurable threshold for trailhead mission-step activation.
 * Expo inlines statically referenced EXPO_PUBLIC_ variables at build time.
 */
export const TRAILHEAD_PROXIMITY_RADIUS_METERS = positiveNumber(
  process.env.EXPO_PUBLIC_TRAILHEAD_PROXIMITY_RADIUS_METERS,
  DEFAULT_TRAILHEAD_PROXIMITY_RADIUS_METERS,
);
