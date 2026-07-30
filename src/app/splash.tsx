import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

function CosmicSkyGlow() {

  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    const glowLoop = Animated.loop(
      Animated.sequence([

        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 4800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),

        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 4800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),

      ])
    );

    glowLoop.start();

    return () => glowLoop.stop();

  }, [glowAnim]);

  const animatedGlowStyle = {
    opacity: glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.12, 0.28],
    }),
    transform: [
      {
        scale: glowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.05],
        }),
      },
    ],
  };

  return (

    <View pointerEvents="none" style={styles.cosmicSkyGlow}>

      <Animated.View style={[styles.glowLayer, styles.purpleGlow, animatedGlowStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(126, 34, 206, 0.34)', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, styles.magentaGlow, animatedGlowStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(236, 72, 153, 0.28)', 'transparent']}
          locations={[0, 0.48, 1]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View style={[styles.glowLayer, styles.blueGlow, animatedGlowStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(37, 99, 235, 0.3)', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

    </View>

  );
}

function SkylineGlow() {

  const purplePulse = useRef(new Animated.Value(0)).current;
  const bluePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    const createPulse = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([

          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),

          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),

        ])
      );

    const pulses = [
      createPulse(purplePulse, 3200),
      createPulse(bluePulse, 2800),
    ];

    pulses.forEach((pulse) => pulse.start());

    return () => pulses.forEach((pulse) => pulse.stop());

  }, [bluePulse, purplePulse]);

  const animatedLayerStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 1],
      outputRange: [0.28, 0.72],
    }),
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [2, -2],
        }),
      },
    ],
  });

  return (

    <View pointerEvents="none" style={styles.skylineGlow}>

      <Animated.View
        style={[styles.skylineGlowShape, styles.skylinePurpleGlow, animatedLayerStyle(purplePulse)]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(147, 51, 234, 0.46)', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View
        style={[styles.skylineGlowShape, styles.skylineBlueGlow, animatedLayerStyle(bluePulse)]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(37, 99, 235, 0.42)', 'transparent']}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

    </View>

  );
}

function WaterAuroraGlow() {

  const leftAurora = useRef(new Animated.Value(0)).current;
  const centerAurora = useRef(new Animated.Value(0)).current;
  const rightAurora = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    const createAuroraLoop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([

          Animated.timing(value, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),

          Animated.timing(value, {
            toValue: 0,
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),

        ])
      );

    const auroraLoops = [
      createAuroraLoop(leftAurora, 7200),
      createAuroraLoop(centerAurora, 6000),
      createAuroraLoop(rightAurora, 7800),
    ];

    auroraLoops.forEach((loop) => loop.start());

    return () => auroraLoops.forEach((loop) => loop.stop());

  }, [centerAurora, leftAurora, rightAurora]);

  const animatedAuroraStyle = (
    value: Animated.Value,
    horizontalDrift: number,
    verticalDrift: number
  ) => ({
    opacity: value.interpolate({
      inputRange: [0, 1],
      outputRange: [0.15, 0.35],
    }),
    transform: [
      {
        translateX: value.interpolate({
          inputRange: [0, 1],
          outputRange: [-horizontalDrift, horizontalDrift],
        }),
      },
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [verticalDrift, -verticalDrift],
        }),
      },
    ],
  });

  return (

    <View pointerEvents="none" style={styles.waterAuroraGlow}>

      <Animated.View
        style={[
          styles.waterAuroraOval,
          styles.waterAuroraLeft,
          animatedAuroraStyle(leftAurora, 3, 1),
        ]}
      >
        <LinearGradient
          colors={[
            'transparent',
            'rgba(34, 211, 238, 0.24)',
            'rgba(37, 99, 235, 0.28)',
            'rgba(139, 92, 246, 0.2)',
            'transparent',
          ]}
          locations={[0, 0.24, 0.52, 0.76, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.waterAuroraOval,
          styles.waterAuroraCenter,
          animatedAuroraStyle(centerAurora, 2, 1),
        ]}
      >
        <LinearGradient
          colors={[
            'transparent',
            'rgba(139, 92, 246, 0.26)',
            'rgba(34, 211, 238, 0.34)',
            'rgba(99, 102, 241, 0.32)',
            'rgba(236, 72, 153, 0.24)',
            'transparent',
          ]}
          locations={[0, 0.18, 0.4, 0.58, 0.8, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.waterAuroraOval,
          styles.waterAuroraRight,
          animatedAuroraStyle(rightAurora, 3, 1),
        ]}
      >
        <LinearGradient
          colors={[
            'transparent',
            'rgba(236, 72, 153, 0.2)',
            'rgba(196, 181, 253, 0.26)',
            'rgba(37, 99, 235, 0.24)',
            'transparent',
          ]}
          locations={[0, 0.24, 0.5, 0.76, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

    </View>

  );
}

type Star = {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
};

const COSMIC_STAR_CONFIG: Star[] = [
  { x: 7, y: 10, size: 2, color: '#ffffff', delay: 80, duration: 1700 },
  { x: 15, y: 25, size: 3, color: '#dbeafe', delay: 510, duration: 2400 },
  { x: 24, y: 13, size: 2, color: '#c4b5fd', delay: 960, duration: 1900 },
  { x: 31, y: 32, size: 5, color: '#67e8f9', delay: 230, duration: 3100 },
  { x: 39, y: 7, size: 3, color: '#ffffff', delay: 1310, duration: 2200 },
  { x: 47, y: 20, size: 2, color: '#fbcfe8', delay: 680, duration: 1600 },
  { x: 56, y: 11, size: 3, color: '#ddd6fe', delay: 1540, duration: 2800 },
  { x: 64, y: 28, size: 4, color: '#bae6fd', delay: 360, duration: 2600 },
  { x: 71, y: 8, size: 2, color: '#a5f3fc', delay: 1120, duration: 1800 },
  { x: 77, y: 19, size: 7, color: '#f0f9ff', delay: 790, duration: 3400 },
  { x: 85, y: 31, size: 3, color: '#e9d5ff', delay: 1430, duration: 2300 },
  { x: 92, y: 14, size: 2, color: '#f9a8d4', delay: 440, duration: 2000 },
  { x: 11, y: 38, size: 4, color: '#c4b5fd', delay: 1740, duration: 2900 },
  { x: 4, y: 53, size: 2, color: '#bae6fd', delay: 620, duration: 1500 },
  { x: 95, y: 40, size: 3, color: '#ffffff', delay: 1010, duration: 2500 },
  { x: 96, y: 57, size: 4, color: '#a78bfa', delay: 190, duration: 3200 },
  { x: 20, y: 6, size: 2, color: '#fbcfe8', delay: 1220, duration: 2100 },
  { x: 87, y: 5, size: 3, color: '#67e8f9', delay: 870, duration: 2700 },
];

function CosmicStars() {

  const starAnimations = useRef(
    COSMIC_STAR_CONFIG.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {

    const twinkles = COSMIC_STAR_CONFIG.map((star, index) =>
      Animated.loop(
        Animated.sequence([

          Animated.delay(star.delay),

          Animated.timing(starAnimations[index], {
            toValue: 1,
            duration: star.duration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),

          Animated.timing(starAnimations[index], {
            toValue: 0,
            duration: star.duration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),

        ])
      )
    );

    twinkles.forEach((twinkle) => twinkle.start());

    return () => twinkles.forEach((twinkle) => twinkle.stop());

  }, [starAnimations]);

  return (

    <View pointerEvents="none" style={styles.cosmicStars}>

      {COSMIC_STAR_CONFIG.map((star, index) => {
        const animation = starAnimations[index];
        const flareThickness = Math.max(1, star.size * 0.22);
        const coreSize = Math.max(1.2, star.size * 0.42);
        const glowSize = star.size * 1.8;

        return (

          <Animated.View
            key={`${star.x}-${star.y}`}
            style={[
              styles.cosmicStar,
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                opacity: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.18, 0.92],
                }),
                transform: [
                  { translateX: -star.size / 2 },
                  { translateY: -star.size / 2 },
                  {
                    scale: animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.84, 1.12],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.cosmicStarGlow,
                {
                  left: (star.size - glowSize) / 2,
                  top: (star.size - glowSize) / 2,
                  width: glowSize,
                  height: glowSize,
                  backgroundColor: star.color,
                },
              ]}
            />
            <View
              style={[
                styles.cosmicStarVerticalFlare,
                {
                  left: (star.size - flareThickness) / 2,
                  width: flareThickness,
                  height: star.size,
                  backgroundColor: star.color,
                },
              ]}
            />
            <View
              style={[
                styles.cosmicStarHorizontalFlare,
                {
                  top: (star.size - flareThickness) / 2,
                  width: star.size,
                  height: flareThickness,
                  backgroundColor: star.color,
                },
              ]}
            />
            <View
              style={[
                styles.cosmicStarCore,
                {
                  left: (star.size - coreSize) / 2,
                  top: (star.size - coreSize) / 2,
                  width: coreSize,
                  height: coreSize,
                  backgroundColor: '#ffffff',
                  shadowColor: star.color,
                },
              ]}
            />
          </Animated.View>

        );
      })}

    </View>

  );
}

const CITY_WINDOW_LIGHT_CONFIG = [
  { left: 19, top: 62, size: 2, group: 0 },
  { left: 24, top: 48, size: 2, group: 1 },
  { left: 29, top: 72, size: 1.5, group: 2 },
  { left: 34, top: 38, size: 2.5, group: 0 },
  { left: 39, top: 58, size: 2, group: 2 },
  { left: 44, top: 27, size: 2, group: 1 },
  { left: 48, top: 68, size: 2.5, group: 0 },
  { left: 52, top: 43, size: 2, group: 2 },
  { left: 57, top: 76, size: 1.5, group: 1 },
  { left: 62, top: 34, size: 2.5, group: 0 },
  { left: 67, top: 59, size: 2, group: 1 },
  { left: 72, top: 47, size: 1.5, group: 2 },
  { left: 77, top: 70, size: 2, group: 0 },
  { left: 82, top: 55, size: 2.5, group: 2 },
] as const;

const CITY_WINDOW_COLORS = ['#60a5fa', '#3b82f6', '#93c5fd'] as const;

function CityWindowLights() {

  const windowPulses = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {

    const durations = [1200, 1500, 1800];
    const delays = [0, 240, 500];
    const loops = windowPulses.map((pulse, index) =>
      Animated.loop(
        Animated.sequence([

          Animated.delay(delays[index]),

          Animated.timing(pulse, {
            toValue: 1,
            duration: durations[index],
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),

          Animated.timing(pulse, {
            toValue: 0,
            duration: durations[index],
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),

        ])
      )
    );

    loops.forEach((loop) => loop.start());

    return () => loops.forEach((loop) => loop.stop());

  }, [windowPulses]);

  return (

    <View pointerEvents="none" style={styles.cityWindowLights}>

      {CITY_WINDOW_LIGHT_CONFIG.map((light) => {
        const pulse = windowPulses[light.group];

        return (

          <Animated.View
            key={`${light.left}-${light.top}`}
            style={[
              styles.cityWindowLight,
              {
                left: `${light.left}%`,
                top: `${light.top}%`,
                width: light.size,
                height: light.size,
                borderRadius: light.size / 2,
                backgroundColor: CITY_WINDOW_COLORS[light.group],
                shadowColor: CITY_WINDOW_COLORS[light.group],
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 1],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.35],
                    }),
                  },
                ],
              },
            ]}
          />

        );
      })}

    </View>

  );
}

type TrailDotPosition = {
  x: number;
  y: number;
  delay: number;
  color: string;
  size: number;
};

const LEFT_TRAIL_DOTS: TrailDotPosition[] = [
  { x: 0.292, y: 0.832, delay: 0, color: '#31C8FF', size: 3 },
  { x: 0.305, y: 0.805, delay: 150, color: '#4D7CFF', size: 2 },
  { x: 0.321, y: 0.778, delay: 300, color: '#A855F7', size: 3 },
  { x: 0.338, y: 0.75, delay: 450, color: '#FF4FD8', size: 3 },
  { x: 0.356, y: 0.722, delay: 600, color: '#31C8FF', size: 4 },
  { x: 0.374, y: 0.698, delay: 750, color: '#D946EF', size: 3 },
  { x: 0.392, y: 0.677, delay: 900, color: '#4D7CFF', size: 2 },
  { x: 0.409, y: 0.658, delay: 1050, color: '#FF4FD8', size: 3 },
  { x: 0.425, y: 0.641, delay: 1200, color: '#A855F7', size: 3 },
  { x: 0.439, y: 0.626, delay: 1350, color: '#31C8FF', size: 2 },
  { x: 0.451, y: 0.612, delay: 1500, color: '#D946EF', size: 3 },
  { x: 0.461, y: 0.6, delay: 1650, color: '#4D7CFF', size: 3 },
  { x: 0.468, y: 0.589, delay: 1800, color: '#FF4FD8', size: 2 },

];

const RIGHT_TRAIL_DOTS: TrailDotPosition[] = [
  { x: 0.716, y: 0.832, delay: 110, color: '#FF4FD8', size: 3 },
  { x: 0.697, y: 0.805, delay: 260, color: '#A855F7', size: 2 },
  { x: 0.677, y: 0.778, delay: 410, color: '#4D7CFF', size: 3 },
  { x: 0.654, y: 0.75, delay: 560, color: '#31C8FF', size: 3 },
  { x: 0.632, y: 0.722, delay: 710, color: '#FF4FD8', size: 4 },
  { x: 0.61, y: 0.698, delay: 860, color: '#D946EF', size: 3 },
  { x: 0.589, y: 0.677, delay: 1010, color: '#4D7CFF', size: 2 },
  { x: 0.571, y: 0.658, delay: 1160, color: '#FF4FD8', size: 3 },
  { x: 0.554, y: 0.641, delay: 1310, color: '#31C8FF', size: 3 },
  { x: 0.54, y: 0.626, delay: 1460, color: '#A855F7', size: 2 },
  { x: 0.528, y: 0.612, delay: 1610, color: '#4D7CFF', size: 3 },
  { x: 0.518, y: 0.6, delay: 1760, color: '#FF4FD8', size: 3 },
  { x: 0.512, y: 0.589, delay: 1910, color: '#A855F7', size: 2 },
  
];

const TRAIL_SPARKLE_SEQUENCE_DURATION = 4200;

type TrailSparklePathProps = {
  positions: TrailDotPosition[];
  progress: Animated.Value;
  width: number;
  height: number;
};

function TrailSparklePath({
  positions,
  progress,
  width,
  height,
}: TrailSparklePathProps) {

  return positions.map((position) => {
    const start = position.delay / TRAIL_SPARKLE_SEQUENCE_DURATION;

    return (

      <Animated.View
        key={`${position.x}-${position.y}`}
        style={[
          styles.trailEdgeDot,
          {
            left: position.x * width - position.size / 2,
            top: position.y * height - position.size / 2,
            width: position.size,
            height: position.size,
            borderRadius: position.size / 2,
            backgroundColor: position.color,
            shadowColor: position.color,
            opacity: progress.interpolate({
              inputRange: [start, start + 0.033, start + 0.071, start + 0.119],
              outputRange: [0, 1, 0.82, 0],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [start, start + 0.033, start + 0.071, start + 0.119],
                  outputRange: [0.75, 1.2, 1.08, 0.75],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      />

    );
  });
}

function LeftTrailSparkles(props: Omit<TrailSparklePathProps, 'positions'>) {
  return <TrailSparklePath {...props} positions={LEFT_TRAIL_DOTS} />;
}

function RightTrailSparkles(props: Omit<TrailSparklePathProps, 'positions'>) {
  return <TrailSparklePath {...props} positions={RIGHT_TRAIL_DOTS} />;
}

function TrailEdgeSparkles() {

  const { width, height } = useWindowDimensions();
  const leftProgress = useRef(new Animated.Value(0)).current;
  const rightProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createTrailLoop = (progress: Animated.Value) =>
      Animated.loop(
        Animated.timing(progress, {
        toValue: 1,
        duration: TRAIL_SPARKLE_SEQUENCE_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
        })
      );

    const leftLoop = createTrailLoop(leftProgress);
    const rightLoop = createTrailLoop(rightProgress);

    leftLoop.start();
    rightLoop.start();

    return () => {
      leftLoop.stop();
      rightLoop.stop();
    };
  }, [leftProgress, rightProgress]);

  return (

    <View pointerEvents="none" style={styles.trailEdgeSparkles}>

      <LeftTrailSparkles progress={leftProgress} width={width} height={height} />
      <RightTrailSparkles progress={rightProgress} width={width} height={height} />

    </View>

  );
}

export default function SplashScreen() {

  const router = useRouter();

  const [fadeAnim] = useState(() => new Animated.Value(0.3));

  useEffect(() => {

    Animated.loop(
      Animated.sequence([

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),

        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),

      ])
    ).start();

  }, [fadeAnim]);

  const handleEnter = () => {

    router.replace('/login');

  };

  return (

    <View style={styles.container}>

      <ImageBackground
        source={require('../../assets/images/splash_screen.png')}
        style={styles.background}
        resizeMode="cover"
      >

        <CosmicSkyGlow />
        <CosmicStars />
        <SkylineGlow />
        <WaterAuroraGlow />
        <CityWindowLights />
        <TrailEdgeSparkles />

        <View style={styles.buttonContainer}>

          <Animated.View style={{ opacity: fadeAnim }}>

            <TouchableOpacity
              style={styles.enterButton}
              onPress={handleEnter}
              activeOpacity={0.8}
            >

              <Text style={styles.buttonText}>
                ENTER
              </Text>

            </TouchableOpacity>

          </Animated.View>

        </View>

      </ImageBackground>

    </View>

  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
  },

  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  cosmicSkyGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },

  glowLayer: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },

  purpleGlow: {
    top: '-18%',
    left: '-25%',
    width: '92%',
    height: '64%',
  },

  magentaGlow: {
    position: 'absolute',
    top: '2%',
    right: '3%',
    width: '68%',
    height: '48%',
    borderRadius: 999,
    overflow: 'hidden',
  },

  blueGlow: {
    top: '-24%',
    left: '16%',
    width: '70%',
    height: '54%',
  },

  cosmicStars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    overflow: 'hidden',
  },

  cosmicStar: {
    position: 'absolute',
  },

  cosmicStarGlow: {
    position: 'absolute',
    opacity: 0.16,
    transform: [{ rotate: '45deg' }],
  },

  cosmicStarVerticalFlare: {
    position: 'absolute',
    top: 0,
    borderRadius: 999,
  },

  cosmicStarHorizontalFlare: {
    position: 'absolute',
    left: 0,
    borderRadius: 999,
  },

  cosmicStarCore: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 2,
    elevation: 1,
    transform: [{ rotate: '45deg' }],
  },

  skylineGlow: {
    position: 'absolute',
    top: '39%',
    left: 0,
    right: 0,
    height: '19%',
    overflow: 'hidden',
  },

  skylineGlowShape: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 999,
  },

  skylinePurpleGlow: {
    left: '-9%',
    bottom: '8%',
    width: '58%',
    height: '66%',
  },

  skylineBlueGlow: {
    left: '18%',
    bottom: '22%',
    width: '52%',
    height: '74%',
  },

  waterAuroraGlow: {
    position: 'absolute',
    top: '55.5%',
    left: '4%',
    right: '4%',
    height: '5.5%',
  },

  waterAuroraOval: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 999,
  },

  waterAuroraLeft: {
    top: '25%',
    left: '2%',
    width: '40%',
    height: '42%',
  },

  waterAuroraCenter: {
    top: '8%',
    left: '25%',
    width: '50%',
    height: '62%',
  },

  waterAuroraRight: {
    top: '27%',
    right: '2%',
    width: '40%',
    height: '40%',
  },

  cityWindowLights: {
    position: 'absolute',
    top: '39%',
    left: 0,
    right: 0,
    height: '19%',
    overflow: 'hidden',
  },

  cityWindowLight: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 3,
    elevation: 2,
  },

  trailEdgeSparkles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  trailEdgeDot: {
    position: 'absolute',
    shadowOpacity: 0.8,
    shadowRadius: 1.5,
    elevation: 1,
  },

  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 80,
  },

  enterButton: {
    backgroundColor: '#0066ff',
    paddingVertical: 16,
    paddingHorizontal: 55,
    borderRadius: 14,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.35,

    shadowRadius: 5,

    elevation: 8,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },

});
