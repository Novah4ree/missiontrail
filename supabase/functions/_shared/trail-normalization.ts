export const METERS_PER_MILE = 1_609.344;
const FEET_PER_METER = 3.280839895;
const EARTH_RADIUS_METERS = 6_371_000;

type Coordinate = { latitude: number; longitude: number };

type GeoapifyPlaceProperties = {
  place_id?: string;
  name?: string;
  lat?: number;
  lon?: number;
  distance?: number;
  categories?: string[];
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  description?: string;
  wheelchair?: string;
  datasource?: { raw?: Record<string, unknown> };
};

export type GeoapifyPlaceFeature = {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: GeoapifyPlaceProperties;
};

export type NormalizedTrail = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  category: 'trail' | 'trailhead' | 'park' | 'nature_reserve' | 'walking_path';
  address?: string;
  description?: string;
  accessibility?: string;
  difficulty: 'easy' | 'moderate' | 'challenging' | 'unknown';
  source: 'geoapify';
};

function radians(value: number) {
  return value * Math.PI / 180;
}

export function distanceMeters(from: Coordinate, to: Coordinate) {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const startLatitude = radians(from.latitude);
  const endLatitude = radians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function readString(raw: Record<string, unknown>, key: string) {
  const value = raw[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function categoryFrom(categories: string[], raw: Record<string, unknown>): NormalizedTrail['category'] {
  const information = readString(raw, 'information');
  if (information === 'trailhead' || categories.some((value) => value.includes('ranger_station'))) {
    return 'trailhead';
  }
  if (categories.some((value) => value.includes('nature_reserve') || value === 'natural.protected_area' || value === 'national_park')) {
    return 'nature_reserve';
  }
  if (categories.some((value) => value.startsWith('leisure.park'))) return 'park';
  if (categories.some((value) => value === 'highway.footway')) return 'walking_path';
  return 'trail';
}

// Difficulty is returned only when OpenStreetMap supplied an explicit hiking
// grade. We never infer it from route length, terrain, or a place category.
function difficultyFrom(raw: Record<string, unknown>): NormalizedTrail['difficulty'] {
  const explicit = readString(raw, 'difficulty')?.toLowerCase();
  if (explicit === 'easy' || explicit === 'moderate' || explicit === 'challenging') return explicit;
  const sacScale = readString(raw, 'sac_scale')?.toLowerCase();
  if (!sacScale) return 'unknown';
  if (sacScale === 'hiking') return 'easy';
  if (sacScale === 'mountain_hiking' || sacScale === 'demanding_mountain_hiking') return 'moderate';
  if (['alpine_hiking', 'demanding_alpine_hiking', 'difficult_alpine_hiking'].includes(sacScale)) {
    return 'challenging';
  }
  return 'unknown';
}

export function normalizeGeoapifyPlaces(features: GeoapifyPlaceFeature[], origin: Coordinate) {
  const seen = new Set<string>();
  const trails: NormalizedTrail[] = [];

  for (const feature of features) {
    const properties = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates;
    const longitude = properties.lon ?? (Array.isArray(coordinates) ? coordinates[0] : undefined);
    const latitude = properties.lat ?? (Array.isArray(coordinates) ? coordinates[1] : undefined);
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const raw = properties.datasource?.raw ?? {};
    const categories = Array.isArray(properties.categories) ? properties.categories : [];
    const id = properties.place_id ?? `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const rawName = readString(raw, 'name');
    const address = properties.formatted || [properties.address_line1, properties.address_line2].filter(Boolean).join(', ') || undefined;
    const wheelchair = properties.wheelchair ?? readString(raw, 'wheelchair');
    trails.push({
      id,
      name: properties.name?.trim() || rawName || categoryLabel(categoryFrom(categories, raw)),
      latitude,
      longitude,
      distanceMiles: distanceMeters(origin, { latitude, longitude }) / METERS_PER_MILE,
      category: categoryFrom(categories, raw),
      address,
      description: properties.description ?? readString(raw, 'description'),
      accessibility: wheelchair ? `Wheelchair access: ${wheelchair}` : undefined,
      difficulty: difficultyFrom(raw),
      source: 'geoapify',
    });
  }

  return trails.sort((left, right) => left.distanceMiles - right.distanceMiles);
}

function categoryLabel(category: NormalizedTrail['category']) {
  return ({
    trail: 'Unnamed Trail',
    trailhead: 'Trailhead',
    park: 'Park',
    nature_reserve: 'Nature Reserve',
    walking_path: 'Walking Path',
  } as const)[category];
}

type GeoapifyRouteFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    distance?: number;
    time?: number;
    legs?: { elevation?: number[]; elevation_range?: [number, number][] }[];
  };
};

function flattenRouteCoordinates(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [value as number[]];
  }
  return value.flatMap(flattenRouteCoordinates);
}

// Geoapify can attach elevation as a third coordinate. Elevation gain is shown
// only when those measured values are actually present in the response.
export function normalizeGeoapifyRoute(feature: GeoapifyRouteFeature) {
  const points = flattenRouteCoordinates(feature.geometry?.coordinates);
  const geometry = points
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map((point) => [point[0], point[1]] as [number, number]);
  if (geometry.length < 2) throw new Error('ROUTE_GEOMETRY_UNAVAILABLE');

  const legElevations = feature.properties?.legs?.flatMap((leg) =>
    Array.isArray(leg.elevation)
      ? leg.elevation
      : Array.isArray(leg.elevation_range)
        ? leg.elevation_range.map((entry) => entry[1])
        : [],
  ) ?? [];
  const coordinateElevations = points.map((point) => point[2]).filter((value): value is number => Number.isFinite(value));
  const elevations = legElevations.length > 1 ? legElevations : coordinateElevations;
  let elevationGainFeet: number | undefined;
  if (elevations.length > 1) {
    const gainMeters = elevations.slice(1).reduce(
      (total, elevation, index) => total + Math.max(0, elevation - elevations[index]),
      0,
    );
    elevationGainFeet = gainMeters * FEET_PER_METER;
  }

  return {
    distanceMiles: (feature.properties?.distance ?? 0) / METERS_PER_MILE,
    durationMinutes: (feature.properties?.time ?? 0) / 60,
    elevationGainFeet,
    geometry: { type: 'LineString' as const, coordinates: geometry },
  };
}
