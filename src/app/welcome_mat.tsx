// ======================================================
// WELCOME MAT
// ======================================================

import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';

// ======================================================
// SCREEN
// ======================================================

export default function WelcomeMat() {

  const { email } = useLocalSearchParams<{ email?: string }>();

  const [isVerified] = useState(false);

  // ======================================================
  // OPEN EMAIL APP (FIXED)
  // ======================================================

  const openEmailInbox = async () => {
    try {
      // This opens the user's default email app (Gmail, Apple Mail, Outlook, etc.)
      await Linking.openURL('mailto:');
    } catch (err) {
      console.log('Failed to open email app:', err);
    }
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>
        Mission Trail
      </Text>

      {!isVerified ? (
        <>
          <Text style={styles.message}>
            We sent a verification email to:
            {'\n'}
            {String(email)}
          </Text>

          {/* CHECK EMAIL BUTTON */}
          <TouchableOpacity
            style={styles.emailButton}
            onPress={openEmailInbox}
          >
            <Text style={styles.buttonText}>
              CHECK EMAIL
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.verifiedMessage}>
            Verified successfully.
          </Text>

          <TouchableOpacity
            style={styles.successButton}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.buttonText}>
              GO TO LOGIN
            </Text>
          </TouchableOpacity>
        </>
      )}

    </View>
  );
}

// ======================================================
// STYLES (FIXED BUTTON WIDTH)
// ======================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25,
  },

  title: {
    color: '#fff',
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 30,
  },

  message: {
    color: '#ccc',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },

  verifiedMessage: {
    color: '#63D8FF',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },

  // ✅ FIXED: usable button size
  emailButton: {
    width: '10%',
    height: 45,
    backgroundColor: '#7B42F6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  successButton: {
    width: '70%',
    height: 45,
    backgroundColor: '#14b86a',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
});