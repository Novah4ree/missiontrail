import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ImageBackground,
  TouchableOpacity,
  Animated,
} from 'react-native';

import { useRouter } from 'expo-router';

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
