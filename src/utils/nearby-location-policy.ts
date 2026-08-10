import type { UserLocation } from '@/utils/location-transitions';

export type NearbyLocationAction = 'request_gps' | 'load_gps' | 'load_zip';

export function getNearbyLocationAction(
  activeLocation: UserLocation | null,
): NearbyLocationAction {
  if (activeLocation?.source === 'zip') return 'load_zip';
  if (activeLocation?.source === 'gps') return 'load_gps';
  return 'request_gps';
}

export function getActiveSearchCoordinate(activeLocation: UserLocation | null) {
  return activeLocation
    ? { latitude: activeLocation.latitude, longitude: activeLocation.longitude }
    : null;
}

export function getTrailAreaSummary({
  source,
  areaLabel,
  zipCode,
}: {
  source: UserLocation['source'];
  areaLabel: string | null;
  zipCode?: string;
}) {
  if (source === 'zip') {
    return zipCode ? `Search area: ${zipCode} · within 25 mi` : 'Location unavailable';
  }
  if (source === 'gps') {
    return areaLabel ? `${areaLabel} · within 25 mi` : 'Current location · within 25 mi';
  }
  return 'Location unavailable';
}
