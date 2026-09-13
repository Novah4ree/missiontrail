// ============================================================
// MISSION TRAILS - COMPANION FOOD SORT GAME ENGINE
// ============================================================
// Purpose:
// Controls Food Sort board generation, swapping, matches,
// special food, falling food, cascades, and game score.
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


export type FoodSortSpecial =
  | 'none'
  | 'row'
  | 'column'
  | 'bomb'
  | 'mythic';


export type FoodSortTile = {
  id: string;

  foodId:
    FoodSortFoodId;

  special:
    FoodSortSpecial;
};


export type FoodSortCollected =
  Record<
    FoodSortFoodId,
    number
  >;


export type FoodSortSpawnWeights =
  Partial<
    Record<FoodSortFoodId, number>
  >;


type MatchDirection =
  | 'horizontal'
  | 'vertical';


type MatchGroup = {
  indices: number[];

  direction:
    MatchDirection;
};


export type FoodSortResolution = {
  board:
    FoodSortTile[];

  collected:
    FoodSortCollected;

  score: number;

  cascades: number;

  specialsCreated: number;

  bombsCreated: number;

  mythicsCreated: number;

  powerActivations: number;
};


let nextTileNumber = 1;


// Purpose: Creates an empty food counter.
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


// Purpose: Picks one random food.
function randomFoodId(
  availableFoodIds:
    readonly FoodSortFoodId[] =
      FOOD_SORT_FOOD_IDS,

  spawnWeights:
    FoodSortSpawnWeights = {},
):
  FoodSortFoodId {
  const totalWeight =
    availableFoodIds.reduce(
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

  for (const foodId of availableFoodIds) {
    roll -= Math.max(
      0.01,
      spawnWeights[foodId] ?? 1,
    );

    if (roll <= 0) {
      return foodId;
    }
  }

  return availableFoodIds[
    availableFoodIds.length - 1
  ];
}


// Purpose: Creates one unique board tile.
function createTile(
  foodId:
    FoodSortFoodId | undefined =
      undefined,

  special:
    FoodSortSpecial =
      'none',

  availableFoodIds:
    readonly FoodSortFoodId[] =
      FOOD_SORT_FOOD_IDS,

  spawnWeights:
    FoodSortSpawnWeights = {},
): FoodSortTile {
  const tile = {
    id:
      `food-sort-${nextTileNumber}`,

    foodId:
      foodId ??
      randomFoodId(
        availableFoodIds,
        spawnWeights,
      ),

    special,
  };

  nextTileNumber += 1;

  return tile;
}


// Purpose: Creates a 6x6 board without
// starting three-in-a-row matches.
export function createFoodSortBoard(
  requestedFoodIds:
    readonly FoodSortFoodId[] =
      FOOD_SORT_FOOD_IDS,

  spawnWeights:
    FoodSortSpawnWeights = {},
):
  FoodSortTile[] {
  const availableFoodIds =
    Array.from(
      new Set(
        requestedFoodIds,
      ),
    );

  // Match-3 needs at least three distinct foods. Level configs
  // always provide three or more; this fallback keeps the engine
  // safe for any future caller.
  for (
    const foodId
    of FOOD_SORT_FOOD_IDS
  ) {
    if (
      availableFoodIds.length >= 3
    ) {
      break;
    }

    if (
      !availableFoodIds.includes(
        foodId,
      )
    ) {
      availableFoodIds.push(
        foodId,
      );
    }
  }

  const board:
    FoodSortTile[] = [];


  for (
    let index = 0;
    index <
      FOOD_SORT_BOARD_SIZE;
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


    const blockedFoods =
      new Set<
        FoodSortFoodId
      >();


    // Avoid starting horizontal matches.
    if (column >= 2) {
      const first =
        board[index - 1];

      const second =
        board[index - 2];

      if (
        first &&
        second &&
        first.foodId ===
          second.foodId
      ) {
        blockedFoods.add(
          first.foodId,
        );
      }
    }


    // Avoid starting vertical matches.
    if (row >= 2) {
      const first =
        board[
          index -
          FOOD_SORT_COLUMNS
        ];

      const second =
        board[
          index -
          FOOD_SORT_COLUMNS * 2
        ];

      if (
        first &&
        second &&
        first.foodId ===
          second.foodId
      ) {
        blockedFoods.add(
          first.foodId,
        );
      }
    }


    const availableFoods =
      availableFoodIds.filter(
        (foodId) =>
          !blockedFoods.has(
            foodId,
          ),
      );


    const foodId =
      randomFoodId(
        availableFoods,
        spawnWeights,
      );


    board.push(
      createTile(foodId),
    );
  }


  return board;
}


// Purpose: Checks whether two tiles are
// directly beside each other.
export function areFoodSortTilesAdjacent(
  firstIndex: number,
  secondIndex: number,
) {
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


// Purpose: Swaps two board tiles.
export function swapFoodSortTiles(
  board:
    FoodSortTile[],

  firstIndex:
    number,

  secondIndex:
    number,
) {
  const nextBoard =
    [...board];

  const firstTile =
    nextBoard[firstIndex];

  nextBoard[firstIndex] =
    nextBoard[
      secondIndex
    ];

  nextBoard[secondIndex] =
    firstTile;


  return nextBoard;
}


// Purpose: Finds individual horizontal and
// vertical groups of 3 or more matching foods.
function findMatchGroups(
  board:
    FoodSortTile[],
): MatchGroup[] {
  const groups:
    MatchGroup[] = [];


  // -----------------------------
  // Horizontal
  // -----------------------------
  for (
    let row = 0;
    row <
      FOOD_SORT_ROWS;
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
        board[startIndex]
          .foodId;

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


  // -----------------------------
  // Vertical
  // -----------------------------
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
        board[startIndex]
          .foodId;

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


// Purpose: Returns every tile included
// in a regular match.
export function findFoodSortMatches(
  board:
    FoodSortTile[],
) {
  const matched =
    new Set<number>();


  for (
    const group
    of findMatchGroups(
      board,
    )
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


// Purpose: Finds a safe tile inside a match
// where a new special food can appear.
function chooseSpecialIndex(
  board:
    FoodSortTile[],

  indices:
    number[],
) {
  const middle =
    Math.floor(
      indices.length / 2,
    );


  const preferred =
    indices[middle];


  if (
    board[preferred]
      .special === 'none'
  ) {
    return preferred;
  }


  return (
    indices.find(
      (index) =>
        board[index]
          .special ===
        'none',
    ) ??
    null
  );
}


// Purpose: Expands a matched clear when an
// existing Power Snack or Mythic Treat activates.
function expandSpecialEffects(
  board:
    FoodSortTile[],

  initialClear:
    Set<number>,
) {
  const clear =
    new Set(
      initialClear,
    );

  const processed =
    new Set<number>();

  const queue =
    [...clear];


  let activations = 0;


  while (
    queue.length > 0
  ) {
    const index =
      queue.shift();

    if (
      index === undefined ||
      processed.has(index)
    ) {
      continue;
    }


    processed.add(index);


    const tile =
      board[index];


    if (
      !tile ||
      tile.special ===
        'none'
    ) {
      continue;
    }


    activations += 1;


    const affected:
      number[] = [];


    // -----------------------------
    // ROW POWER SNACK
    // -----------------------------
    if (
      tile.special ===
      'row'
    ) {
      const row =
        Math.floor(
          index /
          FOOD_SORT_COLUMNS,
        );


      for (
        let column = 0;
        column <
          FOOD_SORT_COLUMNS;
        column += 1
      ) {
        affected.push(
          row *
            FOOD_SORT_COLUMNS +
          column,
        );
      }
    }


    // -----------------------------
    // COLUMN POWER SNACK
    // -----------------------------
    if (
      tile.special ===
      'column'
    ) {
      const column =
        index %
        FOOD_SORT_COLUMNS;


      for (
        let row = 0;
        row <
          FOOD_SORT_ROWS;
        row += 1
      ) {
        affected.push(
          row *
            FOOD_SORT_COLUMNS +
          column,
        );
      }
    }


    // -----------------------------
    // NOVA BOMB
    //
    // Clears a 3x3 area centered
    // around the bomb.
    // -----------------------------
    if (
      tile.special ===
      'bomb'
    ) {
      const centerRow =
        Math.floor(
          index /
          FOOD_SORT_COLUMNS,
        );

      const centerColumn =
        index %
        FOOD_SORT_COLUMNS;


      for (
        let rowOffset = -1;
        rowOffset <= 1;
        rowOffset += 1
      ) {
        for (
          let columnOffset = -1;
          columnOffset <= 1;
          columnOffset += 1
        ) {
          const row =
            centerRow +
            rowOffset;

          const column =
            centerColumn +
            columnOffset;


          if (
            row < 0 ||
            row >= FOOD_SORT_ROWS ||
            column < 0 ||
            column >= FOOD_SORT_COLUMNS
          ) {
            continue;
          }


          affected.push(
            row *
              FOOD_SORT_COLUMNS +
            column,
          );
        }
      }
    }


    // -----------------------------
    // MYTHIC TREAT
    //
    // Clears every food matching
    // this Mythic Treat's food type.
    // -----------------------------
    if (
      tile.special ===
      'mythic'
    ) {
      for (
        let boardIndex = 0;
        boardIndex <
          board.length;
        boardIndex += 1
      ) {
        if (
          board[
            boardIndex
          ].foodId ===
          tile.foodId
        ) {
          affected.push(
            boardIndex,
          );
        }
      }
    }


    // Add newly affected tiles.
    for (
      const affectedIndex
      of affected
    ) {
      if (
        !clear.has(
          affectedIndex,
        )
      ) {
        clear.add(
          affectedIndex,
        );

        queue.push(
          affectedIndex,
        );
      }
    }
  }


  return {
    clear,
    activations,
  };
}


// Purpose: Makes remaining foods fall down
// and fills new foods at the top.
function collapseFoodSortBoard(
  board:
    Array<
      FoodSortTile |
      null
    >,

  availableFoodIds:
    readonly FoodSortFoodId[],

  spawnWeights:
    FoodSortSpawnWeights,
): FoodSortTile[] {
  const nextBoard:
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


    for (
      let row =
        FOOD_SORT_ROWS - 1;
      row >= 0;
      row -= 1
    ) {
      const tile =
        board[
          row *
            FOOD_SORT_COLUMNS +
          column
        ];


      if (!tile) {
        continue;
      }


      nextBoard[
        writeRow *
          FOOD_SORT_COLUMNS +
        column
      ] = tile;


      writeRow -= 1;
    }


    while (
      writeRow >= 0
    ) {
      nextBoard[
        writeRow *
          FOOD_SORT_COLUMNS +
        column
      ] =
        createTile(
          undefined,
          'none',
          availableFoodIds,
          spawnWeights,
        );


      writeRow -= 1;
    }
  }


  return (
    nextBoard as
      FoodSortTile[]
  );
}


// Purpose: Resolves matches, Power Snacks,
// Mythic Treats, falling foods, and cascades.
export function resolveFoodSortBoard(
  startingBoard:
    FoodSortTile[],

  availableFoodIds:
    readonly FoodSortFoodId[] =
      FOOD_SORT_FOOD_IDS,

  spawnWeights:
    FoodSortSpawnWeights = {},
): FoodSortResolution {
  let board =
    [...startingBoard];


  const collected =
    createEmptyCollected();


  let score = 0;

  let cascades = 0;

  let specialsCreated = 0;

  let bombsCreated = 0;

  let mythicsCreated = 0;

  let powerActivations = 0;


  // Safety limit prevents an accidental
  // endless cascade.
  while (
    cascades < 20
  ) {
    const groups =
      findMatchGroups(
        board,
      );


    if (
      groups.length === 0
    ) {
      break;
    }


    cascades += 1;


    const matched =
      new Set<number>();


    for (
      const group
      of groups
    ) {
      for (
        const index
        of group.indices
      ) {
        matched.add(index);
      }
    }


    // --------------------------------------
    // Decide which new specials are created.
    // --------------------------------------
    const specialsToCreate =
      new Map<
        number,
        FoodSortSpecial
      >();


    for (
      const group
      of groups
    ) {
      if (
        group.indices.length <
        4
      ) {
        continue;
      }


      const specialIndex =
        chooseSpecialIndex(
          board,
          group.indices,
        );


      if (
        specialIndex ===
        null
      ) {
        continue;
      }


      // 6+ MATCH
      //
      // Creates the strongest special:
      // Mythic Burst.
      if (
        group.indices.length >=
        6
      ) {
        specialsToCreate.set(
          specialIndex,
          'mythic',
        );

        continue;
      }


      // 5 MATCH
      //
      // Creates a Nova Bomb.
      if (
        group.indices.length ===
        5
      ) {
        specialsToCreate.set(
          specialIndex,
          'bomb',
        );

        continue;
      }


      // 4 MATCH
      //
      // Horizontal match -> row blaster.
      // Vertical match -> column blaster.
      specialsToCreate.set(
        specialIndex,

        group.direction ===
          'horizontal'
          ? 'row'
          : 'column',
      );
    }


    // Existing special foods inside this match
    // can cause larger chain-reaction clears.
    const expanded =
      expandSpecialEffects(
        board,
        matched,
      );


    powerActivations +=
      expanded.activations;


    const clearSet =
      expanded.clear;


    // A newly created special stays alive
    // instead of being removed immediately.
    for (
      const index
      of specialsToCreate.keys()
    ) {
      clearSet.delete(index);
    }


    const boardWithHoles:
      Array<
        FoodSortTile |
        null
      > = [...board];


    // --------------------------------------
    // Clear matched / exploded food.
    // --------------------------------------
    for (
      const index
      of clearSet
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


    // --------------------------------------
    // Create specials.
    // --------------------------------------
    for (
      const [
        index,
        special,
      ]
      of specialsToCreate
    ) {
      const oldTile =
        board[index];


      boardWithHoles[
        index
      ] =
        createTile(
          oldTile.foodId,
          special,
        );


      specialsCreated +=
        1;


      if (
        special ===
        'bomb'
      ) {
        bombsCreated +=
          1;
      }


      if (
        special ===
        'mythic'
      ) {
        mythicsCreated +=
          1;
      }
    }


    // --------------------------------------
    // GAME SCORE
    // --------------------------------------
    score +=
      clearSet.size *
      10 *
      cascades;


    // Bonus for making specials.
    for (
      const special
      of specialsToCreate.values()
    ) {
      score +=
        special ===
        'mythic'
          ? 250
          : special ===
              'bomb'
            ? 150
            : 75;
    }


    // Bonus for activating existing powers.
    score +=
      expanded.activations *
      100;


    board =
      collapseFoodSortBoard(
        boardWithHoles,
        availableFoodIds,
        spawnWeights,
      );
  }


  return {
    board,
    collected,
    score,
    cascades,
    specialsCreated,
    bombsCreated,
    mythicsCreated,
    powerActivations,
  };
}
