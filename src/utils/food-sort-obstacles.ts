// Food Sort obstacle helpers.
//
// Purpose:
// Keeps obstacle rules separate from the main
// match-3 engine so the game stays easy to understand.

export type FoodSortObstacleType =
  | 'ice'
  | 'rock'
  | 'vine'
  | 'slime'
  | 'relic'
  | 'egg';


export type FoodSortObstacleCell = {
  type: FoodSortObstacleType;

  // 1 = one match breaks it.
  // 2 = two matches break it.
  health: number;
};


export type FoodSortObstacleBoard =
  (FoodSortObstacleCell | null)[];


export type FoodSortObstacleResult = {
  obstacles: FoodSortObstacleBoard;

  hit: number;

  cleared: number;
};


// Purpose:
// Creates repeatable random positions using
// the level number.
//
// This means the same level starts with
// the same obstacle arrangement.
function createSeededRandom(
  seed: number,
) {
  let value =
    Math.max(
      1,
      seed,
    );


  return function random() {
    value =
      (
        value * 9301 +
        49297
      ) %
      233280;


    return (
      value /
      233280
    );
  };
}


// Purpose:
// Randomizes board positions for obstacles.
function shuffledPositions(
  boardSize: number,
  level: number,
) {
  const positions =
    Array.from(
      {
        length:
          boardSize,
      },
      (_, index) =>
        index,
    );


  const random =
    createSeededRandom(
      level * 73,
    );


  for (
    let index =
      positions.length - 1;

    index > 0;

    index -= 1
  ) {
    const swapIndex =
      Math.floor(
        random() *
        (
          index + 1
        ),
      );


    const temporary =
      positions[index];


    positions[index] =
      positions[swapIndex];


    positions[swapIndex] =
      temporary;
  }


  return positions;
}


// Purpose:
// Creates obstacles based on the player's level.
//
// Level 1-15:
// No obstacles.
//
// Level 16+:
// Ice starts appearing.
//
// Level 26+:
// Strong ice needs two matches.
export function createFoodSortObstacleBoard(
  level: number,
  obstacleBudget: number,
  boardSize = 36,
): FoodSortObstacleBoard {
  const obstacles:
    FoodSortObstacleBoard =
      Array(
        boardSize,
      ).fill(
        null,
      );


  if (
    level < 16 ||
    obstacleBudget <= 0
  ) {
    return obstacles;
  }


  const positions =
    shuffledPositions(
      boardSize,
      level,
    );


  let positionIndex = 0;


  // ==========================================================
  // LEVEL 16+
  // ICE
  // ==========================================================

  const iceCount =
    level >= 31
      ? Math.min(
          6,
          Math.max(
            2,
            Math.ceil(
              obstacleBudget /
              6,
            ),
          ),
        )
      : Math.min(
          12,
          Math.max(
            2,
            Math.ceil(
              obstacleBudget /
              3,
            ),
          ),
        );


  const iceHealth =
    level >= 26
      ? 2
      : 1;


  for (
    let index = 0;

    index < iceCount &&
    positionIndex <
      positions.length;

    index += 1
  ) {
    const position =
      positions[
        positionIndex
      ];

    positionIndex += 1;


    obstacles[position] = {
      type:
        'ice',

      health:
        iceHealth,
    };
  }


  // ==========================================================
  // LEVEL 31+
  // ROCK
  // ==========================================================

  if (
    level >= 31
  ) {
    const rockCount =
      Math.min(
        10,

        Math.max(
          2,

          Math.ceil(
            obstacleBudget /
            4,
          ),
        ),
      );


    const rockHealth =
      level >= 45
        ? 3
        : 2;


    for (
      let index = 0;

      index < rockCount &&
      positionIndex <
        positions.length;

      index += 1
    ) {
      const position =
        positions[
          positionIndex
        ];

      positionIndex += 1;


      obstacles[position] = {
        type:
          'rock',

        health:
          rockHealth,
      };
    }
  }


  // ==========================================================
  // LEVEL 51+
  // VINES
  // ==========================================================

  if (
    level >= 51
  ) {
    const vineCount =
      Math.min(
        10,

        Math.max(
          2,

          Math.ceil(
            obstacleBudget /
            5,
          ),
        ),
      );


    const vineHealth =
      level >= 70
        ? 2
        : 1;


    for (
      let index = 0;

      index < vineCount &&
      positionIndex <
        positions.length;

      index += 1
    ) {
      const position =
        positions[
          positionIndex
        ];

      positionIndex += 1;


      obstacles[position] = {
        type:
          'vine',

        health:
          vineHealth,
      };
    }
  }


  // ==========================================================
  // LEVEL 76+
  // TOXIC SLIME
  // ==========================================================

  if (
    level >= 76
  ) {
    const slimeCount =
      Math.min(
        8,

        Math.max(
          2,

          Math.ceil(
            obstacleBudget /
            6,
          ),
        ),
      );


    const slimeHealth =
      level >= 90
        ? 2
        : 1;


    for (
      let index = 0;

      index < slimeCount &&
      positionIndex <
        positions.length;

      index += 1
    ) {
      const position =
        positions[
          positionIndex
        ];

      positionIndex += 1;


      obstacles[position] = {
        type:
          'slime',

        health:
          slimeHealth,
      };
    }
  }


  // ==========================================================
  // LEVEL 100+
  // BURIED RELICS
  // ==========================================================

  if (
    level >= 100
  ) {
    const relicCount =
      Math.min(
        6,

        Math.max(
          1,

          Math.ceil(
            obstacleBudget /
            8,
          ),
        ),
      );


    const relicHealth =
      level >= 150
        ? 3
        : 2;


    for (
      let index = 0;

      index < relicCount &&
      positionIndex <
        positions.length;

      index += 1
    ) {
      const position =
        positions[
          positionIndex
        ];

      positionIndex += 1;


      obstacles[
        position
      ] = {
        type:
          'relic',

        health:
          relicHealth,
      };
    }
  }


  // ==========================================================
  // LEVEL 250+
  // COMPANION EGGS
  // ==========================================================

  if (
    level >= 250
  ) {
    const eggCount =
      Math.min(
        4,

        Math.max(
          1,

          Math.ceil(
            obstacleBudget /
            12,
          ),
        ),
      );


    const eggHealth =
      level >= 400
        ? 4
        : 3;


    for (
      let index = 0;

      index < eggCount &&
      positionIndex <
        positions.length;

      index += 1
    ) {
      const position =
        positions[
          positionIndex
        ];

      positionIndex += 1;


      obstacles[
        position
      ] = {
        type:
          'egg',

        health:
          eggHealth,
      };
    }
  }


  return obstacles;
}


// Purpose:
// Damages Ice, Rock, Vine, or Slime obstacles
// when the food underneath is matched.
// underneath is included in a successful match.
export function damageFoodSortObstacles(
  current:
    FoodSortObstacleBoard,

  matchedIndexes:
    Set<number>,
): FoodSortObstacleResult {
  const next =
    current.map(
      obstacle =>
        obstacle
          ? {
              ...obstacle,
            }
          : null,
    );


  let hit = 0;

  let cleared = 0;


  for (
    const index
    of matchedIndexes
  ) {
    const obstacle =
      next[index];


    if (
      !obstacle ||
      obstacle.type ===
        'relic' ||
      obstacle.type ===
        'egg'
    ) {
      continue;
    }


    hit += 1;


    const nextHealth =
      obstacle.health - 1;


    if (
      nextHealth <= 0
    ) {
      next[index] =
        null;

      cleared += 1;

      continue;
    }


    next[index] = {
      ...obstacle,

      health:
        nextHealth,
    };
  }


  return {
    obstacles:
      next,

    hit,

    cleared,
  };
}


// Purpose:
// Checks whether two board squares are directly
// beside each other.
//
// Diagonal matches do not dig up Relics.
function areObstaclePositionsAdjacent(
  firstIndex: number,
  secondIndex: number,
  columns = 6,
) {
  const firstRow =
    Math.floor(
      firstIndex /
      columns,
    );

  const secondRow =
    Math.floor(
      secondIndex /
      columns,
    );


  const firstColumn =
    firstIndex %
    columns;

  const secondColumn =
    secondIndex %
    columns;


  const rowDistance =
    Math.abs(
      firstRow -
      secondRow,
    );


  const columnDistance =
    Math.abs(
      firstColumn -
      secondColumn,
    );


  return (
    rowDistance +
    columnDistance ===
    1
  );
}


// Purpose:
// Buried Relics are not damaged by matching the
// food underneath them.
//
// Instead, the player digs them out by creating
// successful matches directly beside the Relic.
export function damageFoodSortRelics(
  current:
    FoodSortObstacleBoard,

  matchedIndexes:
    Set<number>,

  columns = 6,
): FoodSortObstacleResult {
  const next =
    current.map(
      obstacle =>
        obstacle
          ? {
              ...obstacle,
            }
          : null,
    );


  let hit = 0;

  let cleared = 0;


  for (
    let relicIndex = 0;

    relicIndex <
    next.length;

    relicIndex += 1
  ) {
    const obstacle =
      next[
        relicIndex
      ];


    if (
      obstacle?.type !==
      'relic'
    ) {
      continue;
    }


    const wasHit =
      Array.from(
        matchedIndexes,
      ).some(
        matchedIndex =>
          areObstaclePositionsAdjacent(
            relicIndex,
            matchedIndex,
            columns,
          ),
      );


    if (
      !wasHit
    ) {
      continue;
    }


    hit += 1;


    const nextHealth =
      obstacle.health - 1;


    if (
      nextHealth <= 0
    ) {
      next[
        relicIndex
      ] = null;

      cleared += 1;

      continue;
    }


    next[
      relicIndex
    ] = {
      ...obstacle,

      health:
        nextHealth,
    };
  }


  return {
    obstacles:
      next,

    hit,

    cleared,
  };
}


// Purpose:
// Companion Eggs crack when food is matched
// directly beside them.
//
// Eggs do not move and cannot be damaged by
// matching the food underneath the Egg square.
export function damageFoodSortEggs(
  current:
    FoodSortObstacleBoard,

  matchedIndexes:
    Set<number>,

  columns = 6,
): FoodSortObstacleResult {
  const next =
    current.map(
      obstacle =>
        obstacle
          ? {
              ...obstacle,
            }
          : null,
    );


  let hit = 0;

  let cleared = 0;


  for (
    let eggIndex = 0;

    eggIndex <
    next.length;

    eggIndex += 1
  ) {
    const obstacle =
      next[
        eggIndex
      ];


    if (
      obstacle?.type !==
      'egg'
    ) {
      continue;
    }


    const wasHit =
      Array.from(
        matchedIndexes,
      ).some(
        matchedIndex =>
          areObstaclePositionsAdjacent(
            eggIndex,
            matchedIndex,
            columns,
          ),
      );


    if (
      !wasHit
    ) {
      continue;
    }


    hit += 1;


    const nextHealth =
      obstacle.health - 1;


    if (
      nextHealth <= 0
    ) {
      next[
        eggIndex
      ] = null;

      cleared += 1;

      continue;
    }


    next[
      eggIndex
    ] = {
      ...obstacle,

      health:
        nextHealth,
    };
  }


  return {
    obstacles:
      next,

    hit,

    cleared,
  };
}


// Purpose:
// Counts how much Toxic Slime currently exists.
export function countFoodSortSlime(
  obstacles:
    FoodSortObstacleBoard,
) {
  return obstacles.filter(
    obstacle =>
      obstacle?.type ===
      'slime',
  ).length;
}


// Purpose:
// Returns board positions directly beside one tile.
//
// Slime can only spread left, right, up, or down.
function getAdjacentPositions(
  index: number,
  rows: number,
  columns: number,
) {
  const row =
    Math.floor(
      index /
      columns,
    );

  const column =
    index %
    columns;


  const positions:
    number[] = [];


  if (
    row > 0
  ) {
    positions.push(
      index - columns,
    );
  }


  if (
    row <
    rows - 1
  ) {
    positions.push(
      index + columns,
    );
  }


  if (
    column > 0
  ) {
    positions.push(
      index - 1,
    );
  }


  if (
    column <
    columns - 1
  ) {
    positions.push(
      index + 1,
    );
  }


  return positions;
}


// Purpose:
// Lets one surviving Toxic Slime spread after
// a successful move.
//
// Only one new Slime may appear per move,
// and the board has a hard Slime limit.
export function spreadFoodSortSlime(
  current:
    FoodSortObstacleBoard,

  level: number,

  moveNumber: number,

  rows = 6,

  columns = 6,
): {
  obstacles:
    FoodSortObstacleBoard;

  spread:
    boolean;

  newIndex:
    number | null;
} {
  const next =
    current.map(
      obstacle =>
        obstacle
          ? {
              ...obstacle,
            }
          : null,
    );


  if (
    level < 76
  ) {
    return {
      obstacles:
        next,

      spread:
        false,

      newIndex:
        null,
    };
  }


  const slimeIndexes =
    next
      .map(
        (
          obstacle,
          index,
        ) =>
          obstacle?.type ===
          'slime'
            ? index
            : -1,
      )
      .filter(
        index =>
          index >= 0,
      );


  if (
    slimeIndexes.length === 0
  ) {
    return {
      obstacles:
        next,

      spread:
        false,

      newIndex:
        null,
    };
  }


  // Prevent Slime from taking over the whole board.
  const maximumSlime =
    level >= 120
      ? 12
      : 10;


  if (
    slimeIndexes.length >=
    maximumSlime
  ) {
    return {
      obstacles:
        next,

      spread:
        false,

      newIndex:
        null,
    };
  }


  // Purpose:
  // Gives spreading a predictable rotating pattern
  // instead of pure randomness.
  const startIndex =
    Math.abs(
      level +
      moveNumber,
    ) %
    slimeIndexes.length;


  for (
    let offset = 0;

    offset <
    slimeIndexes.length;

    offset += 1
  ) {
    const slimeIndex =
      slimeIndexes[
        (
          startIndex +
          offset
        ) %
        slimeIndexes.length
      ];


    const adjacent =
      getAdjacentPositions(
        slimeIndex,
        rows,
        columns,
      );


    // Rotate the direction based on the move number.
    const directionStart =
      Math.abs(
        moveNumber +
        slimeIndex,
      ) %
      adjacent.length;


    for (
      let direction = 0;

      direction <
      adjacent.length;

      direction += 1
    ) {
      const target =
        adjacent[
          (
            directionStart +
            direction
          ) %
          adjacent.length
        ];


      // Slime only spreads into an empty
      // obstacle square.
      if (
        next[target] !==
        null
      ) {
        continue;
      }


      next[target] = {
        type:
          'slime',

        health:
          level >= 90
            ? 2
            : 1,
      };


      return {
        obstacles:
          next,

        spread:
          true,

        newIndex:
          target,
      };
    }
  }


  return {
    obstacles:
      next,

    spread:
      false,

    newIndex:
      null,
  };
}


// Purpose:
// Counts obstacles still remaining.
export function countFoodSortObstacles(
  obstacles:
    FoodSortObstacleBoard,
) {
  return obstacles.filter(
    obstacle =>
      obstacle !== null,
  ).length;
}
