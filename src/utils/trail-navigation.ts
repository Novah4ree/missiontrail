import type { TrailSearchCoordinate } from '../types/trails.ts';
import { calculateDistanceMeters } from './distance.ts';
import { getTrailDestinationCoordinate } from './trail-location.ts';
import { validateCoordinate } from './location-validation.ts';

export type ExternalNavigationPlatform = 'ios' | 'other';

const METERS_PER_MILE = 1_609.344;

type NavigableTrail = {
  id: string;
  name: string;
  latitude: unknown;
  longitude: unknown;
  trailheadLatitude?: unknown;
  trailheadLongitude?: unknown;
};

/**
 * Freezes one validated origin/destination pair for activity storage, logging,
 * distance, and external directions. Camera and ZIP coordinates are not inputs.
 */
export function createTrailNavigationPlan(
  trail: NavigableTrail,
  currentGpsCoordinate?: TrailSearchCoordinate | null,
) {
  if (!trail.id?.trim() || !trail.name?.trim()) return null;
  const destination = getTrailDestinationCoordinate(trail);
  if (!destination) return null;
  const origin = currentGpsCoordinate
    ? validateCoordinate(currentGpsCoordinate.latitude, currentGpsCoordinate.longitude)
    : null;

  return {
    trail: { id: trail.id, name: trail.name },
    origin,
    destination,
    distanceMiles: origin
      ? calculateDistanceMeters(origin, destination) / METERS_PER_MILE
      : null,
  };
}

/** Builds walking directions only from a validated selected-trail destination. */
export function getTrailNavigationUrl(
  platform: ExternalNavigationPlatform,
  trailName: string,
  destination: TrailSearchCoordinate,
  origin?: TrailSearchCoordinate | null,
) {
  const coordinate = validateCoordinate(destination.latitude, destination.longitude);
  if (!coordinate) return null;
  const validatedOrigin = origin
    ? validateCoordinate(origin.latitude, origin.longitude)
    : null;

  const coordinateValue = `${coordinate.latitude},${coordinate.longitude}`;
  if (platform === 'ios') {
    const originValue = validatedOrigin
      ? `&saddr=${validatedOrigin.latitude},${validatedOrigin.longitude}`
      : '';
    return `https://maps.apple.com/?daddr=${coordinateValue}${originValue}&q=${encodeURIComponent(trailName)}&dirflg=w`;
  }
  const originValue = validatedOrigin
    ? `&origin=${validatedOrigin.latitude},${validatedOrigin.longitude}`
    : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${coordinateValue}${originValue}&travelmode=walking&dir_action=navigate`;
}
