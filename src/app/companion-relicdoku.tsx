import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type CellState = "empty" | "relic";

type LevelData = {
  size: number;
  solution: number[];
  regions: number[][];
  locked: Set<string>;
  difficulty: string;
  relicIndex: number;
};

const TOTAL_LEVELS = 500;
const PROGRESS_KEY = "@missiontrails/relicdoku-level-v2";

const REGION_COLORS = [
  "#6C3BA8",
  "#2F83C8",
  "#D88736",
  "#35A98C",
  "#B94E9E",
  "#6872D8",
  "#B76052",
  "#4E9C4B",
];

const RELICS = [
  {
    name: "Ancient Compass",
    image: require("../../assets/images/relicsIcons/ancientmagicalcompass.png"),
  },
  {
    name: "Nebula Crystal",
    image: require("../../assets/images/relicsIcons/nebulacrystal.png"),
  },
  {
    name: "Forgotten Idol",
    image: require("../../assets/images/relicsIcons/forgottenidol.png"),
  },
  {
    name: "Storm Core",
    image: require("../../assets/images/relicsIcons/stormcoreelement.png"),
  },
  {
    name: "Lunar Tablet",
    image: require("../../assets/images/relicsIcons/lunartabletcollectible.png"),
  },
  {
    name: "Phoenix Ember",
    image: require("../../assets/images/relicsIcons/phoenixembercrystal.png"),
  },
  {
    name: "Cosmic Shard",
    image: require("../../assets/images/relicsIcons/cosmicshard.png"),
  },
  {
    name: "Oracle Eye",
    image: require("../../assets/images/relicsIcons/mysticaloracleeye.png"),
  },
  {
    name: "Magma Crown",
    image: require("../../assets/images/relicsIcons/magmacrown.png"),
  },
  {
    name: "Star Fragment",
    image: require("../../assets/images/relicsIcons/starfragment.png"),
  },
  {
    name: "Fossil Fang",
    image: require("../../assets/images/relicsIcons/fossilfang.png"),
  },
  {
    name: "Solar Relic",
    image: require("../../assets/images/relicsIcons/radiantsolarsun.png"),
  },
];

const solutionCache = new Map<number, number[][]>();

function createEmptyBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => "empty" as CellState),
  );
}

function cloneBoard(board: CellState[][]): CellState[][] {
  return board.map((row) => [...row]);
}

function countRelics(board: CellState[][]): number {
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

function buildLevel(level: number): LevelData {
  const size = getSizeForLevel(level);
  const solutions = getValidSolutions(size);

  const solutionIndex = ((level - 1) * 73 + size * 19) % solutions.length;

  const solution = [...solutions[solutionIndex]];
  const regions = createRegionMap(size, solution, level);

  const locked = new Set<string>();

  const lockedCount = level <= 3 ? 2 : level <= 15 ? 1 : 0;

  if (lockedCount >= 1) {
    const row = (level * 3) % size;
    locked.add(`${row}-${solution[row]}`);
  }

  if (lockedCount >= 2) {
    const firstRow = (level * 3) % size;
    let secondRow = (firstRow + Math.max(2, Math.floor(size / 2))) % size;

    if (secondRow === firstRow) {
      secondRow = (firstRow + 1) % size;
    }

    locked.add(`${secondRow}-${solution[secondRow]}`);
  }

  return {
    size,
    solution,
    regions,
    locked,
    difficulty: getDifficulty(size),
    relicIndex: (level - 1) % RELICS.length,
  };
}

function createInitialBoard(levelData: LevelData): CellState[][] {
  const board = createEmptyBoard(levelData.size);

  for (const key of levelData.locked) {
    const [rowText, colText] = key.split("-");
    const row = Number(rowText);
    const col = Number(colText);

    if (
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      board[row]?.[col] !== undefined
    ) {
      board[row][col] = "relic";
    }
  }

  return board;
}

function isPlacementCompatible(
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

function isAutoBlocked(
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

function findCompletion(
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

export default function CompanionRelicdokuScreen() {
  const router = useRouter();

  const [level, setLevel] = useState(1);
  const levelData = useMemo(() => buildLevel(level), [level]);

  const [board, setBoard] = useState<CellState[][]>(() =>
    createInitialBoard(buildLevel(1)),
  );

  const [lives, setLives] = useState(3);
  const [history, setHistory] = useState<CellState[][][]>([]);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState(
    "Tap an open square to place the relic. X marks appear automatically.",
  );

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLevel = useCallback((nextLevel: number) => {
    const safeLevel = Math.min(TOTAL_LEVELS, Math.max(1, nextLevel));

    const nextData = buildLevel(safeLevel);

    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }

    if (failTimer.current) {
      clearTimeout(failTimer.current);
      failTimer.current = null;
    }

    setLevel(safeLevel);
    setBoard(createInitialBoard(nextData));
    setLives(3);
    setHistory([]);
    setCompleted(false);
    setMessage(
      "Tap an open square to place the relic. X marks appear automatically.",
    );
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(PROGRESS_KEY);
        const savedLevel = Number(stored);

        if (
          active &&
          Number.isInteger(savedLevel) &&
          savedLevel >= 1 &&
          savedLevel <= TOTAL_LEVELS
        ) {
          startLevel(savedLevel);
        }
      } catch (error) {
        console.warn("Could not load Relicdoku progress:", error);
      }
    })();

    return () => {
      active = false;

      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }

      if (failTimer.current) {
        clearTimeout(failTimer.current);
      }
    };
  }, [startLevel]);

  const activeRelic = RELICS[levelData.relicIndex];

  function isLocked(row: number, col: number): boolean {
    return levelData.locked.has(`${row}-${col}`);
  }

  function saveHistory(currentBoard: CellState[][]) {
    setHistory((current) => [...current.slice(-19), cloneBoard(currentBoard)]);
  }

  function finishLevel() {
    if (completed) {
      return;
    }

    setCompleted(true);

    if (level >= TOTAL_LEVELS) {
      setMessage(`You cleared all ${TOTAL_LEVELS} Relicdoku levels.`);

      void AsyncStorage.setItem(PROGRESS_KEY, String(TOTAL_LEVELS));

      return;
    }

    const nextLevel = level + 1;

    setMessage(`Level ${level} complete! Loading Level ${nextLevel}...`);

    void AsyncStorage.setItem(PROGRESS_KEY, String(nextLevel));

    advanceTimer.current = setTimeout(() => {
      startLevel(nextLevel);
    }, 900);
  }

  function handleCellPress(row: number, col: number) {
    if (completed || lives <= 0) {
      return;
    }

    if (isLocked(row, col)) {
      setMessage("That relic is locked in place.");
      return;
    }

    if (board[row][col] === "relic") {
      saveHistory(board);

      const next = cloneBoard(board);
      next[row][col] = "empty";

      setBoard(next);
      setMessage("Relic removed.");
      return;
    }

    if (isAutoBlocked(board, levelData.regions, row, col)) {
      setMessage(
        "That square is already blocked by a row, column, territory, or nearby relic.",
      );
      return;
    }

    const next = cloneBoard(board);
    next[row][col] = "relic";

    const completion = findCompletion(next, levelData);

    if (!completion) {
      const nextLives = Math.max(0, lives - 1);
      setLives(nextLives);

      if (nextLives === 0) {
        setMessage("No hearts left. Restarting this level...");

        failTimer.current = setTimeout(() => {
          startLevel(level);
        }, 900);
      } else {
        setMessage(
          `That move creates a dead end. ${nextLives} ${
            nextLives === 1 ? "heart" : "hearts"
          } left.`,
        );
      }

      return;
    }

    saveHistory(board);
    setBoard(next);

    const relicCount = countRelics(next);

    if (relicCount === levelData.size) {
      finishLevel();
      return;
    }

    setMessage(`${relicCount} of ${levelData.size} relics placed. Keep going.`);
  }

  function useHint() {
    if (completed || lives <= 0) {
      return;
    }

    const completion = findCompletion(board, levelData);

    if (!completion) {
      setMessage("This board has no valid completion. Undo your last move.");
      return;
    }

    for (let row = 0; row < levelData.size; row += 1) {
      const col = completion[row];

      if (board[row][col] === "relic") {
        continue;
      }

      saveHistory(board);

      const next = cloneBoard(board);
      next[row][col] = "relic";

      setBoard(next);

      const relicCount = countRelics(next);

      if (relicCount === levelData.size) {
        finishLevel();
      } else {
        setMessage(`Hint placed one safe ${activeRelic.name}.`);
      }

      return;
    }
  }

  function undo() {
    if (completed) {
      return;
    }

    if (history.length === 0) {
      setMessage("Nothing to undo.");
      return;
    }

    const previous = history[history.length - 1];

    setBoard(cloneBoard(previous));
    setHistory((current) => current.slice(0, -1));
    setMessage("Previous move restored.");
  }

  function restart() {
    startLevel(level);
  }

  function regionBorders(row: number, col: number) {
    const region = levelData.regions[row][col];

    return {
      borderTopWidth:
        row === 0 || levelData.regions[row - 1][col] !== region ? 3 : 0.5,

      borderBottomWidth:
        row === levelData.size - 1 || levelData.regions[row + 1][col] !== region
          ? 3
          : 0.5,

      borderLeftWidth:
        col === 0 || levelData.regions[row][col - 1] !== region ? 3 : 0.5,

      borderRightWidth:
        col === levelData.size - 1 || levelData.regions[row][col + 1] !== region
          ? 3
          : 0.5,
    };
  }

  const relicImageSize =
    levelData.size >= 8
      ? 27
      : levelData.size === 7
        ? 30
        : levelData.size === 6
          ? 34
          : 39;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={29} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Relicdoku</Text>

            <Text style={styles.levelText}>
              LEVEL {level} / {TOTAL_LEVELS}
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.relicBanner}>
          <Image
            source={activeRelic.image}
            resizeMode="contain"
            style={styles.bannerRelic}
          />

          <View style={styles.relicBannerCopy}>
            <Text style={styles.relicBannerLabel}>THIS LEVEL'S RELIC</Text>

            <Text style={styles.relicBannerName}>{activeRelic.name}</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>DIFFICULTY</Text>

            <Text style={styles.statusValue}>{levelData.difficulty}</Text>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>HEARTS</Text>

            <View style={styles.heartsRow}>
              {[0, 1, 2].map((heart) => (
                <Ionicons
                  key={heart}
                  name={heart < lives ? "heart" : "heart-outline"}
                  size={15}
                  color={heart < lives ? "#FF6B85" : "#766D7B"}
                />
              ))}
            </View>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>RELICS</Text>

            <Text style={styles.statusValue}>
              {countRelics(board)} / {levelData.size}
            </Text>
          </View>
        </View>

        <View style={styles.board}>
          {board.map((rowCells, row) => (
            <View key={`row-${row}`} style={styles.boardRow}>
              {rowCells.map((cell, col) => {
                const region = levelData.regions[row][col];

                const locked = isLocked(row, col);

                const blocked =
                  cell !== "relic" &&
                  isAutoBlocked(board, levelData.regions, row, col);

                return (
                  <Pressable
                    key={`${row}-${col}`}
                    onPress={() => handleCellPress(row, col)}
                    disabled={completed || blocked}
                    style={[
                      styles.cell,
                      {
                        backgroundColor:
                          REGION_COLORS[region % REGION_COLORS.length],
                      },
                      regionBorders(row, col),
                      blocked && styles.blockedCell,
                    ]}
                  >
                    {blocked && <Text style={styles.autoX}>×</Text>}

                    {cell === "relic" && (
                      <View
                        style={[
                          styles.relicContainer,
                          locked && styles.lockedRelicContainer,
                        ]}
                      >
                        <Image
                          source={activeRelic.image}
                          resizeMode="contain"
                          style={{
                            width: relicImageSize,
                            height: relicImageSize,
                          }}
                        />

                        {locked && (
                          <View style={styles.lockIndicator}>
                            <Ionicons
                              name="lock-closed"
                              size={8}
                              color="#05000B"
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View
          style={[styles.messageCard, completed && styles.messageCardComplete]}
        >
          <Ionicons
            name={completed ? "checkmark-circle" : "information-circle-outline"}
            size={20}
            color={completed ? "#70F2A0" : "#62E7FF"}
          />

          <Text style={styles.messageText}>{message}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            style={styles.controlButton}
            onPress={useHint}
            disabled={completed}
          >
            <Ionicons name="bulb-outline" size={20} color="#FFFFFF" />

            <Text style={styles.controlText}>Hint</Text>
          </Pressable>

          <Pressable
            style={styles.controlButton}
            onPress={undo}
            disabled={completed}
          >
            <Ionicons name="arrow-undo-outline" size={20} color="#FFFFFF" />

            <Text style={styles.controlText}>Undo</Text>
          </Pressable>

          <Pressable style={styles.controlButton} onPress={restart}>
            <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />

            <Text style={styles.controlText}>Restart</Text>
          </Pressable>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>HOW TO PLAY</Text>

          <Rule
            number="1"
            text="Tap an open square to place the Mission Trails relic. Tap your relic again to remove it."
          />

          <Rule
            number="2"
            text="Place exactly one relic in every row, column, and colored territory."
          />

          <Rule number="3" text="Relics cannot touch, including diagonally." />

          <Rule
            number="4"
            text="You do not place X marks anymore. Impossible squares are marked automatically."
          />

          <Rule
            number="5"
            text="Finish the board and the next level starts automatically."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Rule({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.ruleRow}>
      <View style={styles.ruleNumber}>
        <Text style={styles.ruleNumberText}>{number}</Text>
      </View>

      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#05000B",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 50,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
  },

  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#5D246D",
    backgroundColor: "#11051A",
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
  },

  levelText: {
    color: "#B94EFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 3,
  },

  headerSpacer: {
    width: 48,
  },

  relicBanner: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: "#4C245A",
    backgroundColor: "#0E0515",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 8,
  },

  bannerRelic: {
    width: 54,
    height: 54,
  },

  relicBannerCopy: {
    flex: 1,
    marginLeft: 12,
  },

  relicBannerLabel: {
    color: "#8E8296",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  relicBannerName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },

  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 18,
  },

  statusBox: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#43204E",
    backgroundColor: "#0E0515",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  statusLabel: {
    color: "#877C8F",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
  },

  statusValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },

  heartsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 5,
  },

  board: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#08020E",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#BE4CFF",
  },

  boardRow: {
    flex: 1,
    flexDirection: "row",
  },

  cell: {
    flex: 1,
    borderColor: "#09000E",
    alignItems: "center",
    justifyContent: "center",
  },

  blockedCell: {
    opacity: 0.56,
  },

  autoX: {
    position: "absolute",
    color: "rgba(255,255,255,0.52)",
    fontSize: 24,
    fontWeight: "500",
  },

  relicContainer: {
    position: "relative",
    minWidth: 42,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: "rgba(5,0,11,0.62)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },

  lockedRelicContainer: {
    borderColor: "#FFD76A",
  },

  lockIndicator: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#FFD76A",
    alignItems: "center",
    justifyContent: "center",
  },

  messageCard: {
    minHeight: 58,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#244D5D",
    backgroundColor: "#071B24",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
  },

  messageCardComplete: {
    borderColor: "#2B6E4B",
    backgroundColor: "#082016",
  },

  messageText: {
    flex: 1,
    color: "#D0EAF0",
    fontSize: 11,
    lineHeight: 16,
  },

  controls: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  controlButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#50215E",
    backgroundColor: "#12061B",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  controlText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  rulesCard: {
    marginTop: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#482054",
    backgroundColor: "#0D0415",
    padding: 16,
    gap: 12,
  },

  rulesTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 2,
  },

  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  ruleNumber: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#56217D",
    alignItems: "center",
    justifyContent: "center",
  },

  ruleNumberText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  ruleText: {
    flex: 1,
    color: "#B7ACBD",
    fontSize: 10,
    lineHeight: 15,
  },
});
