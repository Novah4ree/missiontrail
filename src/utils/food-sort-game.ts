// ============================================================
// MISSION TRAILS - SIMPLE COMPANION FOOD MATCH-3
//
// SIMPLE RULES:
// - Swap neighboring foods.
// - Match 3 or more identical foods.
// - Matching foods disappear.
// - Foods fall down.
// - New foods enter from the top.
// - Cascades are allowed.
// - NO bombs.
// - NO explosions.
// - NO row/column blasters.
// - NO Mythic powers.
// ============================================================

export const FOOD_SORT_ROWS = 6;
export const FOOD_SORT_COLUMNS = 6;
export const FOOD_SORT_BOARD_SIZE =
  FOOD_SORT_ROWS * FOOD_SORT_COLUMNS;

export const FOOD_SORT_FOOD_IDS = [
  'treat',
  'carrot',
  'berry',
  'drink',
  'meal',
] as const;

export type FoodSortFoodId =
  typeof FOOD_SORT_FOOD_IDS[number];

// Kept for compatibility with the existing UI.
// The simple game engine NEVER creates anything except "none".
export type FoodSortSpecial =
  | 'none'
  | 'row'
  | 'column'
  | 'bomb'
  | 'mythic';

export type FoodSortTile = {
  id: string;
  foodId: FoodSortFoodId;
  special: FoodSortSpecial;
};

export type FoodSortCollected =
  Record<FoodSortFoodId, number>;

export type FoodSortSpawnWeights =
  Partial<Record<FoodSortFoodId, number>>;

type MatchDirection =
  | 'horizontal'
  | 'vertical';

type MatchGroup = {
  indices: number[];
  direction: MatchDirection;
};

export type FoodSortResolution = {
  board: FoodSortTile[];
  collected: FoodSortCollected;
  score: number;
  cascades: number;

  // Existing screen expects these values.
  // Simple mode always leaves them at zero.
  specialsCreated: number;
  bombsCreated: number;
  mythicsCreated: number;
  powerActivations: number;
};

let nextTileNumber = 1;

export function createEmptyCollected():
  FoodSortCollected {
  return {
    treat: 0,
    carrot: 0,
    berry: 0,
    drink: 0,
    meal: 0,
  };
}

function getAvailableFoods(
  requested:
    readonly FoodSortFoodId[],
): FoodSortFoodId[] {
  const available =
    Array.from(
      new Set(requested),
    );

  for (
    const foodId
    of FOOD_SORT_FOOD_IDS
  ) {
    if (
      available.length >= 3
    ) {
      break;
    }

    if (
      !available.includes(foodId)
    ) {
      available.push(foodId);
    }
  }

  return available;
}

function randomFoodId(
  requested:
    readonly FoodSortFoodId[] =
      FOOD_SORT_FOOD_IDS,

  spawnWeights:
    FoodSortSpawnWeights = {},
): FoodSortFoodId {
  const available =
    getAvailableFoods(requested);

  const totalWeight =
    available.reduce(
      (total, foodId) =>
        total +
        Math.max(
          0.01,
          spawnWeights[foodId] ?? 1,
        ),
      0,
    );

  let roll =
    Math.random() *
    totalWeight;

  for (
    const foodId
    of available
  ) {
    roll -=
      Math.max(
        0.01,
        spawnWeights[foodId] ?? 1,
      );

    if (roll <= 0) {
      return foodId;
    }
  }

  return (
    available[
      available.length - 1
    ]
  );
}

function createTile(
  foodId?:
    FoodSortFoodId,

  requested:
    readonly FoodSortFoodId[] =
      FOOD_SORT_FOOD_IDS,

  spawnWeights:
    FoodSortSpawnWeights = {},
): FoodSortTile {
  const tile:
    FoodSortTile = {
      id:
        `food-sort-${nextTileNumber}`,
      foodId:
        foodId ??
        randomFoodId(
          requested,
          spawnWeights,
        ),

      // IMPORTANT:
      // Simple game. Never make powers.
      special: 'none',
    };

  nextTileNumber += 1;

  return tile;
}

export function createFoodSortBoard(
  requestedFoodIds:
    readonly FoodSortFoodId[] =
      FOOD_SORT_FOOD_IDS,

  spawnWeights:
    FoodSortSpawnWeights = {},
): FoodSortTile[] {
  const available =
    getAvailableFoods(
      requestedFoodIds,
    );

  const board:
    FoodSortTile[] = [];

  for (
    let index = 0;
    index < FOOD_SORT_BOARD_SIZE;
    index += 1
  ) {
    const row =
      Math.floor(
        index /
        FOOD_SORT_COLUMNS,
      );

    const column =
      index %
      FOOD_SORT_COLUMNS;

    const blocked =
      new Set<FoodSortFoodId>();

    // Prevent automatic horizontal
    // matches when the board starts.
    if (column >= 2) {
      const one =
        board[index - 1];

      const two =
        board[index - 2];

      if (
        one &&
        two &&
        one.foodId ===
          two.foodId
      ) {
        blocked.add(
          one.foodId,
        );
      }
    }

    // Prevent automatic vertical
    // matches when the board starts.
    if (row >= 2) {
      const one =
        board[
          index -
          FOOD_SORT_COLUMNS
        ];

      const two =
        board[
          index -
          FOOD_SORT_COLUMNS * 2
        ];

      if (
        one &&
        two &&
        one.foodId ===
          two.foodId
      ) {
        blocked.add(
          one.foodId,
        );
      }
    }

    const choices =
      available.filter(
        foodId =>
          !blocked.has(foodId),
      );

    const foodId =
      randomFoodId(
        choices,
        spawnWeights,
      );

    board.push(
      createTile(
        foodId,
        available,
        spawnWeights,
      ),
    );
  }

  return board;
}

export function areFoodSortTilesAdjacent(
  firstIndex: number,
  secondIndex: number,
): boolean {
  const firstRow =
    Math.floor(
      firstIndex /
      FOOD_SORT_COLUMNS,
    );

  const firstColumn =
    firstIndex %
    FOOD_SORT_COLUMNS;

  const secondRow =
    Math.floor(
      secondIndex /
      FOOD_SORT_COLUMNS,
    );

  const secondColumn =
    secondIndex %
    FOOD_SORT_COLUMNS;

  return (
    Math.abs(
      firstRow -
      secondRow,
    ) +
      Math.abs(
        firstColumn -
        secondColumn,
      ) ===
    1
  );
}

export function swapFoodSortTiles(
  board:
    FoodSortTile[],

  firstIndex:
    number,

  secondIndex:
    number,
): FoodSortTile[] {
  const next =
    [...board];

  const temporary =
    next[firstIndex];

  next[firstIndex] =
    next[secondIndex];

  next[secondIndex] =
    temporary;

  return next;
}

function findMatchGroups(
  board:
    FoodSortTile[],
): MatchGroup[] {
  const groups:
    MatchGroup[] = [];

  // HORIZONTAL MATCHES
  for (
    let row = 0;
    row < FOOD_SORT_ROWS;
    row += 1
  ) {
    let start = 0;

    while (
      start <
      FOOD_SORT_COLUMNS
    ) {
      const startIndex =
        row *
          FOOD_SORT_COLUMNS +
        start;

      const foodId =
        board[
          startIndex
        ].foodId;

      let end =
        start + 1;

      while (
        end <
          FOOD_SORT_COLUMNS &&
        board[
          row *
            FOOD_SORT_COLUMNS +
          end
        ].foodId === foodId
      ) {
        end += 1;
      }

      if (
        end - start >= 3
      ) {
        const indices:
          number[] = [];

        for (
          let column =
            start;
          column < end;
          column += 1
        ) {
          indices.push(
            row *
              FOOD_SORT_COLUMNS +
            column,
          );
        }

        groups.push({
          indices,
          direction:
            'horizontal',
        });
      }

      start = end;
    }
  }

  // VERTICAL MATCHES
  for (
    let column = 0;
    column <
      FOOD_SORT_COLUMNS;
    column += 1
  ) {
    let start = 0;

    while (
      start <
      FOOD_SORT_ROWS
    ) {
      const startIndex =
        start *
          FOOD_SORT_COLUMNS +
        column;

      const foodId =
        board[
          startIndex
        ].foodId;

      let end =
        start + 1;

      while (
        end <
          FOOD_SORT_ROWS &&
        board[
          end *
            FOOD_SORT_COLUMNS +
          column
        ].foodId === foodId
      ) {
        end += 1;
      }

      if (
        end - start >= 3
      ) {
        const indices:
          number[] = [];

        for (
          let row =
            start;
          row < end;
          row += 1
        ) {
          indices.push(
            row *
              FOOD_SORT_COLUMNS +
            column,
          );
        }

        groups.push({
          indices,
          direction:
            'vertical',
        });
      }

      start = end;
    }
  }

  return groups;
}

export function findFoodSortMatches(
  board:
    FoodSortTile[],
): Set<number> {
  const matched =
    new Set<number>();

  for (
    const group
    of findMatchGroups(board)
  ) {
    for (
      const index
      of group.indices
    ) {
      matched.add(index);
    }
  }

  return matched;
}

function collapseFoodSortBoard(
  board:
    Array<
      FoodSortTile |
      null
    >,

  requestedFoodIds:
    readonly FoodSortFoodId[],

  spawnWeights:
    FoodSortSpawnWeights,
): FoodSortTile[] {
  const available =
    getAvailableFoods(
      requestedFoodIds,
    );

  const next:
    Array<
      FoodSortTile |
      null
    > =
      new Array(
        FOOD_SORT_BOARD_SIZE,
      ).fill(null);

  for (
    let column = 0;
    column <
      FOOD_SORT_COLUMNS;
    column += 1
  ) {
    let writeRow =
      FOOD_SORT_ROWS - 1;

    // Existing food falls down.
    for (
      let row =
        FOOD_SORT_ROWS - 1;
      row >= 0;
      row -= 1
    ) {
      const index =
        row *
          FOOD_SORT_COLUMNS +
        column;

      const tile =
        board[index];

      if (!tile) {
        continue;
      }

      next[
        writeRow *
          FOOD_SORT_COLUMNS +
        column
      ] = {
        ...tile,

        // Removes any old special
        // piece left from an older
        // saved board.
        special: 'none',
      };

      writeRow -= 1;
    }

    // New normal foods drop
    // into empty spaces.
    while (
      writeRow >= 0
    ) {
      next[
        writeRow *
          FOOD_SORT_COLUMNS +
        column
      ] =
        createTile(
          undefined,
          available,
          spawnWeights,
        );

      writeRow -= 1;
    }
  }

  return (
    next as
      FoodSortTile[]
  );
}

export function resolveFoodSortBoard(
  startingBoard:
    FoodSortTile[],

  requestedFoodIds:
    readonly FoodSortFoodId[] =
      FOOD_SORT_FOOD_IDS,

  spawnWeights:
    FoodSortSpawnWeights = {},
): FoodSortResolution {
  let board: FoodSortTile[] =
    startingBoard.map(
      (tile): FoodSortTile => ({
        ...tile,
        special: 'none',
      }),
    );

  const collected =
    createEmptyCollected();

  let score = 0;
  let cascades = 0;

  // Regular Candy-Crush-style
  // falling/cascade behavior.
  // No explosion expansion.
  while (
    cascades < 20
  ) {
    const matched =
      findFoodSortMatches(
        board,
      );

    if (
      matched.size === 0
    ) {
      break;
    }

    cascades += 1;

    const boardWithHoles:
      Array<
        FoodSortTile |
        null
      > =
        [...board];

    // ONLY remove the food that
    // actually belongs to a match.
    for (
      const index
      of matched
    ) {
      const tile =
        board[index];

      collected[
        tile.foodId
      ] += 1;

      boardWithHoles[
        index
      ] = null;
    }

    score +=
      matched.size *
      10 *
      cascades;

    board =
      collapseFoodSortBoard(
        boardWithHoles,
        requestedFoodIds,
        spawnWeights,
      );
  }

  return {
    board,
    collected,
    score,
    cascades,

    // Explosion system deleted.
    specialsCreated: 0,
    bombsCreated: 0,
    mythicsCreated: 0,
    powerActivations: 0,
  };
}
