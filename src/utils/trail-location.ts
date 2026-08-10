import type { GeoJsonLineString, TrailSearchCoordinate } from '../types/trails.ts';
import { calculateDistanceMeters } from './distance.ts';
import { validateCoordinate } from './location-validation.ts';

const METERS_PER_MILE = 1_609.344;

type TrailDestination = {
  latitude: unknown;
  longitude: unknown;
  trailheadLatitude?: unknown;
  trailheadLongitude?: unknown;
};

/** Uses explicit trailhead coordinates when present, then the trail's own point. */
export function getTrailDestinationCoordinate(trail: TrailDestination) {
  const trailhead = validateCoordinate(trail.trailheadLatitude, trail.trailheadLongitude);
  if (trailhead) return trailhead;
  return validateCoordinate(trail.latitude, trail.longitude);
}

/** Rejects an entire line when any point is malformed rather than drawing a false connection. */
export function getValidLineCoordinates(geometry?: GeoJsonLineString): TrailSearchCoordinate[] {
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return [];

  const coordinates: TrailSearchCoordinate[] = [];
  for (const point of geometry.coordinates) {
    if (!Array.isArray(point) || point.length < 2) return [];
    const coordinate = validateCoordinate(point[1], point[0]);
    if (!coordinate) return [];
    coordinates.push(coordinate);
  }
  return coordinates.length >= 2 ? coordinates : [];
}

/** Calculates length only from a complete, ordered provider trail line. */
export function calculateTrailGeometryLengthMiles(geometry?: GeoJsonLineString) {
  const coordinates = getValidLineCoordinates(geometry);
  if (coordinates.length < 2) return null;

  const meters = coordinates.slice(1).reduce(
    (total, coordinate, index) => total + calculateDistanceMeters(coordinates[index], coordinate),
    0,
  );
  return Number.isFinite(meters) && meters > 0 ? meters / METERS_PER_MILE : null;
}
