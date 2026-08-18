import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { playEggHatchHaptics } from '@/utils/game-haptics';

type Props = {
  visible: boolean;
  eggImage?: ImageSourcePropType;
  eggName: string;
  glowColor: string;
  companionName: string;
  companionRarity: string;
  onClose: () => void;
};

const PARTICLES = [
  { x: -110, y: -90 },
  { x: 0, y: -125 },
  { x: 105, y: -85 },
  { x: 135, y: 10 },
  { x: 95, y: 105 },
  { x: 0, y: 135 },
  { x: -100, y: 100 },
  { x: -135, y: 5 },
];

// Purpose: Renders the egg hatch animation interface.
export function EggHatchAnimation({
  visible,
  eggImage,
  eggName,
  glowColor,
  companionName,
  companionRarity,
  onClose,
}: Props) {
  const shakeX = useRef(
    new Animated.Value(0)
  ).current;

  const rotate = useRef(
    new Animated.Value(0)
  ).current;

  const eggScale = useRef(
    new Animated.Value(1)
  ).current;

  const eggOpacity = useRef(
    new Animated.Value(1)
  ).current;

  const crackOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const burstScale = useRef(
    new Animated.Value(0)
  ).current;

  const burstOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const revealOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const revealScale = useRef(
    new Animated.Value(0.5)
  ).current;

  useEffect(() => {
    if (!visible) return;

    shakeX.setValue(0);
    rotate.setValue(0);
    eggScale.setValue(1);
    eggOpacity.setValue(1);
    crackOpacity.setValue(0);
    burstScale.setValue(0);
    burstOpacity.setValue(0);
    revealOpacity.setValue(0);
    revealScale.setValue(0.5);

    void playEggHatchHaptics();

    // Purpose: Implements the shake operation.
    const shake = (x: number, rotation: number) =>
      Animated.parallel([
        Animated.timing(shakeX, {
          toValue: x,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: rotation,
          duration: 65,
          useNativeDriver: true,
        }),
      ]);

    Animated.sequence([
      Animated.delay(150),

      shake(-8, -1),
      shake(8, 1),
      shake(-10, -1),
      shake(10, 1),
      shake(-14, -1),
      shake(14, 1),

      Animated.parallel([
        Animated.timing(crackOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),

        Animated.sequence([
          shake(-19, -1),
          shake(19, 1),
          shake(-23, -1),
          shake(23, 1),
        ]),
      ]),

      Animated.parallel([
        Animated.timing(eggScale, {
          toValue: 1.22,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),

        Animated.timing(burstOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(eggScale, {
          toValue: 1.65,
          duration: 170,
          useNativeDriver: true,
        }),

        Animated.timing(eggOpacity, {
          toValue: 0,
          duration: 170,
          useNativeDriver: true,
        }),

        Animated.timing(burstScale, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),

        Animated.timing(burstOpacity, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.spring(revealScale, {
          toValue: 1,
          friction: 5,
          tension: 70,
          useNativeDriver: true,
        }),

        Animated.timing(revealOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    visible,
    burstOpacity,
    burstScale,
    crackOpacity,
    eggOpacity,
    eggScale,
    revealOpacity,
    revealScale,
    rotate,
    shakeX,
  ]);

  const eggRotation = rotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Text style={styles.hatchingText}>
          HATCHING
        </Text>

        <View style={styles.stage}>
          {PARTICLES.map((particle, index) => (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  backgroundColor: glowColor,
                  opacity: burstOpacity,
                  transform: [
                    {
                      translateX:
                        burstScale.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            0,
                            particle.x,
                          ],
                        }),
                    },
                    {
                      translateY:
                        burstScale.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            0,
                            particle.y,
                          ],
                        }),
                    },
                    {
                      scale:
                        burstScale.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1.4],
                        }),
                    },
                  ],
                },
              ]}
            />
          ))}

          <Animated.View
            style={[
              styles.burst,
              {
                backgroundColor: glowColor,
                opacity: burstOpacity,
                transform: [
                  {
                    scale:
                      burstScale.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.1, 4],
                      }),
                  },
                ],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.eggWrap,
              {
                opacity: eggOpacity,
                transform: [
                  { translateX: shakeX },
                  { rotate: eggRotation },
                  { scale: eggScale },
                ],
              },
            ]}
          >
            {eggImage ? (
              <Image
                source={eggImage}
                style={styles.eggImage}
                resizeMode="contain"
              />
            ) : (
              <Ionicons
                name="egg"
                size={190}
                color={glowColor}
              />
            )}

            <Animated.View
              pointerEvents="none"
              style={[
                styles.cracks,
                {
                  opacity: crackOpacity,
                },
              ]}
            >
              <View
                style={[
                  styles.crack,
                  styles.crackOne,
                ]}
              />

              <View
                style={[
                  styles.crack,
                  styles.crackTwo,
                ]}
              />

              <View
                style={[
                  styles.crack,
                  styles.crackThree,
                ]}
              />

              <View
                style={[
                  styles.crack,
                  styles.crackFour,
                ]}
              />
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[
              styles.reveal,
              {
                opacity: revealOpacity,
                transform: [
                  { scale: revealScale },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.companionCircle,
                {
                  borderColor: glowColor,
                  shadowColor: glowColor,
                },
              ]}
            >
              <Ionicons
                name="paw"
                size={86}
                color={glowColor}
              />
            </View>

            <Text style={styles.youHatched}>
              YOU HATCHED
            </Text>

            <Text style={styles.companionName}>
              {companionName}
            </Text>

            <Text
              style={[
                styles.rarity,
                {
                  color: glowColor,
                },
              ]}
            >
              {companionRarity.toUpperCase()}
            </Text>

            <Text style={styles.fromEgg}>
              from {eggName}
            </Text>

            <TouchableOpacity
              style={[
                styles.claimButton,
                {
                  borderColor: glowColor,
                },
              ]}
              onPress={onClose}
            >
              <Ionicons
                name="sparkles"
                size={19}
                color={glowColor}
              />

              <Text
                style={[
                  styles.claimText,
                  {
                    color: glowColor,
                  },
                ]}
              >
                CLAIM COMPANION
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3,5,10,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  hatchingText: {
    color: '#8490A2',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 20,
  },

  stage: {
    width: 360,
    height: 520,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eggWrap: {
    position: 'absolute',
    width: 240,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eggImage: {
    width: 230,
    height: 250,
  },

  cracks: {
    ...StyleSheet.absoluteFillObject,
  },

  crack: {
    position: 'absolute',
    width: 4,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    shadowColor: '#FFFFFF',
    shadowOpacity: 1,
    shadowRadius: 8,
  },

  crackOne: {
    left: 116,
    top: 72,
    transform: [{ rotate: '32deg' }],
  },

  crackTwo: {
    left: 92,
    top: 108,
    height: 42,
    transform: [{ rotate: '-45deg' }],
  },

  crackThree: {
    right: 88,
    top: 118,
    height: 48,
    transform: [{ rotate: '48deg' }],
  },

  crackFour: {
    left: 120,
    top: 148,
    height: 35,
    transform: [{ rotate: '-18deg' }],
  },

  burst: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
  },

  particle: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
  },

  reveal: {
    position: 'absolute',
    alignItems: 'center',
  },

  companionCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0C1119',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.8,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  youHatched: {
    color: '#8894A5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 25,
  },

  companionName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 6,
  },

  rarity: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 7,
  },

  fromEgg: {
    color: '#707C8E',
    fontSize: 12,
    marginTop: 6,
  },

  claimButton: {
    minWidth: 230,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#101720',
    borderWidth: 1.5,
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  claimText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
