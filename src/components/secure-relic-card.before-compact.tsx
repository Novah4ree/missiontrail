import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";

import type { ReturnTypeOfSecureRelicField } from "@/types/secure-relic-hook";
import { NearbyRelicRadar } from '@/components/nearby-relic-radar';
import { formatRelicSignalDistance } from '@/utils/relic-radar';
import { playRelicHuntStageHaptic } from '@/utils/game-haptics';
import {
  getRelicHuntInstruction,
  getRelicHuntIntensity,
} from '@/utils/relic-hunt';

const HAPTICS_KEY = "mission-trail:relic-haptics:v1";
const SOUNDS_KEY = "mission-trail:relic-sounds:v1";

// Purpose: Renders the secure relic card interface.
export function SecureRelicCard({
  field,
}: {
  field: ReturnTypeOfSecureRelicField;
}) {
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [showClueOptions, setShowClueOptions] = useState(false);
  const reduceMotion = useReducedMotion();
  const previousClueStrength = useRef(field.clueStrength);
  const previousStatus = useRef(field.status);
  const previousHuntStage = useRef(field.huntStage);

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(HAPTICS_KEY),
      AsyncStorage.getItem(SOUNDS_KEY),
    ]).then(([haptics, sounds]) => {
      setHapticsEnabled(haptics !== "false");
      setSoundsEnabled(sounds === "true");
    });
  }, []);

  useEffect(() => {
    if (field.clueStrength === previousClueStrength.current) return;
    previousClueStrength.current = field.clueStrength;
    if (field.clueStrength < 1) return;
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
  }, [field.clueStrength, soundsEnabled]);

  useEffect(() => {
    if (field.huntStage === previousHuntStage.current) return;
    previousHuntStage.current = field.huntStage;
    if (hapticsEnabled) void playRelicHuntStageHaptic(field.huntStage);
  }, [field.huntStage, hapticsEnabled]);

  useEffect(() => {
    if (field.status === previousStatus.current) return;
    previousStatus.current = field.status;
    if (field.status !== "revealed" && field.status !== "collected") return;
    if (soundsEnabled)
      Speech.speak(
        field.status === "collected"
          ? "Added to your Vault!"
          : "You found a relic!",
      );
  }, [field.status, soundsEnabled]);

  // Purpose: Sets haptics.
  function setHaptics(value: boolean) {
    setHapticsEnabled(value);
    void AsyncStorage.setItem(HAPTICS_KEY, String(value));
  }

  // Purpose: Sets sounds.
  function setSounds(value: boolean) {
    setSoundsEnabled(value);
    void AsyncStorage.setItem(SOUNDS_KEY, String(value));
  }

  const isRevealed = Boolean(field.revealed);
  const canCollect =
    isRevealed && field.freshFinalReadingCount >= 3 && !field.isBusy;
  const showRetry =
    field.status === "offline_retry" || field.status === "expired";
  const intensity = getRelicHuntIntensity(field.huntStage);
  const signalBars = Math.max(1, intensity);
  const direction = field.selectedSignal?.direction?.replaceAll('_', ' ') ?? null;
  const stageLabel =
    field.status === 'improving_accuracy'
      ? 'GPS SIGNAL UNSTABLE'
      : field.status === 'invalid_movement'
        ? 'MOVEMENT NOT VERIFIED'
        : field.huntStage.replaceAll('_', ' ');
  const instruction =
    field.status === 'improving_accuracy'
      ? 'MOVE TO AN OPEN AREA AND HOLD STEADY'
      : field.status === 'invalid_movement'
        ? 'KEEP WALKING NATURALLY WHILE GPS RECOVERS'
        : getRelicHuntInstruction(field.huntStage, direction?.toUpperCase() ?? null);
  const huntDistance = field.huntDistanceFeet;
  const accessibilitySummary = [
    `Relic ${stageLabel.toLowerCase()}`,
    huntDistance !== null ? `${formatRelicSignalDistance(huntDistance)} away` : null,
    direction ? direction.toLowerCase() : null,
    instruction.toLowerCase(),
  ].filter(Boolean).join(', ');

  return (
    <View
      accessible
      accessibilityLabel={accessibilitySummary}
      style={[
        styles.card,
        intensity >= 3 && styles.activeCard,
        intensity >= 4 && styles.urgentCard,
        isRevealed && styles.revealedCard,
      ]}
    >
      <View style={styles.titleRow}>
        <Ionicons
          name={
            isRevealed
              ? "sparkles"
              : field.status === "ineligible"
                ? "lock-closed"
                : "help-circle"
          }
          size={17}
          color={isRevealed ? "#FFD76A" : "#B96BFF"}
        />
        <Text style={styles.title}>
          {field.revealed?.name ?? "HIDDEN RELIC"}
        </Text>
      </View>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(260)}
        key={stageLabel}
        style={styles.stagePanel}
      >
        <Text accessibilityLiveRegion="polite" style={styles.stageLabel}>
          {stageLabel}
        </Text>
        {huntDistance !== null ? (
          <Text style={styles.distance}>
            {formatRelicSignalDistance(huntDistance)} AWAY
          </Text>
        ) : null}
        <View style={styles.signalRow} accessibilityLabel={`${signalBars} of 5 signal bars`}>
          {Array.from({ length: 5 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.signalBar,
                { height: 4 + index * 3 },
                index < signalBars && styles.signalBarActive,
                field.huntStage === 'FOUND' && index < signalBars && styles.signalBarFound,
              ]}
            />
          ))}
          <Text style={styles.signalText}>{direction?.toUpperCase() ?? 'SEARCHING'}</Text>
        </View>
        <Text style={styles.instruction}>{instruction}</Text>
        <Text style={styles.gpsLabel}>
          {field.status === 'improving_accuracy' || field.status === 'invalid_movement'
            ? 'GPS VERIFYING · LAST GOOD POSITION HELD'
            : 'GPS VERIFIED · SERVER-GUIDED SIGNAL'}
        </Text>
      </Animated.View>
      {!isRevealed ? <NearbyRelicRadar field={field} /> : null}
      <Text accessibilityLiveRegion="polite" style={styles.message}>
        {field.message}
      </Text>
      {isRevealed ? (
        <Text style={styles.readings}>
          {field.freshFinalReadingCount} of 3 location checks ready
        </Text>
      ) : null}

      <View style={styles.actions}>
        {isRevealed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collect Relic"
            accessibilityHint={
              canCollect
                ? "Adds this relic to your Vault"
                : "Wait for three location checks"
            }
            accessibilityState={{ disabled: !canCollect, busy: field.isBusy }}
            disabled={!canCollect}
            onPress={() => void field.collect()}
            style={[styles.button, !canCollect && styles.disabled]}
          >
            <Text style={styles.buttonText}>
              {field.isBusy ? "Adding…" : "Collect Relic"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find Hidden Relic"
            accessibilityHint="Checks whether a hidden relic is nearby"
            accessibilityState={{ disabled: field.isBusy, busy: field.isBusy }}
            disabled={field.isBusy}
            onPress={() => void field.scan()}
            style={[styles.button, field.isBusy && styles.disabled]}
          >
            <Text style={styles.buttonText}>
              {field.isBusy ? "Searching for relics…" : "Find Hidden Relic"}
            </Text>
          </Pressable>
        )}
        {showRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try Again"
            accessibilityState={{ disabled: field.isBusy }}
            disabled={field.isBusy}
            onPress={() => void field.refreshField()}
            style={[styles.secondaryButton, field.isBusy && styles.disabled]}
          >
            <Text style={styles.secondaryText}>Try Again</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          showClueOptions ? "Hide clue options" : "Show clue options"
        }
        accessibilityState={{ expanded: showClueOptions }}
        onPress={() => setShowClueOptions((current) => !current)}
        style={styles.optionsButton}
      >
        <Ionicons
          name={showClueOptions ? "chevron-up" : "chevron-down"}
          size={13}
          color="#BDA8CE"
        />
        <Text style={styles.optionsText}>Clue options</Text>
      </Pressable>

      {showClueOptions ? (
        <View style={styles.effectsGroup}>
          <View style={styles.effectsRow}>
            <Text style={styles.effectsText}>Sounds</Text>
            <Switch
              accessibilityLabel="Clue sounds"
              accessibilityHint="Turns spoken clue sounds on or off"
              value={soundsEnabled}
              onValueChange={setSounds}
              trackColor={{ false: "#51465A", true: "#7C3AED" }}
              style={styles.compactSwitch}
            />
          </View>
          <View style={styles.effectsRow}>
            <Text style={styles.effectsText}>Vibration</Text>
            <Switch
              accessibilityLabel="Clue vibration"
              accessibilityHint="Turns gentle clue vibrations on or off"
              value={hapticsEnabled}
              onValueChange={setHaptics}
              trackColor={{ false: "#51465A", true: "#7C3AED" }}
              style={styles.compactSwitch}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "86%",
    maxWidth: 310,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.75)",
    borderRadius: 12,
    backgroundColor: "rgba(6,4,26,0.94)",
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 4,
  },
  revealedCard: {
    borderColor: "#FFD76A",
    backgroundColor: "rgba(48,31,4,0.95)",
  },
  activeCard: {
    borderColor: "rgba(217,112,255,0.92)",
    shadowColor: "#C35BFF",
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 9,
  },
  urgentCard: {
    borderColor: "#F5C451",
    shadowColor: "#FFD76A",
    shadowOpacity: 0.48,
    shadowRadius: 14,
  },
  titleRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#FFF", fontSize: 12, fontWeight: "900" },
  stagePanel: {
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
  },
  stageLabel: {
    color: "#F4D8FF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  message: {
    color: "#E8DCF1",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 14,
  },
  distance: {
    color: "#FFD76A",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  signalRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
  },
  signalBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: "rgba(190,168,206,0.22)",
  },
  signalBarActive: { backgroundColor: "#D879FF" },
  signalBarFound: { backgroundColor: "#FFD76A" },
  signalText: {
    color: "#CDBBDD",
    fontSize: 8,
    fontWeight: "900",
    marginLeft: 3,
    marginBottom: 1,
  },
  instruction: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  gpsLabel: {
    color: "#8CDFF0",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  readings: {
    color: "#FFD76A",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 2,
    flexWrap: "wrap",
  },
  button: {
    minHeight: 40,
    justifyContent: "center",
    backgroundColor: "#7C3AED",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disabled: { opacity: 0.45 },
  buttonText: { color: "#FFF", fontWeight: "900", fontSize: 12 },
  secondaryButton: {
    minHeight: 40,
    justifyContent: "center",
    borderColor: "#75578D",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  secondaryText: { color: "#D8C7E4", fontWeight: "800", fontSize: 11 },
  optionsButton: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  optionsText: { color: "#BDA8CE", fontSize: 9, fontWeight: "800" },
  effectsGroup: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  effectsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  effectsText: { color: "#9F91AA", fontSize: 9 },
  compactSwitch: { transform: [{ scale: 0.72 }] },
});
