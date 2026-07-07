import React, { useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { supabase } from '../../lib/supabase';

export default function ForgotPasswordScreen() {

  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {

    if (!email.trim()) {
      Alert.alert(
        'Missing Email',
        'Please enter your email address.'
      );
      return;
    }

    try {

      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: 'myapp://reset-password',
        }
      );

      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert(
        'Email Sent',
        'If an account exists for that email, a password reset link has been sent.'
      );

      router.back();

    } catch {

      setLoading(false);

      Alert.alert(
        'Error',
        'Something went wrong while sending the reset email.'
      );

    }

  };

  return (

    <View style={styles.container}>

      <View style={styles.card}>

        <Text style={styles.title}>
          Forgot Password
        </Text>

        <Text style={styles.subtitle}>
          Enter your email address and we'll send you a password reset link.
        </Text>

        <View style={styles.inputBox}>

          <Ionicons
            name="mail-outline"
            size={20}
            color="#63D8FF"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#777"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleResetPassword}
          disabled={loading}
        >

          <LinearGradient
            colors={[
              '#ff3cac',
              '#7B42F6',
              '#2b86ff',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          >

            <Text style={styles.buttonText}>
              {loading ? 'SENDING...' : 'SEND RESET LINK'}
            </Text>

          </LinearGradient>

        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>
            ← Back to Login
          </Text>
        </TouchableOpacity>

      </View>

    </View>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#02020A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },

  card: {
    width: '92%',
    maxWidth: 480,
    backgroundColor: '#101020',
    borderRadius: 32,
    paddingVertical: 35,
    paddingHorizontal: 24,

    shadowColor: '#7B42F6',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },

  subtitle: {
    color: '#AAAAAA',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A36',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 60,
    marginBottom: 28,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 10,
  },

  button: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 25,
  },

  gradient: {
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  backText: {
    color: '#63D8FF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },

});