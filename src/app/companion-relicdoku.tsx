import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import {
  buildLevel,
  cloneBoard,
  countRelics,
  createInitialBoard,
  findCompletion,
  getVisibleMark,
  isAutoBlocked,
  toggleMark,
  TOTAL_LEVELS,
} from "../utils/relicdoku-core";
import type { CellState } from "../utils/relicdoku-core";

const PROGRESS_KEY = "@missiontrails/relicdoku-level-v2";
const START_MESSAGE = "Your board is clear. Tap a square to place a relic.";
type InputMode = "relic" | "marked";

const REGION_COLORS = [
  "#C8ADF0",
  "#9FCEF3",
  "#F8C68C",
  "#99DCC6",
  "#F2ACCB",
  "#B5BDF3",
  "#F0A89A",
  "#C2DD96",
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

export default function CompanionRelicdokuScreen() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<InputMode>("relic");
  const [autoMark, setAutoMark] = useState(false);
  const [level, setLevel] = useState(1);
  const levelData = useMemo(() => buildLevel(level), [level]);

  const [board, setBoard] = useState<CellState[][]>(() =>
    createInitialBoard(buildLevel(1)),
  );

  const [lives, setLives] = useState(3);
  const [history, setHistory] = useState<CellState[][][]>([]);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState(START_MESSAGE);

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
    setMode("relic");
    setMessage(START_MESSAGE);
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
      } finally {
        if (active) setReady(true);
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

  const activeRelic = RELICS[(level - 1) % RELICS.length];
  const interactionDisabled = !ready || completed || lives <= 0;

  function saveProgress(nextLevel: number) {
    void AsyncStorage.setItem(PROGRESS_KEY, String(nextLevel)).catch((error) => {
      console.warn("Could not save Relicdoku progress:", error);
    });
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

      saveProgress(TOTAL_LEVELS);

      return;
    }

    const nextLevel = level + 1;

    setMessage(`Level ${level} complete! Loading Level ${nextLevel}...`);

    saveProgress(nextLevel);

    advanceTimer.current = setTimeout(() => {
      startLevel(nextLevel);
    }, 900);
  }

  function handleCellPress(row: number, col: number) {
    if (interactionDisabled) {
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

    if (mode === "marked") {
      const next = toggleMark(board, row, col);
      saveHistory(board);
      setBoard(next);
      setMessage(next[row][col] === "marked" ? "Square marked. Tap it again to erase the X." : "X erased.");
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
    if (interactionDisabled) {
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
    if (interactionDisabled) {
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
      borderTopWidth: row === 0 ? 2 : 0,
      borderLeftWidth: col === 0 ? 2 : 0,
      borderBottomWidth:
        row === levelData.size - 1 || levelData.regions[row + 1][col] !== region ? 2 : 0.5,
      borderRightWidth:
        col === levelData.size - 1 || levelData.regions[row][col + 1] !== region ? 2 : 0.5,
    };
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to companion" style={styles.backButton} onPress={() => router.back()}>
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

        <View style={styles.board} testID="relicdoku-board">
          {board.map((rowCells, row) => (
            <View key={row} style={styles.boardRow}>
              {rowCells.map((cell, col) => {
                const region = levelData.regions[row][col];
                const mark = getVisibleMark(board, levelData.regions, row, col, autoMark);
                const cellLabel = cell === "relic" ? activeRelic.name
                  : mark === "manual" ? "marked X"
                  : mark === "auto" ? "automatically excluded" : "empty";
                return (
                  <Pressable
                    key={col}
                    testID={`relicdoku-cell-${row}-${col}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Row ${row + 1}, column ${col + 1}, territory ${region + 1}, ${cellLabel}`}
                    accessibilityHint={mode === "marked" ? "Tap to add or erase an X. Tap a relic to remove it." : "Tap to place or remove a relic."}
                    onPress={() => handleCellPress(row, col)}
                    disabled={interactionDisabled}
                    style={[
                      styles.cell,
                      { backgroundColor: REGION_COLORS[region % REGION_COLORS.length] },
                      regionBorders(row, col),
                    ]}
                  >
                    {mark && <Text style={[styles.markX, mark === "auto" && styles.automaticMark]}>×</Text>}
                    {cell === "relic" && (
                      <View style={styles.relicContainer}>
                        <Image
                          source={activeRelic.image}
                          resizeMode="contain"
                          style={styles.cellRelic}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Place relic"
            accessibilityState={{ selected: mode === "relic", disabled: interactionDisabled }}
            disabled={interactionDisabled}
            style={[styles.modeButton, mode === "relic" && styles.modeButtonActive]}
            onPress={() => {
              setMode("relic");
              setMessage("Tap a square to place a relic. Tap a placed relic to remove it.");
            }}
          >
            <Image source={activeRelic.image} resizeMode="contain" style={styles.modeRelic} />
            <Text style={styles.modeText}>Place relic</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark X"
            accessibilityState={{ selected: mode === "marked", disabled: interactionDisabled }}
            disabled={interactionDisabled}
            style={[styles.modeButton, mode === "marked" && styles.modeButtonActive]}
            onPress={() => {
              setMode("marked");
              setMessage("Tap squares to add or erase X notes. Marking never costs a heart.");
            }}
          >
            <Ionicons name="close" size={23} color="#EDE4FA" />
            <Text style={styles.modeText}>Mark X</Text>
          </Pressable>
        </View>

        <View style={styles.autoMarkRow}>
          <View style={styles.autoMarkCopy}>
            <Text style={styles.autoMarkTitle}>Auto X</Text>
            <Text style={styles.autoMarkDescription}>Mark blocked squares after you place a relic</Text>
          </View>
          <Switch
            accessibilityLabel="Auto X"
            value={autoMark}
            disabled={interactionDisabled}
            onValueChange={setAutoMark}
            trackColor={{ false: "#3E344A", true: "#8455B8" }}
            thumbColor="#F8F2FF"
          />
        </View>

        <View
          style={[styles.messageCard, completed && styles.messageCardComplete]}
        >
          <Ionicons
            name={completed ? "checkmark-circle" : "information-circle-outline"}
            size={20}
            color={completed ? "#70F2A0" : "#62E7FF"}
          />

          <Text accessibilityLiveRegion="polite" style={styles.messageText}>{ready ? message : "Loading your level..."}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hint"
            style={styles.controlButton}
            onPress={useHint}
            disabled={interactionDisabled}
          >
            <Ionicons name="bulb-outline" size={20} color="#FFFFFF" />

            <Text style={styles.controlText}>Hint</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            style={styles.controlButton}
            onPress={undo}
            disabled={interactionDisabled}
          >
            <Ionicons name="arrow-undo-outline" size={20} color="#FFFFFF" />

            <Text style={styles.controlText}>Undo</Text>
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel="Restart" style={styles.controlButton} onPress={restart} disabled={!ready}>
            <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />

            <Text style={styles.controlText}>Restart</Text>
          </Pressable>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>HOW TO PLAY</Text>

          <Rule
            number="1"
            text="Choose Place relic to place or remove a relic. Choose Mark X to add or erase a note."
          />

          <Rule
            number="2"
            text="Place exactly one relic in every row, column, and colored territory."
          />

          <Rule number="3" text="Relics cannot touch, including diagonally." />

          <Rule
            number="4"
            text="X marks are optional. Turn on Auto X for help eliminating squares after you place a relic."
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
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    paddingHorizontal: 16,
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
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E3D6F6",
  },

  boardRow: {
    flex: 1,
    flexDirection: "row",
  },

  cell: {
    flex: 1,
    borderColor: "#342B45",
    minWidth: 0,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  markX: {
    color: "#342B45",
    fontSize: 26,
    fontWeight: "600",
  },

  automaticMark: {
    color: "rgba(52,43,69,0.45)",
  },

  relicContainer: {
    width: "82%",
    height: "82%",
    maxWidth: 64,
    maxHeight: 64,
    alignItems: "center",
    justifyContent: "center",
  },

  cellRelic: {
    width: "100%",
    height: "100%",
  },

  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  modeButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#43314F",
    backgroundColor: "#160D20",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  modeButtonActive: {
    borderColor: "#D2A4FF",
    backgroundColor: "#573078",
  },

  modeRelic: {
    width: 27,
    height: 27,
  },

  modeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  autoMarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    marginTop: 12,
  },

  autoMarkCopy: {
    flex: 1,
  },

  autoMarkTitle: {
    color: "#EDE4FA",
    fontSize: 12,
    fontWeight: "700",
  },

  autoMarkDescription: {
    color: "#AFA2BC",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
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

