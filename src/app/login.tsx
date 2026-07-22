// =======================
// IMPORTS
// =======================
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

// =======================
// LOGIN SCREEN
// =======================
export default function LoginScreen() {
  const router = useRouter();
  const homeRedirectUrl = Linking.createURL('/home-backup');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [gradientAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(gradientAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, [gradientAnim]);

  const slideX = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 140],
  });

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
        setLoading(false);
        return;
      }
      setLoading(false);
      router.replace('/home-backup'); 
    } catch {
      Alert.alert('Error', 'An unexpected system error occurred.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: homeRedirectUrl },
    });
    if (error) Alert.alert('Google Sign In Error', error.message);
  };

  const handleAppleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: homeRedirectUrl },
    });
    if (error) Alert.alert('Apple Sign In Error', error.message);
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/splash_screen.png')} style={styles.logo} />
      <Text style={styles.subtitle}>CHART YOUR JOURNEY. EXPLORE YOUR WORLD.</Text>
      <View style={styles.card}>
        <Text style={styles.loginTitle}>Login</Text>
        <View style={styles.inputBox}>
          <Ionicons name="mail-outline" size={20} color="#63D8FF" />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#777"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={20} color="#63D8FF" />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#777"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#63D8FF" />
          </TouchableOpacity>
        </View>

        {/* FORGOT PASSWORD BUTTON */}
        <TouchableOpacity onPress={() => router.push('/forgot-password')}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signInWrapper} onPress={handleSignIn} disabled={loading}>
          <Animated.View style={{ transform: [{ translateX: slideX }], position: 'absolute', width: '200%', height: '100%' }}>
            <LinearGradient colors={['#ff3cac', '#7B42F6', '#2b86ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient} />
          </Animated.View>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.signInText}>SIGN IN</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.bioButton}>
          <MaterialCommunityIcons name="fingerprint" size={20} color="#63D8FF" />
          <Text style={styles.bioText}>Biometrics Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>OR CONTINUE WITH</Text>
        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
            <FontAwesome name="apple" size={24} color="#FFFFFF" /><Text style={styles.socialLabel}>Apple</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
            <FontAwesome name="google" size={20} color="#EA4335" /><Text style={styles.socialLabel}>Google</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/Signup')}>
          <Text style={styles.createText}>Don&apos;t have an account? <Text style={styles.createAccent}>Create Account</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02020A', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22 },
  logo: { width: 700, height: 420, resizeMode: 'contain', marginTop: -260, marginBottom: -120, alignSelf: 'center' },
  subtitle: { color: '#63D8FF', fontSize: 11, letterSpacing: 2, marginBottom: 16, textAlign: 'center' },
  card: { width: '92%', maxWidth: 480, backgroundColor: '#101020', borderRadius: 32, paddingVertical: 26, paddingHorizontal: 22, shadowColor: '#7B42F6', shadowOpacity: 0.45, shadowRadius: 24, elevation: 20 },
  loginTitle: { color: '#FFF', fontSize: 34, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A36', borderRadius: 18, paddingHorizontal: 16, height: 60, marginBottom: 18 },
  input: { flex: 1, color: '#FFF', fontSize: 16, marginLeft: 10 },
  forgotText: { color: '#63D8FF', textAlign: 'right', fontSize: 14, marginBottom: 20 },
  signInWrapper: { height: 58, borderRadius: 18, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  gradient: { width: '100%', height: '100%' },
  signInText: { color: '#FFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  bioButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#17172D', borderRadius: 18, paddingVertical: 16, marginBottom: 22 },
  bioText: { color: '#63D8FF', marginLeft: 10, fontWeight: '600', fontSize: 16 },
  orText: { color: '#767676', textAlign: 'center', fontSize: 11, marginBottom: 18, letterSpacing: 2 },
  socialRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, marginBottom: 24 },
  socialButton: { flex: 1, backgroundColor: '#1A1A36', borderRadius: 18, height: 60, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  socialLabel: { color: '#FFFFFF', marginLeft: 10, fontWeight: '600', fontSize: 16 },
  createText: { color: '#AAAAAA', textAlign: 'center', fontSize: 14 },
  createAccent: { color: '#FF4FD8', fontWeight: 'bold' },
});
