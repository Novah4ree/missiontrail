export type CellState = "empty" | "relic" | "marked";
export type Difficulty = "easy" | "hard";
export type RevealedRelic = { row: number; col: number };
export type RelicdokuProgress = { selected: Difficulty; easy: number; hard: number };

export type LevelData = {
  size: number;
  solution: number[];
  regions: number[][];
  difficulty: Difficulty;
  revealed: RevealedRelic[];
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

export function getSizeForLevel(level: number, difficulty: Difficulty = "easy"): number {
  if (difficulty === "hard") {
    if (level <= 15) return 8;
    if (level <= 50) return 9;
    if (level <= 125) return 10;
    if (level <= 250) return 11;
    return 12;
  }
  if (level <= 4) return 4;
  if (level <= 18) return 5;
  if (level <= 108) return 6;
  if (level <= 250) return 7;
  return 8;
}

function safeLevel(value: unknown): number {
  const level = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(level) && level >= 1 && level <= TOTAL_LEVELS ? level : 1;
}

export function parseProgress(stored: string | null, legacy: string | null): RelicdokuProgress {
  const fallback: RelicdokuProgress = { selected: "easy", easy: safeLevel(legacy), hard: 1 };
  if (!stored) return fallback;
  try {
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
    const progress = value as Partial<RelicdokuProgress>;
    return {
      selected: progress.selected === "hard" ? "hard" : "easy",
      easy: progress.easy === undefined ? fallback.easy : safeLevel(progress.easy),
      hard: safeLevel(progress.hard),
    };
  } catch {
    return fallback;
  }
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Find one seeded arrangement instead of enumerating millions of permutations
// when Hard reaches 12 columns. Easy retains its existing level layouts.
function createHardSolution(size: number, level: number): number[] {
  const random = seededRandom(level * 7919 + size * 104729);
  const candidates = Array.from({ length: size }, () => {
    const columns = Array.from({ length: size }, (_, col) => col);
    for (let i = size - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [columns[i], columns[j]] = [columns[j], columns[i]];
    }
    return columns;
  });
  const solution: number[] = [];
  const used = new Set<number>();
  function search(row: number): boolean {
    if (row === size) return true;
    for (const col of candidates[row]) {
      if (used.has(col) || (row > 0 && Math.abs(solution[row - 1] - col) <= 1)) continue;
      used.add(col);
      solution[row] = col;
      if (search(row + 1)) return true;
      used.delete(col);
    }
    return false;
  }
  if (!search(0)) throw new Error(`No Relicdoku arrangement for size ${size}`);
  return solution;
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

export function buildLevel(level: number, difficulty: Difficulty = "easy"): LevelData {
  const size = getSizeForLevel(level, difficulty);
  let solution: number[];
  if (difficulty === "hard") {
    solution = createHardSolution(size, level);
  } else {
    const solutions = getValidSolutions(size);
    solution = [...solutions[((level - 1) * 73 + size * 19) % solutions.length]];
  }
  const regions = createRegionMap(size, solution, difficulty === "hard" ? level + 997 : level);
  const row = (level * 3) % size;
  const revealed: RevealedRelic[] = [{ row, col: solution[row] }];

  return {
    size,
    solution,
    regions,
    difficulty,
    revealed,
  };
}

export function createInitialBoard(levelData: LevelData): CellState[][] {
  const board = createEmptyBoard(levelData.size);
  for (const { row, col } of levelData.revealed) board[row][col] = "relic";
  return board;
}

export function isRevealed(levelData: LevelData, row: number, col: number): boolean {
  return levelData.revealed.some((cell) => cell.row === row && cell.col === col);
}

export function hasPlayerRelic(board: CellState[][], levelData: LevelData): boolean {
  return board.some((cells, row) => cells.some((cell, col) => cell === "relic" && !isRevealed(levelData, row, col)));
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

  function search(remaining: number): boolean {
    if (remaining === 0) return true;
    // Solve the most constrained row first, including revealed rows. This keeps
    // hint and dead-end checks responsive on 12x12 boards.
    let row = -1;
    let candidates: number[] = [];
    for (let r = 0; r < size; r += 1) {
      if (result[r] !== -1) continue;
      const fixedCol = fixedByRow.get(r);
      const available: number[] = [];
      for (let col = 0; col < size; col += 1) {
        if (fixedCol !== undefined && col !== fixedCol) continue;
        if (usedColumns.has(col) || usedRegions.has(regions[r][col])) continue;
        if (r > 0 && result[r - 1] >= 0 && Math.abs(result[r - 1] - col) <= 1) continue;
        if (r + 1 < size && result[r + 1] >= 0 && Math.abs(result[r + 1] - col) <= 1) continue;
        available.push(col);
      }
      if (available.length === 0) return false;
      if (row === -1 || available.length < candidates.length) {
        row = r;
        candidates = available;
      }
    }
    for (const col of candidates) {
      const region = regions[row][col];
      usedColumns.add(col);
      usedRegions.add(region);
      result[row] = col;
      if (search(remaining - 1)) return true;
      result[row] = -1;
      usedColumns.delete(col);
      usedRegions.delete(region);
    }
    return false;
  }

  return search(size) ? result : null;
}

// Pencil marks are player notes, not constraints: hints can correct a mistaken X.
export function toggleMark(board: CellState[][], row: number, col: number): CellState[][] {
  const next = cloneBoard(board);
  if (next[row][col] !== "relic") {
    next[row][col] = next[row][col] === "marked" ? "empty" : "marked";
  }
  return next;
}

// Only player-created notes are rendered as X marks.
export function getVisibleMark(
  board: CellState[][],
  row: number,
  col: number,
): "manual" | null {
  return board[row][col] === "marked" ? "manual" : null;
}
