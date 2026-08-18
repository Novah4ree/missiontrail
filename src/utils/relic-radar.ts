import type { NearbyRelicSignal } from '@/types/relic-proximity';
import { getRelicHuntStage } from './relic-hunt.ts';

const FEET_PER_MILE = 5_280;

export type RelicSignalStage =
  | 'FAR'
  | 'CLOSING IN'
  | 'NEARBY'
  | 'VERY CLOSE'
  | 'SIGNAL LOCKED';

// Purpose: Formats relic signal distance.
export function formatRelicSignalDistance(distanceFeet: number) {
  const safeFeet = Math.max(0, Math.round(distanceFeet));
  if (safeFeet < 1_000) return `${safeFeet.toLocaleString()} FT`;
  return `${(safeFeet / FEET_PER_MILE).toFixed(1)} MI`;
}

// Purpose: Returns relic signal stage.
export function getRelicSignalStage(distanceFeet: number): RelicSignalStage {
  const stage = getRelicHuntStage(distanceFeet, 'approaching');
  return stage.replaceAll('_', ' ') as RelicSignalStage;
}

// Purpose: Returns radar refresh policy.
export function getRadarRefreshPolicy(distanceFeet: number | null) {
  if (distanceFeet === null || distanceFeet > 1_000) {
    return { intervalMs: 25_000, movementMeters: 25 };
  }
  if (distanceFeet > 300) return { intervalMs: 18_000, movementMeters: 15 };
  if (distanceFeet > 100) return { intervalMs: 12_000, movementMeters: 8 };
  if (distanceFeet > 30) return { intervalMs: 10_000, movementMeters: 5 };
  return { intervalMs: 8_000, movementMeters: 3 };
}

// Purpose: Selects the closest available radar signal without using list position as identity.
export function getNearestAvailableRelicSignal(signals: NearbyRelicSignal[]) {
  return signals.reduce<NearbyRelicSignal | null>((nearest, signal) => {
    if (signal.availability !== 'available') return nearest;
    if (!nearest || signal.distanceFeet < nearest.distanceFeet) return signal;
    return nearest;
  }, null);
}

// Purpose: Implements the describe relic signal operation.
export function describeRelicSignal(signal: NearbyRelicSignal) {
  const identity = signal.availability === 'locked'
    ? 'Locked unknown relic'
    : signal.encounterType === 'ambient'
      ? 'Ambient unknown relic'
      : 'Unknown relic';
  const distance = formatRelicSignalDistance(signal.distanceFeet)
    .toLowerCase()
    .replace('ft', 'feet')
    .replace('mi', 'miles');
  const stage = signal.availability === 'locked'
    ? 'locked'
    : getRelicSignalStage(signal.distanceFeet).toLowerCase();
  const directionNames: Record<string, string> = {
    N: 'north', NE: 'northeast', E: 'east', SE: 'southeast',
    S: 'south', SW: 'southwest', W: 'west', NW: 'northwest',
  };
  const direction = signal.encounterType === 'ambient' || !signal.direction
    ? 'all around you'
    : directionNames[signal.direction] ?? signal.direction;
  return `${identity}, ${distance}, ${direction}, ${stage}.`;
}
