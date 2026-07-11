// ======================================================
// SIGNUP.TSX
// ======================================================

import React, { useState } from 'react';

import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// ======================================================
// SUPABASE
// ======================================================

import { supabase } from '../../lib/supabase';

// ======================================================
// SCREEN
// ======================================================

export default function SignupScreen() {

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    // Basic structural check only
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      if (Platform.OS === 'web') {
        alert('Please fill out all fields.');
      } else {
        Alert.alert('Missing Information', 'Please fill out all fields.');
      }
      return;
    }

    try {
      setLoading(true);

      // 1. Tell Supabase to send the verification email
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: "exp://192.168.1.25:8081",
        },
      });

      setLoading(false);

      // 2. Go directly to the welcome mat screen no matter what
      router.push('/welcome_mat');

    } catch (err: any) {
      setLoading(false);
      // Silently pass to welcome mat even if network errors or limits happen
      router.push('/welcome_mat');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.signupBox}>
        <Text style={styles.title}>Create Account</Text>

        {/* FIRST NAME */}
        <View style={styles.inputBox}>
          <Ionicons name="person-outline" size={22} color="#63D8FF" />
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#888"
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>

        {/* LAST NAME */}
        <View style={styles.inputBox}>
          <Ionicons name="person-outline" size={22} color="#63D8FF" />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#888"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

        {/* EMAIL */}
        <View style={styles.inputBox}>
          <Ionicons name="mail-outline" size={22} color="#63D8FF" />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* PASSWORD */}
        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={22} color="#63D8FF" />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color="#63D8FF"
            />
          </TouchableOpacity>
        </View>

        {/* CONFIRM PASSWORD */}
        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={22} color="#63D8FF" />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#888"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons
              name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color="#63D8FF"
            />
          </TouchableOpacity>
        </View>

        {/* BUTTON */}
        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  signupBox: {
    width: '92%',
    maxWidth: 520,
    backgroundColor: 'rgba(12,12,28,0.94)',
    borderRadius: 35,
    paddingVertical: 35,
    paddingHorizontal: 25,
    shadowColor: '#7B42F6',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 35,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A36',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 62,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 10,
  },
  button: {
    marginTop: 10,
    height: 65,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7B42F6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});