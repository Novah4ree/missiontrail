import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
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

import type { Relic } from '@/constants/relics';

type RelicAwakeningProps = {
  relic: Relic | null;
  totalXp: number;
  onClose: () => void;
};

const PARTICLES = [
  { x: 0.08, y: 0.18, size: 4, delay: 0 },
  { x: 0.19, y: 0.32, size: 7, delay: 120 },
  { x: 0.83, y: 0.22, size: 5, delay: 240 },
  { x: 0.91, y: 0.42, size: 3, delay: 80 },
  { x: 0.12, y: 0.57, size: 5, delay: 300 },
  { x: 0.86, y: 0.63, size: 7, delay: 180 },
  { x: 0.23, y: 0.76, size: 3, delay: 360 },
  { x: 0.74, y: 0.79, size: 4, delay: 220 },
  { x: 0.42, y: 0.15, size: 3, delay: 140 },
  { x: 0.61, y: 0.3, size: 5, delay: 340 },
  { x: 0.35, y: 0.68, size: 6, delay: 100 },
  { x: 0.66, y: 0.61, size: 3, delay: 280 },
] as const;

export function RelicAwakening({ relic, totalXp, onClose }: RelicAwakeningProps) {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reveal = useSharedValue(0);
  const float = useSharedValue(0);
  const orbit = useSharedValue(0);
  const pulse = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!relic) {
      return;
    }

    reveal.value = 0;
    float.value = 0;
    orbit.value = 0;
    pulse.value = 0;

    if (reduceMotion) {
      reveal.value = 1;
      return;
    }

    reveal.value = withDelay(160, withSpring(1, { damping: 12, stiffness: 105 }));
    float.value = withDelay(
      650,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    orbit.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
    );
    pulse.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );

    return () => {
      cancelAnimation(reveal);
      cancelAnimation(float);
      cancelAnimation(orbit);
      cancelAnimation(pulse);
    };
  }, [float, orbit, pulse, reduceMotion, relic, reveal]);

  const relicStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: (1 - reveal.value) * 80 - float.value * 10 },
      { scale: 0.35 + reveal.value * 0.65 },
      { rotate: `${(1 - reveal.value) * -16}deg` },
    ],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ rotate: `${orbit.value * 360}deg` }, { scale: 0.75 + reveal.value * 0.25 }],
  }));

  const reverseOrbitStyle = useAnimatedStyle(() => ({
    opacity: reveal.value * 0.78,
    transform: [{ rotate: `${orbit.value * -240}deg` }, { scale: 0.7 + reveal.value * 0.3 }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.55,
    transform: [{ scale: 0.72 + pulse.value * 0.7 }],
  }));

  if (!relic) {
    return null;
  }

  const artworkSize = Math.min(width * 0.62, height * 0.34, 290);

  const viewInVault = () => {
    onClose();
    router.push('/vault');
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        accessibilityViewIsModal
        accessibilityLabel={`${relic.name} relic collected. ${relic.xp} experience awarded.`}
        style={styles.screen}
      >
        <LinearGradient
          colors={['#030008', `${relic.secondaryColor}38`, '#090016', '#020006']}
          locations={[0, 0.32, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.colorBloom, { backgroundColor: `${relic.primaryColor}24` }]} />
        <View style={[styles.colorBloomSecondary, { backgroundColor: `${relic.secondaryColor}20` }]} />

        {PARTICLES.map((particle, index) => (
          <Animated.View
            key={`${particle.x}-${particle.y}`}
            entering={reduceMotion ? undefined : FadeIn.delay(220 + particle.delay).duration(500)}
            style={[
              styles.particle,
              {
                left: particle.x * width,
                top: particle.y * height,
                width: particle.size,
                height: particle.size,
                borderRadius: particle.size / 2,
                backgroundColor: relic.particleColors[index % relic.particleColors.length],
                shadowColor: relic.particleColors[index % relic.particleColors.length],
              },
            ]}
          />
        ))}

        <View
          style={[
            styles.safeContent,
            { paddingTop: safeArea.top + 18, paddingBottom: safeArea.bottom + 22 },
          ]}
        >
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(500)} style={styles.eyebrowRow}>
            <View style={[styles.eyebrowLine, { backgroundColor: relic.primaryColor }]} />
            <Text style={styles.eyebrow}>RELIC AWAKENING</Text>
            <View style={[styles.eyebrowLine, { backgroundColor: relic.primaryColor }]} />
          </Animated.View>

          <Animated.Text entering={reduceMotion ? undefined : FadeIn.delay(260).duration(500)} style={styles.discoveryText}>
            AN ANCIENT POWER STIRS
          </Animated.Text>

          <View style={[styles.artworkStage, { width: artworkSize + 70, height: artworkSize + 70 }]}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  width: artworkSize,
                  height: artworkSize,
                  borderRadius: artworkSize / 2,
                  borderColor: relic.primaryColor,
                },
                pulseStyle,
              ]}
            />

            <Animated.View
              style={[
                styles.orbit,
                {
                  width: artworkSize + 48,
                  height: artworkSize + 48,
                  borderRadius: (artworkSize + 48) / 2,
                  borderColor: `${relic.primaryColor}7A`,
                },
                orbitStyle,
              ]}
            >
              <View style={[styles.orbitNode, { backgroundColor: relic.primaryColor }]} />
              <View style={[styles.orbitNodeOpposite, { backgroundColor: relic.secondaryColor }]} />
            </Animated.View>

            <Animated.View
              style={[
                styles.reverseOrbit,
                {
                  width: artworkSize + 16,
                  height: artworkSize + 16,
                  borderRadius: (artworkSize + 16) / 2,
                  borderColor: `${relic.secondaryColor}72`,
                },
                reverseOrbitStyle,
              ]}
            >
              <View style={[styles.smallOrbitNode, { backgroundColor: relic.secondaryColor }]} />
            </Animated.View>

            <Animated.View style={[styles.artworkGlow, { shadowColor: relic.primaryColor }, relicStyle]}>
              <Image
                accessibilityIgnoresInvertColors
                source={relic.icon}
                resizeMode="contain"
                style={{ width: artworkSize, height: artworkSize }}
              />
            </Animated.View>
          </View>

          <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(520).duration(540)} style={styles.relicCopy}>
            <View style={[styles.rarityPill, { borderColor: `${relic.primaryColor}A8` }]}>
              <Ionicons name="sparkles" size={12} color={relic.primaryColor} />
              <Text style={[styles.rarityText, { color: relic.primaryColor }]}>
                {relic.rarity.toUpperCase()} · {relic.effectFamily.toUpperCase()}
              </Text>
            </View>

            <Text style={[styles.relicName, { textShadowColor: `${relic.primaryColor}88` }]}>
              {relic.name}
            </Text>
            {relic.lore ? <Text style={styles.lore}>{relic.lore}</Text> : null}
          </Animated.View>

          <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(700).duration(480)} style={styles.rewardRow}>
            <View style={styles.rewardBlock}>
              <Text style={styles.rewardLabel}>AWAKENING REWARD</Text>
              <Text style={[styles.rewardValue, { color: relic.primaryColor }]}>+{relic.xp} XP</Text>
            </View>
            <View style={styles.rewardDivider} />
            <View style={styles.rewardBlock}>
              <Text style={styles.rewardLabel}>EXPLORER TOTAL</Text>
              <Text style={styles.totalValue}>{totalXp.toLocaleString()} XP</Text>
            </View>
          </Animated.View>

          <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(840).duration(480)} style={styles.buttonWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${relic.name} in your Vault`}
              onPress={viewInVault}
              style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
            >
              <LinearGradient
                colors={[relic.secondaryColor, relic.primaryColor]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.continueGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.continueText}>VIEW IN VAULT</Text>
              </LinearGradient>
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={styles.vaultHint}>Added to your Vault!</Text>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030008', overflow: 'hidden' },
  colorBloom: {
    position: 'absolute', width: 420, height: 420, borderRadius: 210,
    top: '17%', left: '50%', marginLeft: -210,
  },
  colorBloomSecondary: {
    position: 'absolute', width: 340, height: 340, borderRadius: 170,
    top: '33%', left: '50%', marginLeft: -170,
  },
  particle: { position: 'absolute', shadowOpacity: 0.95, shadowRadius: 8, elevation: 6 },
  safeContent: {
    flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 22,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrowLine: { width: 34, height: 1 },
  eyebrow: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 2.6 },
  discoveryText: { color: '#B8AFCA', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginTop: 3 },
  artworkStage: { alignItems: 'center', justifyContent: 'center', marginVertical: -4 },
  pulseRing: { position: 'absolute', borderWidth: 1.5 },
  orbit: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed' },
  reverseOrbit: { position: 'absolute', borderWidth: 1 },
  orbitNode: {
    position: 'absolute', width: 11, height: 11, borderRadius: 6,
    top: -6, left: '50%', marginLeft: -5.5,
  },
  orbitNodeOpposite: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4,
    bottom: -4, left: '50%', marginLeft: -4,
  },
  smallOrbitNode: {
    position: 'absolute', width: 7, height: 7, borderRadius: 4,
    top: '50%', right: -4, marginTop: -3.5,
  },
  artworkGlow: { shadowOpacity: 0.9, shadowRadius: 28, elevation: 16 },
  relicCopy: { alignItems: 'center', width: '100%' },
  rarityPill: {
    minHeight: 28, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(8, 3, 20, 0.72)',
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12,
  },
  rarityText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  relicName: {
    color: '#FFFFFF', fontSize: 31, lineHeight: 37, fontWeight: '900', textAlign: 'center',
    marginTop: 10, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },
  lore: { color: '#D8D1E2', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, maxWidth: 390 },
  rewardRow: {
    width: '100%', maxWidth: 390, minHeight: 70, borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.055)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
  },
  rewardBlock: { flex: 1, alignItems: 'center' },
  rewardDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.13)' },
  rewardLabel: { color: '#91879F', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  rewardValue: { fontSize: 21, fontWeight: '900', marginTop: 4 },
  totalValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 5 },
  buttonWrap: { width: '100%', alignItems: 'center' },
  continueButton: { width: '100%', maxWidth: 390, borderRadius: 17, overflow: 'hidden' },
  continueGradient: {
    minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    paddingHorizontal: 20,
  },
  continueText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.1 },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  vaultHint: { color: '#8F859D', fontSize: 11, fontWeight: '700', marginTop: 9 },
});
