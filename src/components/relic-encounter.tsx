import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
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
  withTiming,
} from "react-native-reanimated";

import type { Relic } from "@/constants/relics";
import { RelicARWorld } from "@/components/ar/relic-ar-world";

type RelicEncounterProps = {
  visible: boolean;
  relic: Relic | null;

  distanceFeet: number | null;
  freshFinalReadingCount: number;
  energyWarning: boolean;

  canCollect: boolean;
  isBusy: boolean;

  onCollect: () => void;
  onClose: () => void;
};

// Purpose: Renders the interactive encounter for a nearby relic.
export function RelicEncounter({
  visible,
  relic,
  distanceFeet,
  freshFinalReadingCount,
  energyWarning,
  canCollect,
  isBusy,
  onCollect,
  onClose,
}: RelicEncounterProps) {
  const reduceMotion = useReducedMotion();

  // Purpose:
  // Tracks whether ARKit/ARCore has found a usable
  // physical surface in the player's environment.
  const [arSurfaceFound, setArSurfaceFound] =
    useState(false);

  // Purpose:
  // Tracks whether the player actually tapped the
  // relic inside the real AR world.
  const [relicTouched, setRelicTouched] =
    useState(false);

  // Purpose:
  // Smoothly changes the scanning label into the
  // surface-locked label when AR finds the environment.
  const lockProgress = useSharedValue(0);

  useEffect(() => {
    // Reset AR hunt state whenever the encounter
    // closes or Mission Trails loads a different relic.
    setArSurfaceFound(false);
    setRelicTouched(false);

    lockProgress.value = 0;
  }, [
    visible,
    relic?.id,
    lockProgress,
  ]);

  const targetingLabelStyle = useAnimatedStyle(() => ({
    opacity: 1 - lockProgress.value,
    transform: [
      {
        translateY:
          lockProgress.value * -4,
      },
    ],
  }));

  const lockedLabelStyle = useAnimatedStyle(() => ({
    opacity: lockProgress.value,
    transform: [
      {
        translateY:
          (1 - lockProgress.value) * 5,
      },
      {
        scale:
          0.96 +
          lockProgress.value * 0.04,
      },
    ],
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

  // Purpose:
  // Runs when Viro detects a real horizontal surface
  // such as a counter, floor, sidewalk, or trail.
  function handlePlaneFound() {
    setArSurfaceFound(true);

    lockProgress.value = withTiming(1, {
      duration: reduceMotion ? 0 : 350,
    });
  }

  // Purpose:
  // Runs only when the player taps the relic
  // inside the real AR world.
  function touchRelic() {
    if (isBusy) return;

    setRelicTouched(true);
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
        {visible ? (
          <View style={StyleSheet.absoluteFillObject}>
            <RelicARWorld
              relicId={relic.id}
              relicIcon={relic.icon}
              onPlaneFound={handlePlaneFound}
              onRelicTouched={touchRelic}
            />
          </View>
        ) : null}

        <View
          pointerEvents="none"
          style={styles.cameraShade}
        />

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

        {energyWarning ? (
          <Animated.View
            entering={
              reduceMotion
                ? undefined
                : FadeInDown.duration(350)
            }
            style={styles.energyWarningBanner}
          >
            <Ionicons
              name="warning"
              size={18}
              color="#FFD76A"
            />

            <View style={styles.energyWarningCopy}>
              <Text style={styles.energyWarningTitle}>
                RELIC ENERGY FADING
              </Text>

              <Text style={styles.energyWarningText}>
                Claim this relic soon.
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <View
          pointerEvents="none"
          style={styles.encounterStage}
        >
          <View
            pointerEvents="none"
            style={styles.lockStatusWrap}
          >
            <Animated.Text
              style={[
                styles.targetingText,
                targetingLabelStyle,
              ]}
            >
              SCANNING REAL-WORLD SURFACES…
            </Animated.Text>

            <Animated.Text
              style={[
                styles.lockedText,
                {
                  color: relic.primaryColor,
                  textShadowColor:
                    relic.primaryColor,
                },
                lockedLabelStyle,
              ]}
            >
              ✦ AR SURFACE LOCKED ✦
            </Animated.Text>
          </View>
        </View>

        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : FadeInUp.delay(250).duration(450)
          }
          style={styles.instructions}
        >
          {!arSurfaceFound ? (
            <>
              <Ionicons
                name="scan-outline"
                size={27}
                color={relic.primaryColor}
              />

              <Text style={styles.instructionTitle}>
                SCAN THE AREA
              </Text>

              <Text style={styles.instructionCopy}>
                Move your phone slowly so Mission Trails
                can detect the ground or nearby surfaces.
              </Text>
            </>
          ) : !relicTouched ? (
            <>
              <Ionicons
                name="eye-outline"
                size={27}
                color={relic.primaryColor}
              />

              <Text style={styles.instructionTitle}>
                FIND THE RELIC
              </Text>

              <Text style={styles.instructionCopy}>
                Look around the real world and tap the
                relic when you discover it.
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

  cameraPreview: {
    zIndex: 0,
  },

  cameraShade: {
    position: "absolute",
    zIndex: 1,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(2,5,10,0.32)",
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
    zIndex: 20,
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
    zIndex: 20,
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

  energyWarningBanner: {
    zIndex: 25,
    marginHorizontal: 24,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,106,0.65)",
    backgroundColor: "rgba(32,22,5,0.90)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  energyWarningCopy: {
    flexShrink: 1,
  },

  energyWarningTitle: {
    color: "#FFD76A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  energyWarningText: {
    color: "#F2E7C9",
    fontSize: 10,
    marginTop: 2,
  },

  encounterStage: {
    zIndex: 20,
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

  targetReticle: {
    position: "absolute",
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },

  reticleTickTop: {
    position: "absolute",
    top: -8,
    width: 2,
    height: 18,
    borderRadius: 2,
  },

  reticleTickBottom: {
    position: "absolute",
    bottom: -8,
    width: 2,
    height: 18,
    borderRadius: 2,
  },

  reticleTickLeft: {
    position: "absolute",
    left: -8,
    width: 18,
    height: 2,
    borderRadius: 2,
  },

  reticleTickRight: {
    position: "absolute",
    right: -8,
    width: 18,
    height: 2,
    borderRadius: 2,
  },

  lockStatusWrap: {
    position: "absolute",
    bottom: 12,
    height: 24,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
  },

  targetingText: {
    position: "absolute",
    color: "#C4D4DE",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },

  lockedText: {
    position: "absolute",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    textShadowRadius: 12,
  },

  relicPressable: {
    zIndex: 25,
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
    zIndex: 20,
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
    zIndex: 20,
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
