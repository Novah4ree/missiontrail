import {
  COMPANION_EGGS,
  getEggById,
} from './companion-eggs';

import {
  type Companion,
  type CompanionRarity,
  COMPANIONS,
} from './companions';

/**
 * Higher-tier eggs boost rarer companions more heavily.
 *
 * Standard eggs use rarityBoost = 1,
 * which preserves the original hatch odds.
 */
const RARITY_BOOST_POWER: Record<
  CompanionRarity,
  number
> = {
  Common: 0,
  Uncommon: 0,
  Rare: 1,
  Epic: 1.25,
  Legendary: 1.5,
  Mythic: 1.75,
};

// Purpose: Returns effective hatch weight.
function getEffectiveHatchWeight(
  companion: Companion,
  rarityBoost: number
) {
  const safeBoost = Math.max(
    1,
    rarityBoost
  );

  const power =
    RARITY_BOOST_POWER[
      companion.rarity
    ];

  return (
    companion.hatchWeight *
    Math.pow(
      safeBoost,
      power
    )
  );
}

/**
 * Get every companion allowed
 * to hatch from an egg.
 */
// Purpose: Returns egg hatch pool.
export function getEggHatchPool(
  eggId: string
): Companion[] {
  const egg =
    COMPANION_EGGS.find(
      (item) =>
        item.id === eggId
    );

  if (!egg) {
    console.warn(
      `[Egg Hatch] Egg not found: ${eggId}`
    );

    return [];
  }

  return egg.hatchPool
    .map((companionId) =>
      COMPANIONS.find(
        (companion) =>
          companion.id ===
          companionId
      )
    )
    .filter(
      (
        companion
      ): companion is Companion =>
        Boolean(companion)
    );
}

/**
 * Randomly hatch one companion.
 *
 * Each egg's rarityBoost modifies
 * Rare, Epic, Legendary and Mythic
 * odds without requiring separate
 * companion pools.
 */
// Purpose: Implements the hatch egg operation.
export function hatchEgg(
  eggId: string
): Companion | null {
  const egg =
    getEggById(eggId);

  if (!egg) {
    console.warn(
      `[Egg Hatch] Egg not found: ${eggId}`
    );

    return null;
  }

  const pool =
    getEggHatchPool(
      eggId
    );

  if (
    pool.length === 0
  ) {
    console.warn(
      `[Egg Hatch] No companions assigned to ${egg.name}`
    );

    return null;
  }

  const weightedPool =
    pool.map(
      (companion) => ({
        companion,

        weight:
          getEffectiveHatchWeight(
            companion,
            egg.rarityBoost
          ),
      })
    );

  const totalWeight =
    weightedPool.reduce(
      (
        total,
        entry
      ) =>
        total +
        entry.weight,
      0
    );

  let roll =
    Math.random() *
    totalWeight;

  for (
    const entry of
    weightedPool
  ) {
    roll -=
      entry.weight;

    if (roll <= 0) {
      return entry.companion;
    }
  }

  return (
    weightedPool[
      weightedPool.length -
        1
    ]?.companion ?? null
  );
}

/**
 * Useful for an Odds screen later.
 *
 * Returns the actual percentage
 * chance for each companion.
 */
// Purpose: Returns egg hatch odds.
export function getEggHatchOdds(
  eggId: string
) {
  const egg =
    getEggById(eggId);

  if (!egg) {
    return [];
  }

  const pool =
    getEggHatchPool(
      eggId
    );

  const weighted =
    pool.map(
      (companion) => ({
        companion,

        weight:
          getEffectiveHatchWeight(
            companion,
            egg.rarityBoost
          ),
      })
    );

  const totalWeight =
    weighted.reduce(
      (
        total,
        item
      ) =>
        total +
        item.weight,
      0
    );

  if (
    totalWeight <= 0
  ) {
    return [];
  }

  return weighted.map(
    ({
      companion,
      weight,
    }) => ({
      companionId:
        companion.id,

      name:
        companion.name,

      rarity:
        companion.rarity,

      percentage:
        Number(
          (
            (weight /
              totalWeight) *
            100
          ).toFixed(2)
        ),
    })
  );
}

// Purpose: Returns egg hatch progress.
export function getEggHatchProgress(
  eggId: string,
  distanceWalkedMiles: number
): number {
  const egg =
    getEggById(eggId);

  if (!egg) {
    return 0;
  }

  if (
    egg.hatchDistanceMiles <=
    0
  ) {
    return 1;
  }

  const progress =
    distanceWalkedMiles /
    egg.hatchDistanceMiles;

  return Math.min(
    Math.max(
      progress,
      0
    ),
    1
  );
}

// Purpose: Returns egg hatch percentage.
export function getEggHatchPercentage(
  eggId: string,
  distanceWalkedMiles: number
): number {
  return Math.round(
    getEggHatchProgress(
      eggId,
      distanceWalkedMiles
    ) * 100
  );
}

// Purpose: Determines whether is egg ready to hatch.
export function isEggReadyToHatch(
  eggId: string,
  distanceWalkedMiles: number
): boolean {
  return (
    getEggHatchProgress(
      eggId,
      distanceWalkedMiles
    ) >= 1
  );
}

// Purpose: Returns egg miles remaining.
export function getEggMilesRemaining(
  eggId: string,
  distanceWalkedMiles: number
): number {
  const egg =
    getEggById(eggId);

  if (!egg) {
    return 0;
  }

  return Math.max(
    egg.hatchDistanceMiles -
      distanceWalkedMiles,
    0
  );
}
