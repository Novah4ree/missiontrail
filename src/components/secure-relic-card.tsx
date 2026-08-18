import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  Vibration,
  View,
} from "react-native";

import type { ReturnTypeOfSecureRelicField } from "@/types/secure-relic-hook";

const HAPTICS_KEY = "mission-trail:relic-haptics:v1";
const SOUNDS_KEY = "mission-trail:relic-sounds:v1";

export function SecureRelicCard({
  field,
  navigationDirection = null,
  navigationBearing = null,
  expanded,
  onExpandedChange,
}: {
  field: ReturnTypeOfSecureRelicField;
  navigationDirection?: string | null;
  navigationBearing?: number | null;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [internalShowDetails, setInternalShowDetails] = useState(false);

  const showDetails = expanded ?? internalShowDetails;

  function toggleDetails() {
    const next = !showDetails;

    if (expanded === undefined) {
      setInternalShowDetails(next);
    }

    onExpandedChange?.(next);
  }

  const previousClueStrength = useRef(field.clueStrength);
  const previousStatus = useRef(field.status);

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(HAPTICS_KEY),
      AsyncStorage.getItem(SOUNDS_KEY),
    ]).then(([haptics, sounds]) => {
      setHapticsEnabled(haptics === "true");
      setSoundsEnabled(sounds === "true");
    });
  }, []);

  useEffect(() => {
    if (field.clueStrength === previousClueStrength.current) return;

    previousClueStrength.current = field.clueStrength;

    if (field.clueStrength < 1) return;

    if (hapticsEnabled) {
      Vibration.vibrate(10 + field.clueStrength * 12);
    }

    if (soundsEnabled) {
      Speech.speak(
        ["Faint clue", "Faint clue", "Getting warmer", "Very close"][
          field.clueStrength
        ],
        {
          pitch: 1.12,
          rate: 1.05,
        },
      );
    }
  }, [field.clueStrength, hapticsEnabled, soundsEnabled]);

  useEffect(() => {
    if (field.status === previousStatus.current) return;

    previousStatus.current = field.status;

    if (field.status !== "revealed" && field.status !== "collected") return;

    if (hapticsEnabled) {
      Vibration.vibrate(field.status === "collected" ? [0, 30, 45, 50] : 45);
    }

    if (soundsEnabled) {
      Speech.speak(
        field.status === "collected"
          ? "Added to your Vault!"
          : "You found a relic!",
      );
    }
  }, [field.status, hapticsEnabled, soundsEnabled]);

  function setHaptics(value: boolean) {
    setHapticsEnabled(value);
    void AsyncStorage.setItem(HAPTICS_KEY, String(value));
  }

  function setSounds(value: boolean) {
    setSoundsEnabled(value);
    void AsyncStorage.setItem(SOUNDS_KEY, String(value));
  }

  const isRevealed = Boolean(field.revealed);

  const canCollect =
    isRevealed && field.freshFinalReadingCount >= 2 && !field.isBusy;

  const showRetry =
    field.status === "offline_retry" || field.status === "expired";

  // Remember the last real relic bearing.
  // GPS can lose a usable bearing when the player reaches 0 FT,
  // but we still want the hunt card to show the last direction.
  const lastBearingDegrees = useRef<number | null>(field.bearingDegrees);

  useEffect(() => {
    const nextBearing = field.bearingDegrees ?? navigationBearing;

    // Temporary GPS/server nulls must never erase a valid direction.
    if (nextBearing !== null) {
      lastBearingDegrees.current = nextBearing;
    }
  }, [field.bearingDegrees, navigationBearing]);

  const effectiveBearingDegrees =
    field.bearingDegrees ?? navigationBearing ?? lastBearingDegrees.current;

  // Prefer the precise numeric bearing when available.
  // If the server only gives us a cardinal direction such as NE,
  // still show useful relic navigation instead of hiding the arrow.
  const rawNavigationDirection =
    navigationDirection ?? field.selectedSignal?.direction ?? null;

  const normalizedDirection = rawNavigationDirection
    ?.trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

  const directionAliases: Record<string, string> = {
    N: "N",
    NORTH: "N",

    NE: "NE",
    NORTHEAST: "NE",

    E: "E",
    EAST: "E",

    SE: "SE",
    SOUTHEAST: "SE",

    S: "S",
    SOUTH: "S",

    SW: "SW",
    SOUTHWEST: "SW",

    W: "W",
    WEST: "W",

    NW: "NW",
    NORTHWEST: "NW",
  };

  const directDirection = normalizedDirection
    ? (directionAliases[normalizedDirection] ?? null)
    : null;

  const validDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  const calculatedDirection =
    directDirection ??
    (effectiveBearingDegrees !== null
      ? getDirection(effectiveBearingDegrees)
      : null);

  // GPS/server updates can briefly return null while the same relic
  // is still selected. Never let that make the arrow disappear.
  const directionTargetRef = useRef<string | null>(
    field.selectedAssignmentId ?? null,
  );

  const lastStableDirectionRef = useRef<string | null>(calculatedDirection);

  const currentTargetId = field.selectedAssignmentId ?? null;

  // A temporary null assignment happens during GPS/server refreshes.
  // Do NOT treat that as a different relic.
  if (
    currentTargetId !== null &&
    directionTargetRef.current !== currentTargetId
  ) {
    // This is an actual new relic target.
    directionTargetRef.current = currentTargetId;
    lastStableDirectionRef.current = calculatedDirection;
  } else if (calculatedDirection) {
    // Same relic: continuously remember the newest valid direction.
    lastStableDirectionRef.current = calculatedDirection;
  }

  // If GPS/server data briefly becomes null, keep showing the
  // last real direction instead of making the UI disappear.
  const direction = calculatedDirection ?? lastStableDirectionRef.current;

  const directionArrows: Record<string, string> = {
    N: "↑",
    NE: "↗",
    E: "→",
    SE: "↘",
    S: "↓",
    SW: "↙",
    W: "←",
    NW: "↖",
  };

  const arrow = direction ? (directionArrows[direction] ?? "→") : "→";

  const signalLevel = isRevealed ? 4 : Math.max(1, field.clueStrength + 1);

  const statusText = getSignalStatus(field.clueStrength, isRevealed);

  return (
    <View style={[styles.card, isRevealed && styles.revealedCard]}>
      {/* TOP ROW */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={18} color="#FF63F7" />

          <Text style={styles.title}>HIDDEN RELICS</Text>
        </View>

        <View style={styles.signalBars}>
          {[1, 2, 3, 4].map((bar) => (
            <View
              key={bar}
              style={[
                styles.signalBar,
                {
                  height: 5 + bar * 4,
                },
                bar <= signalLevel
                  ? styles.signalBarActive
                  : styles.signalBarInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* DISTANCE + RELIC DIRECTION */}
      <View style={styles.navigationRow}>
        <Text style={styles.distanceText}>
          {field.distanceFeet !== null
            ? `${field.distanceFeet.toLocaleString()} FT AWAY`
            : "SEARCHING"}
        </Text>

        {direction ? (
          <>
            <View style={styles.dot} />

            <Text
              accessibilityLabel={`Relic direction ${direction}`}
              style={styles.directionText}
            >
              {arrow} {direction}
            </Text>
          </>
        ) : null}
      </View>

      {/* HUNT STATUS */}
      <View style={styles.statusRow}>
        <Text accessibilityLiveRegion="polite" style={styles.signalStatus}>
          {statusText}
        </Text>

        {field.distanceFeet === null ? (
          <Text
            accessibilityLiveRegion="polite"
            numberOfLines={1}
            style={styles.message}
          >
            {field.message}
          </Text>
        ) : null}
      </View>

      {/* LOCATION VERIFICATION */}

      {/* MAIN ACTION */}
      <View style={styles.actionRow}>
        {isRevealed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter relic encounter"
            accessibilityState={{
              disabled: !canCollect,
              busy: field.isBusy,
            }}
            disabled={!canCollect}
            onPress={() => void field.collect()}
            style={({ pressed }) => [
              styles.encounterButton,
              !canCollect && styles.disabled,
              pressed && canCollect && styles.pressed,
            ]}
          >
            <Ionicons name="flash" size={14} color="#FFFFFF" />

            <Text style={styles.encounterButtonText}>
              {field.isBusy
                ? "VERIFYING..."
                : field.freshFinalReadingCount < 3
                  ? `VERIFYING ${field.freshFinalReadingCount}/3`
                  : "ENTER ENCOUNTER"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan for hidden relic"
            accessibilityState={{
              disabled: field.isBusy,
              busy: field.isBusy,
            }}
            disabled={field.isBusy}
            onPress={() => void field.scan()}
            style={({ pressed }) => [
              styles.encounterButton,
              field.isBusy && styles.disabled,
              pressed && !field.isBusy && styles.pressed,
            ]}
          >
            <Ionicons name="scan" size={15} color="#FFFFFF" />

            <Text style={styles.encounterButtonText}>
              {field.isBusy ? "SCANNING..." : "SCAN FOR RELIC"}
            </Text>
          </Pressable>
        )}

        {showRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try Again"
            disabled={field.isBusy}
            onPress={() => void field.refreshField()}
            style={styles.retryButton}
          >
            <Ionicons name="refresh" size={15} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      {/* DETAILS */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          showDetails ? "Hide relic details" : "Show relic details"
        }
        accessibilityState={{ expanded: showDetails }}
        onPress={toggleDetails}
        style={styles.detailsButton}
      >
        <Text style={styles.detailsText}>Details</Text>

        <Ionicons
          name={showDetails ? "chevron-up" : "chevron-down"}
          size={13}
          color="#BDA8CE"
        />
      </Pressable>

      {showDetails ? (
        <View style={styles.detailsPanel}>
          {field.revealed?.name ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>RELIC</Text>

              <Text style={styles.detailValue}>{field.revealed.name}</Text>
            </View>
          ) : null}

          <View style={styles.effectControls}>
            <View style={styles.effectRow}>
              <Ionicons name="volume-medium" size={14} color="#AFA2BF" />

              <Text style={styles.effectText}>Sounds</Text>

              <Switch
                value={soundsEnabled}
                onValueChange={setSounds}
                trackColor={{
                  false: "#51465A",
                  true: "#7C3AED",
                }}
                style={styles.compactSwitch}
              />
            </View>

            <View style={styles.effectRow}>
              <Ionicons
                name="phone-portrait-outline"
                size={14}
                color="#AFA2BF"
              />

              <Text style={styles.effectText}>Vibration</Text>

              <Switch
                value={hapticsEnabled}
                onValueChange={setHaptics}
                trackColor={{
                  false: "#51465A",
                  true: "#7C3AED",
                }}
                style={styles.compactSwitch}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function getDirection(bearing: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  return directions[Math.round(bearing / 45) % 8];
}

function getDirectionArrow(bearing: number) {
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

  return arrows[Math.round(bearing / 45) % 8];
}

function getSignalStatus(clueStrength: number, revealed: boolean) {
  if (revealed) {
    return "RELIC SIGNAL LOCKED";
  }

  if (clueStrength >= 3) {
    return "YOU'RE VERY CLOSE!";
  }

  if (clueStrength === 2) {
    return "YOU'RE GETTING CLOSER!";
  }

  if (clueStrength === 1) {
    return "SIGNAL DETECTED";
  }

  return "SEARCHING FOR A SIGNAL";
}

const styles = StyleSheet.create({
  card: {
    width: "82%",
    maxWidth: 350,
    alignSelf: "flex-start",

    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.85)",
    borderRadius: 16,

    backgroundColor: "rgba(6, 4, 26, 0.94)",

    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 5,

    shadowColor: "#A855F7",
    shadowOpacity: 0.35,
    shadowRadius: 12,

    elevation: 10,
  },

  revealedCard: {
    borderColor: "#FF63F7",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  signalBars: {
    height: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },

  signalBar: {
    width: 4,
    borderRadius: 3,
  },

  signalBarActive: {
    backgroundColor: "#FF63F7",
  },

  signalBarInactive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",

    marginTop: 5,

    gap: 5,
  },

  distanceText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  directionText: {
    color: "#19D8FF",
    fontSize: 13,
    fontWeight: "900",
  },

  degreeText: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: "800",
  },

  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#775A91",
  },

  statusRow: {
    marginTop: 6,
  },

  signalStatus: {
    color: "#FF63F7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  message: {
    color: "#DAD0E5",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "600",

    marginTop: 2,
  },

  verificationRow: {
    minHeight: 24,

    marginTop: 5,

    flexDirection: "row",
    alignItems: "center",

    gap: 5,
  },

  verificationText: {
    color: "#91EAF5",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  actionRow: {
    marginTop: 6,

    flexDirection: "row",
    alignItems: "center",

    gap: 7,
  },

  encounterButton: {
    flex: 1,

    minHeight: 38,

    borderRadius: 10,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 6,

    backgroundColor: "#7C3AED",

    shadowColor: "#B14FFF",
    shadowOpacity: 0.45,
    shadowRadius: 9,

    elevation: 7,
  },

  encounterButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  retryButton: {
    width: 38,
    height: 38,

    borderRadius: 10,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: "#75578D",

    backgroundColor: "rgba(25, 12, 40, 0.95)",
  },

  disabled: {
    opacity: 0.42,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  detailsButton: {
    minHeight: 26,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 3,

    marginTop: 2,
  },

  detailsText: {
    color: "#BDA8CE",
    fontSize: 9,
    fontWeight: "800",
  },

  detailsPanel: {
    borderTopWidth: 1,
    borderTopColor: "rgba(168,85,247,0.18)",

    paddingTop: 7,
    paddingBottom: 3,

    gap: 7,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailLabel: {
    color: "#897A98",
    fontSize: 8,
    fontWeight: "900",
  },

  detailValue: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  effectControls: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  effectRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 3,
  },

  effectText: {
    color: "#AFA2BF",
    fontSize: 9,
    fontWeight: "700",
  },

  compactSwitch: {
    transform: [{ scale: 0.68 }],
  },
});
