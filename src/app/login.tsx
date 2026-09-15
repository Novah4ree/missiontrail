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
import * as WebBrowser from 'expo-web-browser';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

const BIOMETRIC_REFRESH_TOKEN_KEY =
  'missiontrails.biometric-refresh-token';

// =======================
// LOGIN SCREEN
// =======================
// Purpose: Renders the login screen interface.
export default function LoginScreen() {
  const router = useRouter();

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

  // Purpose: Signs in with email and password, then opens the home screen.
  const saveBiometricRefreshToken = async (
    refreshToken?: string | null
  ) => {
    if (!refreshToken) return;

    try {
      const biometricReady =
        SecureStore.canUseBiometricAuthentication();

      if (!biometricReady) return;

      await SecureStore.setItemAsync(
        BIOMETRIC_REFRESH_TOKEN_KEY,
        refreshToken,
        {
          requireAuthentication: true,
          authenticationPrompt:
            'Use Face ID to protect Mission Trails sign in',
        }
      );
    } catch (error) {
      console.warn(
        'Could not enable biometric sign in:',
        error
      );
    }
  };

  // Purpose: Handles sign in.
  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
        setLoading(false);
        return;
      }
      await saveBiometricRefreshToken(
        data.session?.refresh_token
      );

      setLoading(false);
      router.replace('/home-backup'); 
    } catch {
      Alert.alert('Error', 'An unexpected system error occurred.');
      setLoading(false);
    }
  };

  // Purpose: Starts Google OAuth and restores the returned Supabase session.
  const handleBiometricSignIn = async () => {
    try {
      const hasHardware =
        await LocalAuthentication.hasHardwareAsync();

      if (!hasHardware) {
        Alert.alert(
          'Biometrics Unavailable',
          'This device does not support biometric authentication.'
        );
        return;
      }

      const isEnrolled =
        await LocalAuthentication.isEnrolledAsync();

      if (!isEnrolled) {
        Alert.alert(
          'Biometrics Not Set Up',
          'Set up Face ID, Touch ID, or fingerprint authentication in your device settings first.'
        );
        return;
      }

      const refreshToken =
        await SecureStore.getItemAsync(
          BIOMETRIC_REFRESH_TOKEN_KEY,
          {
            requireAuthentication: true,
            authenticationPrompt:
              'Sign in to Mission Trails',
          }
        );

      if (!refreshToken) {
        Alert.alert(
          'Biometrics Not Enabled Yet',
          'Sign in normally once on this device, then Biometrics Sign In will be available.'
        );
        return;
      }

      const { data, error } =
        await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (error) {
        await SecureStore.deleteItemAsync(
          BIOMETRIC_REFRESH_TOKEN_KEY
        );

        throw error;
      }

      if (!data.session) {
        throw new Error(
          'No Mission Trails session was returned.'
        );
      }

      // Refresh tokens can rotate, so securely save the latest one.
      if (
        data.session.refresh_token &&
        data.session.refresh_token !== refreshToken
      ) {
        await SecureStore.setItemAsync(
          BIOMETRIC_REFRESH_TOKEN_KEY,
          data.session.refresh_token,
          {
            requireAuthentication: true,
            authenticationPrompt:
              'Update Mission Trails biometric sign in',
          }
        );
      }

      router.replace('/home-backup');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (message.toLowerCase().includes('cancel')) {
        return;
      }

      Alert.alert(
        'Biometric Sign In Error',
        message ||
          'Biometric authentication could not be completed.'
      );
    }
  };

  // Purpose: Handles google sign in.
  const handleGoogleSignIn = async () => {
    try {
      const redirectTo = Linking.createURL('auth/callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error('Google did not return a sign-in URL.');
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type !== 'success') {
        return;
      }

      const callbackUrl = new URL(result.url);

      const queryParams = new URLSearchParams(callbackUrl.search);

      const hashParams = new URLSearchParams(
        callbackUrl.hash.replace(/^#/, '')
      );

      const oauthError =
        queryParams.get('error_description') ??
        hashParams.get('error_description') ??
        queryParams.get('error') ??
        hashParams.get('error');

      if (oauthError) {
        throw new Error(oauthError);
      }

      const accessToken =
        queryParams.get('access_token') ??
        hashParams.get('access_token');

      const refreshToken =
        queryParams.get('refresh_token') ??
        hashParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        throw new Error(
          'Google sign in completed, but Mission Trails did not receive the authentication tokens.'
        );
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

      if (sessionError) {
        throw sessionError;
      }

      await saveBiometricRefreshToken(
        sessionData.session?.refresh_token
      );

      router.replace('/home-backup');
    } catch (error) {
      Alert.alert(
        'Google Sign In Error',
        error instanceof Error
          ? error.message
          : 'Google authentication could not be completed.'
      );
    }
  };

  // Purpose: Handles apple sign in.
  const handleAppleSignIn = async () => {
    try {
      const available = await AppleAuthentication.isAvailableAsync();

      if (!available) {
        Alert.alert(
          'Apple Sign In Unavailable',
          'Sign in with Apple is not available on this device.'
        );
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        throw error;
      }

      // Apple normally provides the name only on the first authorization.
      if (credential.fullName) {
        const nameParts = [
          credential.fullName.givenName,
          credential.fullName.middleName,
          credential.fullName.familyName,
        ].filter(Boolean);

        const fullName = nameParts.join(' ');

        if (fullName) {
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              given_name: credential.fullName.givenName,
              family_name: credential.fullName.familyName,
            },
          });

          if (updateError) {
            console.warn(
              'Apple name metadata could not be saved:',
              updateError.message
            );
          }
        }
      }

      router.replace('/home-backup');
    } catch (error) {
      const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String((error as { code?: unknown }).code)
          : '';

      if (errorCode === 'ERR_REQUEST_CANCELED') {
        return;
      }

      Alert.alert(
        'Apple Sign In Error',
        error instanceof Error
          ? error.message
          : 'Apple authentication could not be completed.'
      );
    }
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

        <TouchableOpacity style={styles.bioButton} onPress={handleBiometricSignIn}>
          <MaterialCommunityIcons name="fingerprint" size={20} color="#63D8FF" />
          <Text style={styles.bioText}>Biometrics Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>OR CONTINUE WITH</Text>
        <View style={styles.socialRow}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={18}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
          <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
            <FontAwesome name="google" size={20} color="#EA4335" /><Text style={styles.socialLabel}>Google</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() =>
            router.push(
              '/onboarding_user_info'
            )
          }
        >
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
  appleButton: { flex: 1, height: 60 },
  socialLabel: { color: '#FFFFFF', marginLeft: 10, fontWeight: '600', fontSize: 16 },
  createText: { color: '#AAAAAA', textAlign: 'center', fontSize: 14 },
  createAccent: { color: '#FF4FD8', fontWeight: 'bold' },
});
