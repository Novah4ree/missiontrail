import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLevel,
  cloneBoard,
  countRelics,
  createInitialBoard,
  findCompletion,
  getVisibleMark,
  isAutoBlocked,
  isPlacementCompatible,
  toggleMark,
  TOTAL_LEVELS,
} from "./relicdoku-core.ts";

test("all 500 levels start empty, including the former starter-clue levels", () => {
  for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
    const data = buildLevel(level);
    const board = createInitialBoard(data);
    assert.equal(countRelics(board), 0, `Level ${level}`);
    for (let row = 0; row < data.size; row += 1) {
      for (let col = 0; col < data.size; col += 1) {
        assert.equal(board[row][col], "empty");
        // Even a player who kept Auto X on must see a clean new board.
        assert.equal(getVisibleMark(board, data.regions, row, col, true), null);
        assert.equal(isAutoBlocked(board, data.regions, row, col), false);
      }
    }
  }
});

test("every level can still be completed from a clean board under all three rules", () => {
  for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
    const data = buildLevel(level);
    const board = createInitialBoard(data);
    const solution = findCompletion(board, data);
    assert.ok(solution, `Level ${level} needs a completion without starter clues`);
    const columns = new Set<number>();
    const regions = new Set<number>();
    solution.forEach((col, row) => {
      assert.ok(isPlacementCompatible(board, data.regions, row, col));
      assert.ok(!columns.has(col));
      assert.ok(!regions.has(data.regions[row][col]));
      if (row > 0) assert.ok(Math.abs(solution[row - 1] - col) > 1);
      columns.add(col);
      regions.add(data.regions[row][col]);
      board[row][col] = "relic";
    });
    assert.equal(countRelics(board), data.size);
    assert.deepEqual(findCompletion(board, data), solution);
  }
});

test("manual X notes toggle without changing relics or the previous undo snapshot", () => {
  const data = buildLevel(1);
  const original = createInitialBoard(data);
  const marked = toggleMark(original, 0, 0);
  assert.equal(original[0][0], "empty");
  assert.equal(marked[0][0], "marked");
  assert.equal(countRelics(marked), 0);
  assert.equal(getVisibleMark(marked, data.regions, 0, 0, false), "manual");
  assert.equal(toggleMark(marked, 0, 0)[0][0], "empty");
  marked[0][0] = "relic";
  assert.equal(toggleMark(marked, 0, 0)[0][0], "relic");
});

test("Auto X is opt-in and disappears when the blocking relic is removed", () => {
  const data = buildLevel(5);
  const board = createInitialBoard(data);
  const col = data.solution[0];
  board[0][col] = "relic";
  const blockedCol = (col + 1) % data.size;
  assert.equal(getVisibleMark(board, data.regions, 0, blockedCol, false), null);
  assert.equal(getVisibleMark(board, data.regions, 0, blockedCol, true), "auto");
  assert.equal(board[0][blockedCol], "empty");
  assert.equal(getVisibleMark(board, data.regions, 0, col, true), null);
  board[0][col] = "empty";
  assert.equal(getVisibleMark(board, data.regions, 0, blockedCol, true), null);
});

test("manual notes survive automatic exclusions and removing the relic", () => {
  const data = buildLevel(1);
  const board = createInitialBoard(data);
  const col = data.solution[0];
  const markedCol = (col + 1) % data.size;
  board[0][markedCol] = "marked";
  board[0][col] = "relic";
  const snapshot = cloneBoard(board);
  assert.equal(getVisibleMark(board, data.regions, 0, markedCol, true), "manual");
  board[0][col] = "empty";
  assert.equal(snapshot[0][col], "relic");
  assert.equal(getVisibleMark(board, data.regions, 0, markedCol, false), "manual");
});

test("incorrect pencil marks never make a solvable puzzle fail or prevent a hint", () => {
  const data = buildLevel(19);
  const board = createInitialBoard(data).map((row) => row.map(() => "marked" as const));
  assert.ok(findCompletion(board, data));
  assert.equal(countRelics(board), 0);
});

test("restart creates an independent clean board after notes and relic placements", () => {
  const data = buildLevel(15);
  const old = createInitialBoard(data);
  old[0][data.solution[0]] = "relic";
  old[1][0] = "marked";
  const restarted = createInitialBoard(data);
  assert.ok(restarted.flat().every((cell) => cell === "empty"));
  assert.equal(old[0][data.solution[0]], "relic");
});

test("solver rejects conflicting relics while ignoring pencil notes", () => {
  const data = buildLevel(5);
  const board = createInitialBoard(data);
  board[0][0] = "relic";
  board[0][1] = "relic";
  assert.equal(findCompletion(board, data), null);
  board[0][1] = "marked";
  board[1][0] = "relic";
  assert.equal(findCompletion(board, data), null);
  board[1][0] = "empty";
  board[1][1] = "relic";
  assert.equal(findCompletion(board, data), null);
});
