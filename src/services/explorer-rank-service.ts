// services/explorer-rank-service.ts

export type ExplorerRank = {
  level: number;
  name: string;
  fullName: string;
  tier: string;
  tierNumber: number;
  color: string;
};

const RANK_TIERS = [
  { name: 'Trail Rookie', color: '#94A3B8' },
  { name: 'Pathfinder', color: '#22C55E' },
  { name: 'Wildland Scout', color: '#10B981' },
  { name: 'Relic Seeker', color: '#22D3EE' },
  { name: 'Terrain Tracker', color: '#06B6D4' },
  { name: 'Mystic Wanderer', color: '#3B82F6' },
  { name: 'Frontier Guardian', color: '#6366F1' },
  { name: 'Shadow Voyager', color: '#8B5CF6' },
  { name: 'Cosmic Ranger', color: '#A855F7' },
  { name: 'Nebula Hunter', color: '#D946EF' },
  { name: 'Starborn Explorer', color: '#EC4899' },
  { name: 'Ancient Trailmaster', color: '#F97316' },
  { name: 'Realm Walker', color: '#F59E0B' },
  { name: 'World Breaker', color: '#EAB308' },
  { name: 'Celestial Pathfinder', color: '#FACC15' },
  { name: 'Mythic Voyager', color: '#EF4444' },
  { name: 'Eternal Guardian', color: '#FB7185' },
  { name: 'Legend of the Trails', color: '#FFFFFF' },
  { name: 'Dimension Walker', color: '#67E8F9' },
  { name: 'Infinite Explorer', color: '#FF3BDA' },
];

const DIVISION_NAMES = [
  'Initiate',
  'Rising',
  'Skilled',
  'Elite',
  'Master',
];

const LEVELS_PER_TIER = 50;
const LEVELS_PER_DIVISION = 10;

// Purpose: Returns explorer rank.
export function getExplorerRank(level: number): ExplorerRank {
  const safeLevel = Math.max(1, Math.floor(level));

  // Levels 1–1000 use the 20 main rank tiers.
  const tierIndex =
    Math.floor((safeLevel - 1) / LEVELS_PER_TIER) % RANK_TIERS.length;

  const tierCycle =
    Math.floor((safeLevel - 1) / (LEVELS_PER_TIER * RANK_TIERS.length)) + 1;

  const levelInsideTier =
    ((safeLevel - 1) % LEVELS_PER_TIER) + 1;

  const divisionIndex = Math.floor(
    (levelInsideTier - 1) / LEVELS_PER_DIVISION
  );

  const divisionLevel =
    ((levelInsideTier - 1) % LEVELS_PER_DIVISION) + 1;

  const tier = RANK_TIERS[tierIndex];
  const division = DIVISION_NAMES[divisionIndex];

  // Every level receives a different displayed name.
  const name =
    tierCycle === 1
      ? `${division} ${tier.name} ${divisionLevel}`
      : `${division} ${tier.name} Ascension ${tierCycle} • ${divisionLevel}`;

  return {
    level: safeLevel,
    name,
    fullName: `Level ${safeLevel} — ${name}`,
    tier: tier.name,
    tierNumber: tierCycle,
    color: tier.color,
  };
}

// Purpose: Returns next explorer rank.
export function getNextExplorerRank(level: number): ExplorerRank {
  return getExplorerRank(level + 1);
}

// Purpose: Generates explorer ranks.
export function generateExplorerRanks(
  totalLevels = 1000
): ExplorerRank[] {
  return Array.from({ length: totalLevels }, (_, index) =>
    getExplorerRank(index + 1)
  );
}