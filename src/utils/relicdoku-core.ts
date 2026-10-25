export type CellState = "empty" | "relic" | "marked";

export type LevelData = {
  size: number;
  solution: number[];
  regions: number[][];
  difficulty: string;
};

export const TOTAL_LEVELS = 500;

const solutionCache = new Map<number, number[][]>();

export function createEmptyBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => "empty" as CellState),
  );
}

export function cloneBoard(board: CellState[][]): CellState[][] {
  return board.map((row) => [...row]);
}

export function countRelics(board: CellState[][]): number {
  return board.reduce(
    (total, row) => total + row.filter((cell) => cell === "relic").length,
    0,
  );
}

function getSizeForLevel(level: number): number {
  if (level <= 4) return 4;
  if (level <= 18) return 5;
  if (level <= 108) return 6;
  if (level <= 250) return 7;
  return 8;
}

function getDifficulty(size: number): string {
  if (size <= 4) return "EASY";
  if (size === 5) return "NORMAL";
  if (size === 6) return "TRICKY";
  if (size === 7) return "HARD";
  return "MYTHIC";
}

function getValidSolutions(size: number): number[][] {
  const cached = solutionCache.get(size);
  if (cached) {
    return cached;
  }

  const solutions: number[][] = [];
  const used = new Set<number>();
  const current: number[] = [];

  function build(row: number) {
    if (row === size) {
      solutions.push([...current]);
      return;
    }

    for (let col = 0; col < size; col += 1) {
      if (used.has(col)) {
        continue;
      }

      if (row > 0 && Math.abs(current[row - 1] - col) <= 1) {
        continue;
      }

      used.add(col);
      current.push(col);
      build(row + 1);
      current.pop();
      used.delete(col);
    }
  }

  build(0);
  solutionCache.set(size, solutions);
  return solutions;
}

function createRegionMap(
  size: number,
  solution: number[],
  seed: number,
): number[][] {
  const anchors = solution.map((col, row) => ({
    row,
    col,
    region: row,
  }));

  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      let bestRegion = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestTie = Number.POSITIVE_INFINITY;

      for (const anchor of anchors) {
        const distance =
          Math.abs(anchor.row - row) + Math.abs(anchor.col - col);

        const tie = (anchor.region * 37 + seed * 13 + row * 7 + col * 11) % 997;

        if (
          distance < bestDistance ||
          (distance === bestDistance && tie < bestTie)
        ) {
          bestDistance = distance;
          bestTie = tie;
          bestRegion = anchor.region;
        }
      }

      return bestRegion;
    }),
  );
}

export function buildLevel(level: number): LevelData {
  const size = getSizeForLevel(level);
  const solutions = getValidSolutions(size);

  const solutionIndex = ((level - 1) * 73 + size * 19) % solutions.length;

  const solution = [...solutions[solutionIndex]];
  const regions = createRegionMap(size, solution, level);

  return {
    size,
    solution,
    regions,
    difficulty: getDifficulty(size),
  };
}

export function createInitialBoard(levelData: LevelData): CellState[][] {
  // Starting, restarting and advancing must all begin without clues or X marks.
  return createEmptyBoard(levelData.size);
}

export function isPlacementCompatible(
  board: CellState[][],
  regions: number[][],
  row: number,
  col: number,
): boolean {
  const region = regions[row][col];

  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board.length; c += 1) {
      if (board[r][c] !== "relic") {
        continue;
      }

      if (r === row && c === col) {
        continue;
      }

      if (r === row || c === col) {
        return false;
      }

      if (regions[r][c] === region) {
        return false;
      }

      if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) {
        return false;
      }
    }
  }

  return true;
}

export function isAutoBlocked(
  board: CellState[][],
  regions: number[][],
  row: number,
  col: number,
): boolean {
  if (board[row][col] === "relic") {
    return false;
  }

  return !isPlacementCompatible(board, regions, row, col);
}

export function findCompletion(
  board: CellState[][],
  levelData: LevelData,
): number[] | null {
  const { size, regions } = levelData;

  const fixedByRow = new Map<number, number>();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row][col] !== "relic") {
        continue;
      }

      if (fixedByRow.has(row)) {
        return null;
      }

      fixedByRow.set(row, col);
    }
  }

  const usedColumns = new Set<number>();
  const usedRegions = new Set<number>();
  const result = Array.from({ length: size }, () => -1);

  function search(row: number): boolean {
    if (row === size) {
      return true;
    }

    const fixedCol = fixedByRow.get(row);
    const candidates =
      fixedCol === undefined
        ? Array.from({ length: size }, (_, index) => index)
        : [fixedCol];

    for (const col of candidates) {
      const region = regions[row][col];

      if (usedColumns.has(col) || usedRegions.has(region)) {
        continue;
      }

      if (
        row > 0 &&
        result[row - 1] >= 0 &&
        Math.abs(result[row - 1] - col) <= 1
      ) {
        continue;
      }

      usedColumns.add(col);
      usedRegions.add(region);
      result[row] = col;

      if (search(row + 1)) {
        return true;
      }

      result[row] = -1;
      usedColumns.delete(col);
      usedRegions.delete(region);
    }

    return false;
  }

  return search(0) ? result : null;
}

// Pencil marks are player notes, not constraints: hints can correct a mistaken X.
export function toggleMark(board: CellState[][], row: number, col: number): CellState[][] {
  const next = cloneBoard(board);
  if (next[row][col] !== "relic") {
    next[row][col] = next[row][col] === "marked" ? "empty" : "marked";
  }
  return next;
}

// Automatic exclusions are derived, never stored in the board or undo history.
export function getVisibleMark(
  board: CellState[][],
  regions: number[][],
  row: number,
  col: number,
  autoMark: boolean,
): "manual" | "auto" | null {
  if (board[row][col] === "relic") return null;
  if (board[row][col] === "marked") return "manual";
  return autoMark && isAutoBlocked(board, regions, row, col) ? "auto" : null;
}

