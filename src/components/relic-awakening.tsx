import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer } from 'expo-audio';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  Relic,
  RelicRarity,
} from '@/constants/relics';

type RelicAwakeningProps = {
  relic: Relic | null;
  totalXp: number;
  onClose: () => void;
};

type RarityAnimationConfig = {
  particles: number;
  burstDistance: number;
  flashOpacity: number;
  ringScale: number;
};


const RELIC_SOUND_SOURCES = {
  Common: require(
    '../../assets/audio/relics/relic-common.wav'
  ),
  Uncommon: require(
    '../../assets/audio/relics/relic-uncommon.wav'
  ),
  Rare: require(
    '../../assets/audio/relics/relic-rare.wav'
  ),
  Epic: require(
    '../../assets/audio/relics/relic-epic.wav'
  ),
  Legendary: require(
    '../../assets/audio/relics/relic-legendary.wav'
  ),
} as const;

const RARITY_ANIMATION: Record<
  RelicRarity,
  RarityAnimationConfig
> = {
  Common: {
    particles: 8,
    burstDistance: 85,
    flashOpacity: 0.26,
    ringScale: 1.35,
  },

  Uncommon: {
    particles: 11,
    burstDistance: 100,
    flashOpacity: 0.34,
    ringScale: 1.5,
  },

  Rare: {
    particles: 15,
    burstDistance: 120,
    flashOpacity: 0.45,
    ringScale: 1.7,
  },

  Epic: {
    particles: 20,
    burstDistance: 145,
    flashOpacity: 0.6,
    ringScale: 1.95,
  },

  Legendary: {
    particles: 28,
    burstDistance: 175,
    flashOpacity: 0.82,
    ringScale: 2.25,
  },
};

const PARTICLE_DIRECTIONS = [
  { x: 0, y: -1.0, size: 7 },
  { x: 0.35, y: -0.94, size: 5 },
  { x: 0.7, y: -0.72, size: 8 },
  { x: 0.95, y: -0.35, size: 5 },
  { x: 1, y: 0, size: 7 },
  { x: 0.92, y: 0.38, size: 4 },
  { x: 0.72, y: 0.72, size: 8 },
  { x: 0.36, y: 0.95, size: 5 },
  { x: 0, y: 1, size: 7 },
  { x: -0.38, y: 0.93, size: 5 },
  { x: -0.72, y: 0.7, size: 8 },
  { x: -0.94, y: 0.35, size: 5 },
  { x: -1, y: 0, size: 7 },
  { x: -0.93, y: -0.4, size: 4 },
  { x: -0.7, y: -0.72, size: 8 },
  { x: -0.35, y: -0.95, size: 5 },

  { x: 0.18, y: -0.82, size: 4 },
  { x: 0.55, y: -0.55, size: 6 },
  { x: 0.82, y: -0.15, size: 4 },
  { x: 0.76, y: 0.48, size: 6 },
  { x: 0.42, y: 0.78, size: 4 },
  { x: -0.18, y: 0.82, size: 6 },
  { x: -0.55, y: 0.55, size: 4 },
  { x: -0.82, y: 0.15, size: 6 },
  { x: -0.76, y: -0.48, size: 4 },
  { x: -0.42, y: -0.78, size: 6 },

  { x: 0.25, y: -0.62, size: 3 },
  { x: -0.25, y: 0.62, size: 3 },
] as const;

type ParticleProps = {
  progress: SharedValue<number>;
  direction: {
    x: number;
    y: number;
    size: number;
  };
  distance: number;
  color: string;
};

// Purpose: Renders the burst particle interface.
function BurstParticle({
  progress,
  direction,
  distance,
  color,
}: ParticleProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const travel = progress.value;

    return {
      opacity:
        travel <= 0.05
          ? 0
          : Math.max(0, 1 - travel),

      transform: [
        {
          translateX:
            direction.x *
            distance *
            travel,
        },
        {
          translateY:
            direction.y *
            distance *
            travel,
        },
        {
          scale:
            0.45 +
            travel * 1.25,
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: direction.size,
          height: direction.size,
          borderRadius:
            direction.size / 2,
          backgroundColor: color,
          shadowColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

// Purpose: Renders the relic awakening interface.
export function RelicAwakening({
  relic,
  totalXp,
  onClose,
}: RelicAwakeningProps) {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();

  const {
    width,
    height,
  } = useWindowDimensions();

  const reduceMotion = useReducedMotion();

  const relicSoundSource =
    RELIC_SOUND_SOURCES[
      relic?.rarity ?? 'Common'
    ];

  const relicSoundPlayer =
    useAudioPlayer(
      relicSoundSource
    );



  const [actionsReady, setActionsReady] =
    useState(false);

  const intro = useSharedValue(0);

  const spin = useSharedValue(0);

  const burst = useSharedValue(0);

  const flash = useSharedValue(0);

  const ring = useSharedValue(0);

  const details = useSharedValue(0);

  const float = useSharedValue(0);

  const transfer = useSharedValue(0);

  const config = useMemo(() => {
    if (!relic) {
      return RARITY_ANIMATION.Common;
    }

    return RARITY_ANIMATION[
      relic.rarity
    ];
  }, [relic]);

  useEffect(() => {
    if (!relic) {
      return;
    }


    relicSoundPlayer.volume = 0.82;

    void relicSoundPlayer
      .seekTo(0)
      .then(() => {
        relicSoundPlayer.play();
      })
      .catch((error) => {
        console.warn(
          '[Relic Audio] Could not play:',
          error
        );
      });

    setActionsReady(false);

    intro.value = 0;
    spin.value = 0;
    burst.value = 0;
    flash.value = 0;
    ring.value = 0;
    details.value = 0;
    float.value = 0;
    transfer.value = 0;

    if (reduceMotion) {
      intro.value = 1;
      details.value = 1;
      ring.value = 1;

      setActionsReady(true);

      return;
    }

    // ============================
    // 1. RELIC RISES INTO FRAME
    // ============================

    intro.value = withSpring(
      1,
      {
        damping: 11,
        stiffness: 105,
        mass: 0.85,
      }
    );

    // ============================
    // 2. RELIC SPINS
    // ============================

    spin.value = withTiming(
      1,
      {
        duration: 780,
        easing:
          Easing.out(
            Easing.cubic
          ),
      }
    );

    // ============================
    // 3. ENERGY RING CHARGES
    // ============================

    ring.value = withDelay(
      240,
      withTiming(
        1,
        {
          duration: 520,
          easing:
            Easing.out(
              Easing.quad
            ),
        }
      )
    );

    // ============================
    // 4. COLLECTION IMPACT FLASH
    // ============================

    flash.value = withDelay(
      520,
      withSequence(
        withTiming(
          1,
          {
            duration: 70,
          }
        ),

        withTiming(
          0,
          {
            duration: 420,
            easing:
              Easing.out(
                Easing.quad
              ),
          }
        )
      )
    );

    // ============================
    // 5. PARTICLE EXPLOSION
    // ============================

    burst.value = withDelay(
      500,
      withTiming(
        1,
        {
          duration: 760,
          easing:
            Easing.out(
              Easing.cubic
            ),
        }
      )
    );

    // ============================
    // 6. INFO + XP REVEAL
    // ============================

    details.value = withDelay(
      820,
      withTiming(
        1,
        {
          duration: 420,
          easing:
            Easing.out(
              Easing.quad
            ),
        }
      )
    );

    // ============================
    // 7. RELIC FLOATS AFTER REVEAL
    // ============================

    float.value = withDelay(
      1100,
      withRepeat(
        withSequence(
          withTiming(
            1,
            {
              duration: 1250,
              easing:
                Easing.inOut(
                  Easing.sin
                ),
            }
          ),

          withTiming(
            0,
            {
              duration: 1250,
              easing:
                Easing.inOut(
                  Easing.sin
                ),
            }
          )
        ),
        -1,
        false
      )
    );

    const timer = setTimeout(
      () => {
        setActionsReady(true);
      },
      1100
    );

    return () => {
      clearTimeout(timer);

      cancelAnimation(intro);
      cancelAnimation(spin);
      cancelAnimation(burst);
      cancelAnimation(flash);
      cancelAnimation(ring);
      cancelAnimation(details);
      cancelAnimation(float);
      cancelAnimation(transfer);
    };
  }, [
    burst,
    details,
    flash,
    float,
    intro,
    reduceMotion,
    relic,
    relicSoundPlayer,
    ring,
    spin,
    transfer,
  ]);

  const relicStyle =
    useAnimatedStyle(() => {
      const transferred =
        transfer.value;

      // Creates a quick scale-up "impact" during the particle burst.
      // It rises to 1 in the middle of the burst, then returns to 0,
      // so the relic finishes at its normal size.
      const burstPulse =
        Math.sin(
          Math.max(
            0,
            Math.min(1, burst.value),
          ) * Math.PI
        );

      return {
        opacity:
          intro.value *
          (1 -
            transferred *
              0.95),

        transform: [
          {
            translateY:
              (1 -
                intro.value) *
                100 -
              float.value * 10 -
              transferred *
                Math.min(
                  height * 0.34,
                  260
                ),
          },

          {
            scale:
              0.3 +
              intro.value *
                0.7 +
              burstPulse *
                0.28 -
              transferred *
                0.88,
          },

          {
            rotate: `${
              spin.value *
              720
            }deg`,
          },
        ],
      };
    });

  const ringStyle =
    useAnimatedStyle(() => ({
      opacity:
        Math.max(
          0,
          1 -
            ring.value *
              0.82
        ),

      transform: [
        {
          scale:
            0.45 +
            ring.value *
              config.ringScale,
        },
      ],
    }));

  const secondRingStyle =
    useAnimatedStyle(() => ({
      opacity:
        Math.max(
          0,
          0.65 -
            ring.value *
              0.5
        ),

      transform: [
        {
          scale:
            0.7 +
            ring.value *
              (
                config.ringScale *
                0.72
              ),
        },

        {
          rotate: `${
            spin.value *
            -720
          }deg`,
        },
      ],
    }));

  const flashStyle =
    useAnimatedStyle(() => ({
      opacity:
        flash.value *
        config.flashOpacity,
    }));

  const detailsStyle =
    useAnimatedStyle(() => ({
      opacity:
        details.value,

      transform: [
        {
          translateY:
            (1 -
              details.value) *
            30,
        },
      ],
    }));

  const stageGlowStyle =
    useAnimatedStyle(() => ({
      opacity:
        0.18 +
        intro.value *
          0.42,

      transform: [
        {
          scale:
            0.75 +
            intro.value *
              0.35 +
            float.value *
              0.04,
        },
      ],
    }));

  if (!relic) {
    return null;
  }

  const artworkSize =
    Math.min(
      width * 0.56,
      height * 0.3,
      265
    );

  const particleCount =
    Math.min(
      config.particles,
      PARTICLE_DIRECTIONS.length
    );

  const particleDirections =
    PARTICLE_DIRECTIONS.slice(
      0,
      particleCount
    );

  // Purpose: Handles view vault.
  const handleViewVault = () => {
    if (!actionsReady) {
      return;
    }

    // Make the relic shoot upward and shrink,
    // giving the feeling that it is being
    // transferred into the player's Vault.
    transfer.value =
      withTiming(
        1,
        {
          duration: 430,
          easing:
            Easing.in(
              Easing.cubic
            ),
        }
      );

    setTimeout(() => {
      onClose();
      router.push('/vault');
    }, 390);
  };

  return (
    <View
      accessibilityViewIsModal
      accessibilityLabel={`${relic.name} relic collected. ${relic.xp} experience awarded.`}
      style={styles.screen}
    >
      <LinearGradient
        colors={[
          '#020004',
          `${relic.secondaryColor}35`,
          '#08000F',
          '#020004',
        ]}
        locations={[
          0,
          0.32,
          0.7,
          1,
        ]}
        style={
          StyleSheet.absoluteFill
        }
      />

      {/* IMPACT FLASH */}

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor:
              relic.primaryColor,
          },
          flashStyle,
        ]}
      />

      {/* BACKGROUND ENERGY */}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.backgroundGlow,
          {
            backgroundColor:
              `${relic.primaryColor}40`,
            shadowColor:
              relic.primaryColor,
          },
          stageGlowStyle,
        ]}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop:
              safeArea.top +
              20,

            paddingBottom:
              safeArea.bottom +
              18,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.topCopy,
            detailsStyle,
          ]}
        >
          <View
            style={
              styles.eyebrowRow
            }
          >
            <View
              style={[
                styles.eyebrowLine,
                {
                  backgroundColor:
                    relic.primaryColor,
                },
              ]}
            />

            <Ionicons
              name="diamond"
              size={13}
              color={
                relic.primaryColor
              }
            />

            <Text
              style={
                styles.eyebrow
              }
            >
              RELIC COLLECTED
            </Text>

            <View
              style={[
                styles.eyebrowLine,
                {
                  backgroundColor:
                    relic.primaryColor,
                },
              ]}
            />
          </View>

          <Text
            style={
              styles.discoveryText
            }
          >
            AN ANCIENT POWER HAS
            JOINED YOUR VAULT
          </Text>
        </Animated.View>

        {/* ============================
            RELIC STAGE
        ============================ */}

        <View
          style={[
            styles.stage,
            {
              width:
                artworkSize +
                130,

              height:
                artworkSize +
                130,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.energyRing,
              {
                width:
                  artworkSize +
                  15,

                height:
                  artworkSize +
                  15,

                borderRadius:
                  (
                    artworkSize +
                    15
                  ) / 2,

                borderColor:
                  relic.primaryColor,
              },
              ringStyle,
            ]}
          />

          <Animated.View
            style={[
              styles.secondRing,
              {
                width:
                  artworkSize +
                  70,

                height:
                  artworkSize +
                  70,

                borderRadius:
                  (
                    artworkSize +
                    70
                  ) / 2,

                borderColor:
                  `${relic.secondaryColor}B0`,
              },
              secondRingStyle,
            ]}
          >
            <View
              style={[
                styles.orbitDot,
                {
                  backgroundColor:
                    relic.primaryColor,

                  shadowColor:
                    relic.primaryColor,
                },
              ]}
            />

            <View
              style={[
                styles.orbitDotOpposite,
                {
                  backgroundColor:
                    relic.secondaryColor,

                  shadowColor:
                    relic.secondaryColor,
                },
              ]}
            />
          </Animated.View>

          {/* PARTICLE EXPLOSION */}

          {particleDirections.map(
            (
              direction,
              index
            ) => {
              const color =
                relic
                  .particleColors
                  .length > 0
                  ? relic
                      .particleColors[
                      index %
                        relic
                          .particleColors
                          .length
                    ]
                  : relic.primaryColor;

              return (
                <BurstParticle
                  key={index}
                  progress={
                    burst
                  }
                  direction={
                    direction
                  }
                  distance={
                    config.burstDistance
                  }
                  color={color}
                />
              );
            }
          )}

          {/* RELIC ART */}

          <Animated.View
            style={[
              styles.relicWrap,
              {
                shadowColor:
                  relic.primaryColor,
              },
              relicStyle,
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              source={relic.icon}
              resizeMode="contain"
              style={{
                width:
                  artworkSize,

                height:
                  artworkSize,
              }}
            />
          </Animated.View>
        </View>

        {/* ============================
            RELIC INFORMATION
        ============================ */}

        <Animated.View
          style={[
            styles.details,
            detailsStyle,
          ]}
        >
          <View
            style={[
              styles.rarityPill,
              {
                borderColor:
                  `${relic.primaryColor}AA`,

                backgroundColor:
                  `${relic.primaryColor}16`,
              },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={12}
              color={
                relic.primaryColor
              }
            />

            <Text
              style={[
                styles.rarityText,
                {
                  color:
                    relic.primaryColor,
                },
              ]}
            >
              {relic.rarity.toUpperCase()}
              {'  •  '}
              {relic.effectFamily.toUpperCase()}
            </Text>
          </View>

          <Text
            style={[
              styles.relicName,
              {
                textShadowColor:
                  `${relic.primaryColor}AA`,
              },
            ]}
          >
            {relic.name}
          </Text>

          {relic.lore ? (
            <Text
              style={
                styles.lore
              }
            >
              {relic.lore}
            </Text>
          ) : null}

          {/* XP REWARD */}

          <View
            style={
              styles.rewardCard
            }
          >
            <View
              style={
                styles.rewardBlock
              }
            >
              <Text
                style={
                  styles.rewardLabel
                }
              >
                COLLECTION REWARD
              </Text>

              <Text
                style={[
                  styles.rewardXp,
                  {
                    color:
                      relic.primaryColor,
                  },
                ]}
              >
                +{relic.xp} XP
              </Text>
            </View>

            <View
              style={
                styles.rewardDivider
              }
            />

            <View
              style={
                styles.rewardBlock
              }
            >
              <Text
                style={
                  styles.rewardLabel
                }
              >
                EXPLORER TOTAL
              </Text>

              <Text
                style={
                  styles.totalXp
                }
              >
                {totalXp.toLocaleString()}
                {' XP'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ============================
            ACTION BUTTONS
        ============================ */}

        <Animated.View
          pointerEvents={
            actionsReady
              ? 'auto'
              : 'none'
          }
          style={[
            styles.actions,
            detailsStyle,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${relic.name} in Vault`}
            onPress={
              handleViewVault
            }
            style={({
              pressed,
            }) => [
              styles.vaultButton,

              {
                borderColor:
                  relic.primaryColor,
              },

              pressed &&
                styles.buttonPressed,
            ]}
          >
            <LinearGradient
              colors={[
                `${relic.secondaryColor}DD`,
                `${relic.primaryColor}DD`,
              ]}
              start={{
                x: 0,
                y: 0.5,
              }}
              end={{
                x: 1,
                y: 0.5,
              }}
              style={
                styles.vaultGradient
              }
            >
              <Ionicons
                name="diamond"
                size={19}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.vaultButtonText
                }
              >
                VIEW IN VAULT
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue exploring"
            onPress={onClose}
            style={({
              pressed,
            }) => [
              styles.continueButton,
              pressed &&
                styles.buttonPressed,
            ]}
          >
            <Ionicons
              name="walk-outline"
              size={18}
              color="#A9B2C3"
            />

            <Text
              style={
                styles.continueText
              }
            >
              CONTINUE EXPLORING
            </Text>
          </Pressable>

          <Text
            style={
              styles.vaultHint
            }
          >
            Added permanently to your
            Vault
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      elevation: 9999,
      backgroundColor: '#020004',
      overflow: 'hidden',
    },

    content: {
      flex: 1,
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 20,
    },

    backgroundGlow: {
      position: 'absolute',
      width: 420,
      height: 420,
      borderRadius: 210,
      left: '50%',
      top: '20%',
      marginLeft: -210,

      shadowOpacity: 1,
      shadowRadius: 70,
    },

    topCopy: {
      alignItems: 'center',
    },

    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    eyebrowLine: {
      width: 30,
      height: 1,
    },

    eyebrow: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 2.4,
    },

    discoveryText: {
      color: '#978FA6',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.3,
      textAlign: 'center',
      marginTop: 8,
    },

    stage: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: -6,
    },

    relicWrap: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',

      shadowOpacity: 0.95,
      shadowRadius: 35,
      shadowOffset: {
        width: 0,
        height: 0,
      },

      elevation: 20,
    },

    energyRing: {
      position: 'absolute',
      borderWidth: 2,
    },

    secondRing: {
      position: 'absolute',
      borderWidth: 1,
      borderStyle: 'dashed',
    },

    orbitDot: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,

      top: -5,
      left: '50%',
      marginLeft: -5,

      shadowOpacity: 1,
      shadowRadius: 10,
    },

    orbitDotOpposite: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,

      bottom: -4,
      left: '50%',
      marginLeft: -4,

      shadowOpacity: 1,
      shadowRadius: 9,
    },

    particle: {
      position: 'absolute',
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 12,
    },

    details: {
      width: '100%',
      alignItems: 'center',
    },

    rarityPill: {
      minHeight: 28,
      paddingHorizontal: 13,

      borderRadius: 15,
      borderWidth: 1,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

      gap: 7,
    },

    rarityText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    relicName: {
      color: '#FFFFFF',

      fontSize: 29,
      lineHeight: 35,
      fontWeight: '900',

      textAlign: 'center',

      marginTop: 9,

      textShadowOffset: {
        width: 0,
        height: 0,
      },

      textShadowRadius: 15,
    },

    lore: {
      color: '#CBC5D5',

      fontSize: 12,
      lineHeight: 18,

      maxWidth: 390,

      textAlign: 'center',

      marginTop: 5,
    },

    rewardCard: {
      width: '100%',
      maxWidth: 390,

      minHeight: 68,

      borderRadius: 19,
      borderWidth: 1,

      borderColor:
        'rgba(255,255,255,0.11)',

      backgroundColor:
        'rgba(255,255,255,0.055)',

      flexDirection: 'row',
      alignItems: 'center',

      paddingHorizontal: 12,

      marginTop: 15,
    },

    rewardBlock: {
      flex: 1,
      alignItems: 'center',
    },

    rewardDivider: {
      width: 1,
      height: 34,

      backgroundColor:
        'rgba(255,255,255,0.13)',
    },

    rewardLabel: {
      color: '#7F8797',

      fontSize: 8,
      fontWeight: '900',

      letterSpacing: 1,
    },

    rewardXp: {
      fontSize: 21,
      fontWeight: '900',

      marginTop: 4,
    },

    totalXp: {
      color: '#FFFFFF',

      fontSize: 18,
      fontWeight: '900',

      marginTop: 4,
    },

    actions: {
      width: '100%',
      maxWidth: 390,
      alignItems: 'center',
    },

    vaultButton: {
      width: '100%',

      borderRadius: 18,
      borderWidth: 1,

      overflow: 'hidden',
    },

    vaultGradient: {
      minHeight: 52,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

      gap: 9,
    },

    vaultButtonText: {
      color: '#FFFFFF',

      fontSize: 13,
      fontWeight: '900',

      letterSpacing: 1.1,
    },

    continueButton: {
      minHeight: 42,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

      gap: 7,

      marginTop: 6,
    },

    continueText: {
      color: '#A9B2C3',

      fontSize: 11,
      fontWeight: '800',

      letterSpacing: 0.8,
    },

    vaultHint: {
      color: '#646D7D',
      fontSize: 10,

      marginTop: -2,

      textAlign: 'center',
    },

    buttonPressed: {
      opacity: 0.76,

      transform: [
        {
          scale: 0.985,
        },
      ],
    },
  });
