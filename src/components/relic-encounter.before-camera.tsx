import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { Relic } from "@/constants/relics";

type RelicEncounterProps = {
  visible: boolean;
  relic: Relic | null;

  distanceFeet: number | null;
  freshFinalReadingCount: number;

  canCollect: boolean;
  isBusy: boolean;

  onCollect: () => void;
  onClose: () => void;
};

export function RelicEncounter({
  visible,
  relic,
  distanceFeet,
  freshFinalReadingCount,
  canCollect,
  isBusy,
  onCollect,
  onClose,
}: RelicEncounterProps) {
  const reduceMotion = useReducedMotion();

  const [relicTouched, setRelicTouched] = useState(false);

  const floatY = useSharedValue(0);
  const pulse = useSharedValue(1);
  const ringScale = useSharedValue(0.9);
  const ringOpacity = useSharedValue(0.65);

  useEffect(() => {
    if (!visible || !relic) {
      setRelicTouched(false);
      return;
    }

    setRelicTouched(false);

    if (reduceMotion) {
      floatY.value = 0;
      pulse.value = 1;
      ringScale.value = 1;
      ringOpacity.value = 0.5;
      return;
    }

    floatY.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 1400 }),
        withTiming(8, { duration: 1400 }),
      ),
      -1,
      true,
    );

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 900 }),
        withTiming(0.97, { duration: 900 }),
      ),
      -1,
      true,
    );

    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.16, { duration: 1500 }),
        withTiming(0.9, { duration: 0 }),
      ),
      -1,
      false,
    );

    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.08, { duration: 1500 }),
        withTiming(0.65, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [
    visible,
    relic?.id,
    reduceMotion,
    floatY,
    pulse,
    ringScale,
    ringOpacity,
  ]);

  const floatingRelicStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { scale: pulse.value },
    ],
  }));

  const energyRingStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  if (!relic) {
    return null;
  }

  const readyToClaim =
    relicTouched &&
    canCollect &&
    !isBusy;

  const locationText =
    freshFinalReadingCount >= 3
      ? "LOCATION VERIFIED"
      : `${freshFinalReadingCount} / 3 LOCATION CHECKS`;

  function touchRelic() {
    if (isBusy) return;

    setRelicTouched(true);

    if (!reduceMotion) {
      pulse.value = withSequence(
        withTiming(1.22, { duration: 130 }),
        withTiming(1, { duration: 260 }),
      );
    }
  }

  return (
    <Modal
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <View
          style={[
            styles.topGlow,
            {
              backgroundColor: `${relic.primaryColor}22`,
            },
          ]}
        />

        <View
          style={[
            styles.bottomGlow,
            {
              backgroundColor: `${relic.secondaryColor}18`,
            },
          ]}
        />

        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave relic encounter"
            hitSlop={10}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons
              name="close"
              size={25}
              color="#FFFFFF"
            />
          </Pressable>

          <Animated.View
            entering={
              reduceMotion
                ? undefined
                : FadeIn.duration(350)
            }
            style={styles.signalPill}
          >
            <View
              style={[
                styles.signalDot,
                {
                  backgroundColor: relic.primaryColor,
                  shadowColor: relic.primaryColor,
                },
              ]}
            />

            <Text style={styles.signalText}>
              RELIC ENCOUNTER
            </Text>
          </Animated.View>

          <View style={styles.headerSpacer} />
        </View>

        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : FadeInDown.delay(100).duration(450)
          }
          style={styles.titleArea}
        >
          <Text style={styles.encounterLabel}>
            AN ANCIENT SIGNAL HAS AWAKENED
          </Text>

          <Text
            style={[
              styles.relicName,
              {
                textShadowColor: `${relic.primaryColor}AA`,
              },
            ]}
          >
            {relic.name}
          </Text>

          <View
            style={[
              styles.rarityPill,
              {
                borderColor: `${relic.primaryColor}AA`,
              },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={12}
              color={relic.primaryColor}
            />

            <Text
              style={[
                styles.rarityText,
                {
                  color: relic.primaryColor,
                },
              ]}
            >
              {relic.rarity.toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.encounterStage}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.energyRing,
              {
                borderColor: relic.primaryColor,
                shadowColor: relic.primaryColor,
              },
              energyRingStyle,
            ]}
          />

          <View
            style={[
              styles.innerGlow,
              {
                backgroundColor: `${relic.primaryColor}12`,
                borderColor: `${relic.primaryColor}28`,
              },
            ]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Touch ${relic.name}`}
            accessibilityHint="Stabilizes the relic energy before collection"
            disabled={isBusy}
            onPress={touchRelic}
            style={styles.relicPressable}
          >
            <Animated.View
              style={[
                styles.relicArtworkWrap,
                floatingRelicStyle,
              ]}
            >
              <View
                style={[
                  styles.artworkGlow,
                  {
                    backgroundColor: `${relic.primaryColor}18`,
                    shadowColor: relic.primaryColor,
                  },
                ]}
              />

              <Image
                resizeMode="contain"
                source={relic.icon}
                style={styles.relicImage}
              />
            </Animated.View>
          </Pressable>
        </View>

        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : FadeInUp.delay(250).duration(450)
          }
          style={styles.instructions}
        >
          {!relicTouched ? (
            <>
              <Ionicons
                name="finger-print"
                size={26}
                color={relic.primaryColor}
              />

              <Text style={styles.instructionTitle}>
                TOUCH THE RELIC
              </Text>

              <Text style={styles.instructionCopy}>
                Stabilize its energy before claiming it.
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="checkmark-circle"
                size={28}
                color="#63F5C4"
              />

              <Text style={styles.instructionTitle}>
                ENERGY STABILIZED
              </Text>

              <Text style={styles.instructionCopy}>
                The relic is ready to be claimed.
              </Text>
            </>
          )}
        </Animated.View>

        <View style={styles.bottomPanel}>
          <View style={styles.verificationRow}>
            <View style={styles.verificationItem}>
              <Ionicons
                name="location"
                size={15}
                color="#63F5C4"
              />

              <Text style={styles.verificationText}>
                {locationText}
              </Text>
            </View>

            {distanceFeet !== null ? (
              <View style={styles.verificationItem}>
                <Ionicons
                  name="navigate"
                  size={15}
                  color="#5DEBFF"
                />

                <Text style={styles.verificationText}>
                  {Math.max(
                    0,
                    Math.round(distanceFeet),
                  )}{" "}
                  FT
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Claim ${relic.name}`}
            accessibilityHint={
              readyToClaim
                ? "Securely collects this relic"
                : "Touch the relic and wait for location verification"
            }
            accessibilityState={{
              disabled: !readyToClaim,
              busy: isBusy,
            }}
            disabled={!readyToClaim}
            onPress={onCollect}
            style={[
              styles.claimButton,
              {
                borderColor: relic.primaryColor,
                shadowColor: relic.primaryColor,
              },
              !readyToClaim &&
                styles.claimButtonDisabled,
            ]}
          >
            <Ionicons
              name={
                isBusy
                  ? "hourglass-outline"
                  : "diamond-outline"
              }
              size={20}
              color={
                readyToClaim
                  ? "#FFFFFF"
                  : "#747985"
              }
            />

            <Text
              style={[
                styles.claimButtonText,
                !readyToClaim &&
                  styles.claimButtonTextDisabled,
              ]}
            >
              {isBusy
                ? "VERIFYING…"
                : relicTouched
                  ? "CLAIM RELIC"
                  : "STABILIZE RELIC"}
            </Text>
          </Pressable>

          <Text style={styles.secureText}>
            SECURE GPS COLLECTION
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#03060B",
    overflow: "hidden",
  },

  topGlow: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    top: -190,
    alignSelf: "center",
  },

  bottomGlow: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    bottom: -250,
    alignSelf: "center",
  },

  header: {
    paddingTop: 58,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#28313B",
    backgroundColor: "#0B1118",
    alignItems: "center",
    justifyContent: "center",
  },

  signalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#29343E",
    backgroundColor: "#091017",
  },

  signalDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    shadowOpacity: 1,
    shadowRadius: 8,
  },

  signalText: {
    color: "#D9E9F3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  headerSpacer: {
    width: 42,
  },

  titleArea: {
    alignItems: "center",
    paddingTop: 30,
    paddingHorizontal: 24,
  },

  encounterLabel: {
    color: "#82909D",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
  },

  relicName: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 8,
    textShadowRadius: 16,
  },

  rarityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginTop: 10,
    backgroundColor: "#080D12",
  },

  rarityText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  encounterStage: {
    flex: 1,
    minHeight: 290,
    alignItems: "center",
    justifyContent: "center",
  },

  energyRing: {
    position: "absolute",
    width: 245,
    height: 245,
    borderRadius: 122.5,
    borderWidth: 2,
    shadowOpacity: 0.9,
    shadowRadius: 24,
  },

  innerGlow: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
  },

  relicPressable: {
    width: 230,
    height: 230,
    alignItems: "center",
    justifyContent: "center",
  },

  relicArtworkWrap: {
    width: 190,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
  },

  artworkGlow: {
    position: "absolute",
    width: 145,
    height: 145,
    borderRadius: 72.5,
    shadowOpacity: 1,
    shadowRadius: 35,
  },

  relicImage: {
    width: 175,
    height: 175,
  },

  instructions: {
    alignItems: "center",
    paddingHorizontal: 30,
    paddingBottom: 18,
  },

  instructionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 6,
  },

  instructionCopy: {
    color: "#8D9AA5",
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },

  bottomPanel: {
    paddingHorizontal: 22,
    paddingBottom: 38,
  },

  verificationRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginBottom: 13,
  },

  verificationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  verificationText: {
    color: "#9CAAB4",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  claimButton: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: "#101B23",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowOpacity: 0.65,
    shadowRadius: 15,
  },

  claimButtonDisabled: {
    borderColor: "#222C34",
    backgroundColor: "#0A0F14",
    shadowOpacity: 0,
  },

  claimButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  claimButtonTextDisabled: {
    color: "#747985",
  },

  secureText: {
    color: "#55616B",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    textAlign: "center",
    marginTop: 10,
  },
});
