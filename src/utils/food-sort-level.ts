// ============================================================
// MISSION TRAILS - COMPANION FOOD SORT LEVELS
// ============================================================
// Thirty authored difficulty blueprints are expanded by one
// reusable factory. Replays can rotate equivalent food targets
// without ever asking for a food that is absent from the board.
// ============================================================

import {
  FOOD_SORT_FOOD_IDS,
  type FoodSortFoodId,
} from '@/utils/food-sort-game';

export type FoodSortCategory =
  | 'treats'
  | 'quickEnergy'
  | 'fruit'
  | 'recovery'
  | 'protein';

type FoodSortCategoryDefinition = {
  foodId: FoodSortFoodId;
  label: string;
  singularLabel: string;
};

export const FOOD_SORT_CATEGORIES: Record<
  FoodSortCategory,
  FoodSortCategoryDefinition
> = {
  treats: { foodId: 'treat', label: 'Treats', singularLabel: 'Treat' },
  quickEnergy: { foodId: 'carrot', label: 'Quick Energy', singularLabel: 'Quick Energy food' },
  fruit: { foodId: 'berry', label: 'Fruit', singularLabel: 'Fruit' },
  recovery: { foodId: 'drink', label: 'Recovery', singularLabel: 'Recovery drink' },
  protein: { foodId: 'meal', label: 'Protein', singularLabel: 'Protein food' },
};

const CATEGORY_ROTATION: FoodSortCategory[] = [
  'quickEnergy',
  'protein',
  'fruit',
  'recovery',
  'treats',
];

export type FoodSortLevelGoal = {
  category: FoodSortCategory;
  foodId: FoodSortFoodId;
  label: string;
  target: number;
};

export type FoodSortLevelDefinition = {
  level: number;
  name: string;
  difficultyLabel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  difficultyTier: number;
  timeLimit: number;
  speedMultiplier: number;
  allowedMistakes: number;
  moves: number;
  scoreTarget?: number;
  sortTarget?: number;
  comboTarget?: number;
  foodTargets: FoodSortLevelGoal[];
  goals: FoodSortLevelGoal[];
  activeFoodIds: FoodSortFoodId[];
  distractorCount: number;
  obstacleBudget: number;
  bossLevel: boolean;
  rareFoodRequired: boolean;
  spawnWeights: Partial<
    Record<FoodSortFoodId, number>
  >;
  goalSummary: string;
};

type CompactGoal = readonly [categoryOffset: number, amount: number];

type LevelBlueprint = {
  time: number;
  mistakes: number;
  speed: number;
  moves: number;
  foods: number;
  goals?: readonly CompactGoal[];
  score?: number;
  sorted?: number;
  combo?: number;
  rare?: boolean;
};

// categoryOffset rotates on replay. This gives a level controlled
// variety while preserving the same number and size of objectives.
const LEVEL_BLUEPRINTS: readonly LevelBlueprint[] = [
  { time: 100, mistakes: 6, speed: 0.78, moves: 20, foods: 3, goals: [[0, 5]] },
  { time: 96, mistakes: 6, speed: 0.80, moves: 20, foods: 3, goals: [[1, 5]] },
  { time: 92, mistakes: 6, speed: 0.83, moves: 20, foods: 3, sorted: 10 },
  { time: 88, mistakes: 5, speed: 0.86, moves: 20, foods: 3, goals: [[2, 4], [0, 4]] },
  { time: 84, mistakes: 5, speed: 0.90, moves: 20, foods: 3, goals: [[1, 6]], sorted: 12 },
  { time: 82, mistakes: 5, speed: 0.94, moves: 20, foods: 4, goals: [[0, 5], [1, 3]] },
  { time: 80, mistakes: 5, speed: 0.97, moves: 20, foods: 4, goals: [[2, 4], [3, 4]] },
  { time: 78, mistakes: 4, speed: 1.00, moves: 20, foods: 4, sorted: 16, score: 300 },
  { time: 75, mistakes: 4, speed: 1.03, moves: 19, foods: 4, goals: [[1, 5], [4, 3]], score: 350 },
  { time: 72, mistakes: 4, speed: 1.06, moves: 19, foods: 4, goals: [[0, 5], [2, 5]], score: 400 },
  { time: 72, mistakes: 4, speed: 1.09, moves: 19, foods: 4, goals: [[1, 6], [3, 4]], score: 450 },
  { time: 70, mistakes: 4, speed: 1.12, moves: 19, foods: 4, sorted: 20, score: 500, combo: 2 },
  { time: 68, mistakes: 4, speed: 1.15, moves: 19, foods: 5, goals: [[0, 6], [2, 5]], score: 550 },
  { time: 67, mistakes: 3, speed: 1.18, moves: 19, foods: 5, goals: [[1, 6], [4, 4]], score: 600 },
  { time: 66, mistakes: 3, speed: 1.21, moves: 18, foods: 5, goals: [[0, 5], [1, 5], [2, 4]], score: 650 },
  { time: 64, mistakes: 3, speed: 1.24, moves: 18, foods: 5, sorted: 24, score: 700, combo: 3 },
  { time: 63, mistakes: 3, speed: 1.27, moves: 18, foods: 5, goals: [[1, 7], [3, 5]], score: 750 },
  { time: 62, mistakes: 3, speed: 1.30, moves: 18, foods: 5, goals: [[0, 6], [2, 6], [4, 3]], score: 800 },
  { time: 60, mistakes: 3, speed: 1.33, moves: 18, foods: 5, goals: [[1, 7], [2, 7]], score: 850 },
  { time: 58, mistakes: 3, speed: 1.36, moves: 18, foods: 5, sorted: 28, score: 900, combo: 3 },
  { time: 58, mistakes: 3, speed: 1.39, moves: 17, foods: 5, goals: [[0, 7], [1, 6], [3, 4]], score: 900 },
  { time: 56, mistakes: 3, speed: 1.42, moves: 17, foods: 5, goals: [[1, 7], [2, 7], [4, 4]], score: 950 },
  { time: 55, mistakes: 2, speed: 1.45, moves: 17, foods: 5, sorted: 30, score: 1000, combo: 3 },
  { time: 54, mistakes: 2, speed: 1.48, moves: 17, foods: 5, goals: [[0, 8], [2, 7], [3, 5]], score: 1050 },
  { time: 52, mistakes: 2, speed: 1.51, moves: 17, foods: 5, goals: [[4, 6], [1, 7]], score: 1100, rare: true },
  { time: 51, mistakes: 2, speed: 1.54, moves: 16, foods: 5, goals: [[0, 8], [1, 8], [2, 5]], score: 1100 },
  { time: 49, mistakes: 2, speed: 1.57, moves: 16, foods: 5, sorted: 34, score: 1150, combo: 4 },
  { time: 47, mistakes: 2, speed: 1.60, moves: 16, foods: 5, goals: [[1, 8], [2, 8], [3, 6]], score: 1200 },
  { time: 45, mistakes: 2, speed: 1.63, moves: 16, foods: 5, goals: [[0, 8], [1, 8], [4, 6]], score: 1250, rare: true },
  { time: 44, mistakes: 1, speed: 1.66, moves: 16, foods: 5, goals: [[0, 9], [1, 9], [2, 7]], score: 1300, combo: 5, rare: true },
] as const;

function normalizeLevel(requestedLevel: number) {
  return Math.max(
    1,
    Math.floor(Number.isFinite(requestedLevel) ? requestedLevel : 1),
  );
}

function categoryAt(position: number) {
  const index = (
    position % CATEGORY_ROTATION.length + CATEGORY_ROTATION.length
  ) % CATEGORY_ROTATION.length;
  return CATEGORY_ROTATION[index];
}

function getDifficulty(level: number) {
  if (level <= 5) {
    return { label: 'Beginner' as const, tier: 1, name: 'Trail Snacks' };
  }
  if (level <= 10) {
    return { label: 'Intermediate' as const, tier: 2, name: 'Mixed Picnic' };
  }
  if (level <= 20) {
    return { label: 'Advanced' as const, tier: 3, name: 'Hungry Hike' };
  }
  return { label: 'Expert' as const, tier: 4, name: 'Cosmic Feast' };
}

function formatGoalSummary(
  foodTargets: FoodSortLevelGoal[],
  sortTarget?: number,
  scoreTarget?: number,
  comboTarget?: number,
  rareFoodRequired = false,
) {
  const foodParts = foodTargets.map(goal =>
    `${goal.target} ${rareFoodRequired && goal.category === 'treats' ? 'Rare ' : ''}${goal.label}`,
  );
  const parts = foodParts.length > 0
    ? [`Collect ${foodParts.join(' + ')}`]
    : [];
  if (sortTarget) {
    parts.push(`Sort ${sortTarget} Foods`);
  }
  if (scoreTarget) {
    parts.push(`Reach ${scoreTarget.toLocaleString()} Points`);
  }
  if (comboTarget) {
    parts.push(`Build a ${comboTarget}x Combo`);
  }
  return parts.length > 0 ? parts.join(' + ') : 'Complete the food challenge';
}

// Purpose: Builds any level from one of the thirty authored
// blueprints. Levels above 30 reuse expert patterns with small,
// capped increases so existing infinite progression still works.
export function getLevelConfig(
  requestedLevel: number,
  replayVariant = 0,
): FoodSortLevelDefinition {
  const level = normalizeLevel(requestedLevel);
  const blueprintIndex = level <= LEVEL_BLUEPRINTS.length
    ? level - 1
    : 20 + ((level - 31) % 10);
  const blueprint = LEVEL_BLUEPRINTS[blueprintIndex];
  const cycles = level <= LEVEL_BLUEPRINTS.length
    ? 0
    : Math.floor((level - 31) / 10) + 1;
  const variantShift = Math.abs(Math.floor(replayVariant)) % CATEGORY_ROTATION.length;
  const difficulty = getDifficulty(level);
  const bossLevel = level % 10 === 0;

  const usedCategories = new Set<FoodSortCategory>();
  const foodTargets = (blueprint.goals ?? []).map(([categoryOffset, amount], index) => {
    // Rare challenges always keep one real Treat objective. The
    // other targets can still rotate safely between existing foods.
    let category = blueprint.rare && index === 0
      ? 'treats'
      : categoryAt(categoryOffset + variantShift);
    let collisionOffset = 1;

    while (usedCategories.has(category)) {
      category = categoryAt(categoryOffset + variantShift + collisionOffset);
      collisionOffset += 1;
    }

    usedCategories.add(category);
    const definition = FOOD_SORT_CATEGORIES[category];
    return {
      category,
      foodId: definition.foodId,
      label: definition.label,
      target: amount + Math.min(2, cycles),
    };
  });

  const requiredFoodIds = foodTargets.map(goal => goal.foodId);
  const activeFoodIds = Array.from(new Set(requiredFoodIds));
  const rotationStart = (level + variantShift) % FOOD_SORT_FOOD_IDS.length;

  for (let offset = 0; activeFoodIds.length < blueprint.foods; offset += 1) {
    const candidate = FOOD_SORT_FOOD_IDS[
      (rotationStart + offset) % FOOD_SORT_FOOD_IDS.length
    ];
    if (!activeFoodIds.includes(candidate)) {
      activeFoodIds.push(candidate);
    }
  }

  const scoreTarget = blueprint.score
    ? blueprint.score + Math.min(300, cycles * 100)
    : undefined;
  const sortTarget = blueprint.sorted
    ? blueprint.sorted + Math.min(6, cycles * 2)
    : undefined;
  const rareFoodRequired = Boolean(blueprint.rare);
  const comboTarget = blueprint.combo;
  const requiredSpawnWeight = difficulty.tier === 1
    ? 1.4
    : difficulty.tier === 2
      ? 1.28
      : difficulty.tier === 3
        ? 1.16
        : 1.08;
  const spawnWeights: Partial<Record<FoodSortFoodId, number>> = {};

  for (const foodId of activeFoodIds) {
    spawnWeights[foodId] = requiredFoodIds.includes(foodId)
      ? requiredSpawnWeight
      : 1;
  }

  return {
    level,
    name: difficulty.name,
    difficultyLabel: difficulty.label,
    difficultyTier: difficulty.tier,
    timeLimit: Math.max(40, blueprint.time - Math.min(4, cycles)),
    speedMultiplier: Math.min(1.75, blueprint.speed + cycles * 0.03),
    allowedMistakes: blueprint.mistakes,
    moves: blueprint.moves,
    scoreTarget,
    sortTarget,
    comboTarget,
    foodTargets,
    goals: foodTargets,
    activeFoodIds,
    distractorCount: activeFoodIds.length - new Set(requiredFoodIds).size,
    obstacleBudget: level < 16 ? 0 : Math.min(20, 3 + Math.floor((level - 16) / 2)),
    bossLevel,
    rareFoodRequired,
    spawnWeights,
    goalSummary: formatGoalSummary(
      foodTargets,
      sortTarget,
      scoreTarget,
      comboTarget,
      rareFoodRequired,
    ),
  };
}

// Backwards-compatible name for existing callers.
export const createFoodSortLevel = getLevelConfig;
