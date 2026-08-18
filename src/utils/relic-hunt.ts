import type { RelicProximityStatus } from '@/types/relic-proximity';

export type RelicHuntStage =
  | 'SEARCHING'
  | 'FAR'
  | 'CLOSING_IN'
  | 'NEARBY'
  | 'VERY_CLOSE'
  | 'SIGNAL_LOCKED'
  | 'FOUND';

const STAGE_RANK: Record<RelicHuntStage, number> = {
  SEARCHING: 0,
  FAR: 1,
  CLOSING_IN: 2,
  NEARBY: 3,
  VERY_CLOSE: 4,
  SIGNAL_LOCKED: 5,
  FOUND: 6,
};

const FALLBACK_RELEASE_FEET: Partial<Record<RelicHuntStage, number>> = {
  SIGNAL_LOCKED: 40,
  VERY_CLOSE: 115,
  NEARBY: 340,
  CLOSING_IN: 1_100,
};

// Purpose: Returns relic hunt stage.
export function getRelicHuntStage(
  distanceFeet: number | null,
  serverStatus: RelicProximityStatus,
): RelicHuntStage {
  if (
    serverStatus === 'revealed' ||
    serverStatus === 'collected' ||
    serverStatus === 'already_collected'
  ) {
    return 'FOUND';
  }
  if (distanceFeet === null || !Number.isFinite(distanceFeet)) return 'SEARCHING';
  if (distanceFeet <= 30) return 'SIGNAL_LOCKED';
  if (distanceFeet <= 100) return 'VERY_CLOSE';
  if (distanceFeet <= 300) return 'NEARBY';
  if (distanceFeet <= 1_000) return 'CLOSING_IN';
  return 'FAR';
}

// Purpose: Determines whether is closer hunt stage.
export function isCloserHuntStage(
  current: RelicHuntStage,
  candidate: RelicHuntStage,
) {
  return STAGE_RANK[candidate] > STAGE_RANK[current];
}

// Purpose: Determines whether is farther hunt stage.
export function isFartherHuntStage(
  current: RelicHuntStage,
  candidate: RelicHuntStage,
) {
  return STAGE_RANK[candidate] < STAGE_RANK[current];
}

// Purpose: Determines whether has crossed hunt fallback margin.
export function hasCrossedHuntFallbackMargin(
  current: RelicHuntStage,
  distanceFeet: number | null,
) {
  if (distanceFeet === null) return false;
  const releaseDistance = FALLBACK_RELEASE_FEET[current];
  return releaseDistance !== undefined && distanceFeet > releaseDistance;
}

// Purpose: Returns relic hunt intensity.
export function getRelicHuntIntensity(stage: RelicHuntStage) {
  return ({
    SEARCHING: 0,
    FAR: 1,
    CLOSING_IN: 2,
    NEARBY: 3,
    VERY_CLOSE: 4,
    SIGNAL_LOCKED: 5,
    FOUND: 5,
  } as const)[stage];
}

// Purpose: Returns relic hunt instruction.
export function getRelicHuntInstruction(
  stage: RelicHuntStage,
  direction: string | null,
) {
  const heading = direction ? `HEAD ${direction}` : 'FOLLOW THE SIGNAL';
  return ({
    SEARCHING: 'SCANNING FOR A STABLE SIGNAL',
    FAR: heading,
    CLOSING_IN: heading,
    NEARBY: 'KEEP GOING',
    VERY_CLOSE: 'SIGNAL GETTING STRONGER',
    SIGNAL_LOCKED: 'RELIC ENERGY DETECTED',
    FOUND: 'RELIC FOUND',
  } as const)[stage];
}
