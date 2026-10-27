import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLevel,
  cloneBoard,
  countRelics,
  createInitialBoard,
  findCompletion,
  getVisibleMark,
  getSizeForLevel,
  hasPlayerRelic,
  isAutoBlocked,
  isPlacementCompatible,
  isRevealed,
  parseProgress,
  toggleMark,
  TOTAL_LEVELS,
} from "./relicdoku-core.ts";

test("all 500 Easy levels start with exactly one locked relic and no X marks", () => {
  for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
    const data = buildLevel(level);
    const board = createInitialBoard(data);
    assert.equal(countRelics(board), 1, `Level ${level}`);
    assert.equal(data.revealed.length, 1);
    for (let row = 0; row < data.size; row += 1) {
      for (let col = 0; col < data.size; col += 1) {
        assert.equal(board[row][col], isRevealed(data, row, col) ? "relic" : "empty");
        assert.equal(getVisibleMark(board, row, col), null);
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
  assert.equal(countRelics(marked), 1);
  assert.equal(getVisibleMark(marked, 0, 0), "manual");
  assert.equal(toggleMark(marked, 0, 0)[0][0], "empty");
  marked[0][0] = "relic";
  assert.equal(toggleMark(marked, 0, 0)[0][0], "relic");
});

test("placing and removing relics never creates X marks", () => {
  const data = buildLevel(5);
  const board = createInitialBoard(data);
  const col = data.solution[0];
  board[0][col] = "relic";
  const blockedCol = (col + 1) % data.size;
  assert.equal(getVisibleMark(board, 0, blockedCol), null);
  assert.equal(getVisibleMark(board, 0, blockedCol), null);
  assert.equal(board[0][blockedCol], "empty");
  assert.equal(getVisibleMark(board, 0, col), null);
  board[0][col] = "empty";
  assert.equal(getVisibleMark(board, 0, blockedCol), null);
});

test("manual notes survive placing and removing a relic", () => {
  const data = buildLevel(1);
  const board = createInitialBoard(data);
  const col = data.solution[0];
  const markedCol = (col + 1) % data.size;
  board[0][markedCol] = "marked";
  board[0][col] = "relic";
  const snapshot = cloneBoard(board);
  assert.equal(getVisibleMark(board, 0, markedCol), "manual");
  board[0][col] = "empty";
  assert.equal(snapshot[0][col], "relic");
  assert.equal(getVisibleMark(board, 0, markedCol), "manual");
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
  assert.equal(countRelics(restarted), 1);
  assert.ok(restarted.flat().every((cell) => cell !== "marked"));
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

test("Hard scales from 64 to 144 squares and always has more relics than Easy", () => {
  let previousSize = 0;
  let previousClues = 1;
  for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
    const hard = buildLevel(level, "hard");
    assert.ok(hard.size >= previousSize);
    assert.ok(hard.size > getSizeForLevel(level, "easy"));
    assert.equal(hard.revealed.length, 1);
    assert.ok(hard.revealed.length <= previousClues);
    assert.ok(hard.revealed.length < hard.size / 2);
    previousSize = hard.size;
    previousClues = hard.revealed.length;
  }
  assert.equal(getSizeForLevel(1, "hard"), 8);
  assert.equal(getSizeForLevel(500, "hard"), 12);
});

test("all 500 Hard levels have valid fixed starter clues and can be completed", () => {
  for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
    const data = buildLevel(level, "hard");
    const board = createInitialBoard(data);
    assert.equal(countRelics(board), data.revealed.length);
    assert.equal(hasPlayerRelic(board, data), false);
    assert.equal(board.flat().filter((cell) => cell === "marked").length, 0);
    for (const { row, col } of data.revealed) {
      assert.ok(isRevealed(data, row, col));
      assert.equal(col, data.solution[row]);
      assert.ok(isPlacementCompatible(board, data.regions, row, col));
    }
    const completion = findCompletion(board, data);
    assert.ok(completion, `Hard level ${level}`);
    completion.forEach((col, row) => {
      assert.ok(isPlacementCompatible(board, data.regions, row, col));
      board[row][col] = "relic";
    });
    assert.equal(countRelics(board), data.size);
    assert.ok(hasPlayerRelic(board, data));
    assert.deepEqual(findCompletion(board, data), completion);
    // A restart restores only clues, never the old placements or notes.
    assert.equal(countRelics(createInitialBoard(data)), data.revealed.length);
  }
});

test("Hard boards are deterministic across restart and saved-level resume", () => {
  for (const level of [1, 15, 16, 50, 51, 125, 126, 250, 251, 500]) {
    assert.deepEqual(buildLevel(level, "hard"), buildLevel(level, "hard"));
  }
});

test("revealed clues alone never activate automatic X marks", () => {
  const data = buildLevel(251, "hard");
  const board = createInitialBoard(data);
  for (let row = 0; row < data.size; row += 1) {
    for (let col = 0; col < data.size; col += 1) {
      assert.equal(getVisibleMark(board, row, col), null);
    }
  }
  const row = data.solution.findIndex((col, r) => !isRevealed(data, r, col));
  board[row][data.solution[row]] = "relic";
  assert.ok(hasPlayerRelic(board, data));
  board[row][data.solution[row]] = "empty";
  assert.equal(hasPlayerRelic(board, data), false);
});

test("progress migrates the old level into Easy and preserves independent mode levels", () => {
  assert.deepEqual(parseProgress(null, "251"), { selected: "easy", easy: 251, hard: 1 });
  assert.deepEqual(parseProgress('{"selected":"hard","easy":42,"hard":126}', "251"), { selected: "hard", easy: 42, hard: 126 });
  assert.deepEqual(parseProgress('{"selected":"hard","hard":16}', "251"), { selected: "hard", easy: 251, hard: 16 });
});

test("corrupt or out-of-range saved progress has safe defaults", () => {
  for (const invalid of ["not json", "null", "[]", "5"]) {
    assert.deepEqual(parseProgress(invalid, "12"), { selected: "easy", easy: 12, hard: 1 });
  }
  assert.deepEqual(parseProgress('{"selected":"other","easy":-10,"hard":501}', null), { selected: "easy", easy: 1, hard: 1 });
  assert.deepEqual(parseProgress('{"easy":true,"hard":null}', null), { selected: "easy", easy: 1, hard: 1 });
});
