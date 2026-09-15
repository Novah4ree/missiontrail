// ============================================================
// MISSION TRAILS - INFINITE FOOD SORT LEVEL GENERATOR
// ============================================================
// Purpose:
// Creates Food Sort levels forever from the level number.
//
// No manually coded Level 1, Level 2, Level 3, etc.
// The same system can generate Level 10,000 and beyond.
// ============================================================

import type {
  FoodSortFoodId,
} from '@/utils/food-sort-game';


export type FoodSortLevelGoal = {
  foodId: FoodSortFoodId;
  target: number;
};


export type FoodSortLevelDefinition = {
  level: number;
  name: string;
  moves: number;
  goals: FoodSortLevelGoal[];
  difficultyTier: number;

  // Saved now so the same generator can control
  // future ice, rocks, vines, slime, eggs, and relics.
  obstacleBudget: number;

  bossLevel: boolean;
};


// Foods rotate so every level does not ask for
// the exact same three foods.
const FOOD_ROTATION:
  FoodSortFoodId[] = [
    'carrot',
    'meal',
    'treat',
    'berry',
    'drink',
  ];


// Purpose: Returns the themed difficulty name
// for a Food Sort level.
function getFoodSortLevelName(
  level: number,
) {
  if (level >= 1000) {
    return 'Infinite Kitchen';
  }

  if (level >= 500) {
    return 'Cosmic Feast';
  }

  if (level >= 250) {
    return 'Egg Rush';
  }

  if (level >= 100) {
    return 'Relic Kitchen';
  }

  if (level >= 50) {
    return 'Wild Feast';
  }

  if (level >= 25) {
    return 'Power Picnic';
  }

  if (level >= 10) {
    return 'Hungry Hike';
  }

  return 'Trail Snacks';
}


// Purpose: Picks a food from the rotating
// food list while wrapping around safely.
function rotatedFood(
  position: number,
): FoodSortFoodId {
  const safeIndex =
    (
      position %
      FOOD_ROTATION.length +
      FOOD_ROTATION.length
    ) %
    FOOD_ROTATION.length;

  return FOOD_ROTATION[
    safeIndex
  ];
}


// Purpose: Creates one unlimited Food Sort level.
//
// Difficulty increases forever, but slowly enough
// that high levels do not become mathematically silly.
export function createFoodSortLevel(
  requestedLevel: number,
): FoodSortLevelDefinition {
  const level =
    Math.max(
      1,
      Math.floor(
        Number.isFinite(
          requestedLevel,
        )
          ? requestedLevel
          : 1,
      ),
    );


  // Every 10th level acts like a harder checkpoint.
  const bossLevel =
    level % 10 === 0;


  // Difficulty tier keeps increasing forever.
  const difficultyTier =
    Math.floor(
      (level - 1) / 10,
    ) + 1;


  // Moves gradually decrease but NEVER below 15.
  //
  // Level 1:   20
  // Level 76:  19
  // Level 151: 18
  // Level 226: 17
  // Level 301: 16
  // Level 376+:15
  const moves =
    Math.max(
      15,
      20 -
        Math.floor(
          (level - 1) / 75,
        ),
    );


  // Logarithmic growth means targets keep increasing
  // forever without exploding into impossible numbers.
  const targetGrowth =
    Math.floor(
      Math.log2(
        level,
      ) * 2,
    );


  const checkpointBonus =
    bossLevel
      ? 3
      : 0;


  const rotationStart =
    (level - 1) %
    FOOD_ROTATION.length;


  const goals:
    FoodSortLevelGoal[] = [
      {
        foodId:
          rotatedFood(
            rotationStart,
          ),

        target:
          8 +
          targetGrowth +
          checkpointBonus,
      },

      {
        foodId:
          rotatedFood(
            rotationStart + 1,
          ),

        target:
          7 +
          targetGrowth +
          checkpointBonus,
      },

      {
        foodId:
          rotatedFood(
            rotationStart + 2,
          ),

        target:
          6 +
          targetGrowth +
          checkpointBonus,
      },
    ];


  // This will control obstacles in our next upgrade.
  //
  // Level 1 = 0
  // Higher levels gradually gain more blockers.
  const obstacleBudget =
    Math.min(
      20,
      Math.floor(
        level / 15,
      ),
    );


  return {
    level,

    name:
      getFoodSortLevelName(
        level,
      ),

    moves,

    goals,

    difficultyTier,

    obstacleBudget,

    bossLevel,
  };
}
