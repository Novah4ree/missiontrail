// =======================
// IMPORTS
// =======================

import React, { useEffect, useRef, useState } from 'react';

import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
<<<<<<< Updated upstream
=======
  Alert,
  ActivityIndicator,
>>>>>>> Stashed changes
} from 'react-native';

import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

import { Href, useRouter } from 'expo-router';

// =======================
// LOGIN SCREEN
// =======================

export default function LoginScreen() {

  // =======================
  // ROUTER
  // =======================

  const router = useRouter();

  // =======================
  // USER INPUT STATES
  // =======================

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // =======================
  // PASSWORD VISIBILITY
  // =======================

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // =======================
  // ANIMATED GRADIENT
  // =======================

  const gradientAnim = useRef(new Animated.Value(0)).current;

  // =======================
  // START BUTTON ANIMATION
  // =======================

  useEffect(() => {

    Animated.loop(

      Animated.sequence([

        Animated.timing(gradientAnim,{
          toValue:1,
          duration:2500,
          useNativeDriver:true,
        }),

        Animated.timing(gradientAnim,{
          toValue:0,
          duration:2500,
          useNativeDriver:true,
        }),

      ])

    ).start();

  },[]);

  // =======================
  // GRADIENT SLIDE
  // =======================

  const slideX = gradientAnim.interpolate({
    inputRange:[0,1],
    outputRange:[-140,140],
  });

  // =======================
<<<<<<< Updated upstream
  // SCREEN UI
  // =======================

=======
  // EMAIL SIGN IN (DATABASE CHECK)
  // =======================

  const handleSignIn = async () => {
    // Stops empty fields and password bypass dead in their tracks
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

      // Explicitly forcing screen route swap fallback
      setLoading(false);
      router.replace('/home-backup' as Href);
    } catch (err) {
      Alert.alert('Error', 'An unexpected system error occurred.');
      setLoading(false);
    }
  };

  // =======================
  // GOOGLE SIGN IN
  // =======================

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'myapp://home-backup',
      },
    });

    if (error) {
      Alert.alert('Google Sign In Error', error.message);
    }
  };

  // =======================
  // APPLE SIGN IN
  // =======================

  const handleAppleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'myapp://home-backup',
      },
    });

    if (error) {
      Alert.alert('Apple Sign In Error', error.message);
    }
  };

>>>>>>> Stashed changes
  return (

    <View style={styles.container}>

      {/* =======================
          MAIN LOGO IMAGE
      ======================= */}
      {/* Wider image and moved upward */}

      <Image
        source={require('../../assets/images/splash_screen.png')}
        style={styles.logo}
      />

      {/* =======================
          SUBTITLE
      ======================= */}

      <Text style={styles.subtitle}>
        CHART YOUR JOURNEY. EXPLORE YOUR WORLD.
      </Text>

      {/* =======================
          LOGIN CARD
      ======================= */}

      <View style={styles.card}>

        {/* =======================
            LOGIN TITLE
        ======================= */}

        <Text style={styles.loginTitle}>
          Login
        </Text>

        {/* =======================
            EMAIL INPUT
        ======================= */}

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
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

        </View>

        {/* =======================
            PASSWORD INPUT
        ======================= */}

        <View style={styles.inputBox}>

          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="#63D8FF"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#777"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          {/* =======================
              PASSWORD EYE BUTTON
          ======================= */}

          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
          >

            <Ionicons
              name={
                showPassword
                ? 'eye-outline'
                : 'eye-off-outline'
              }
              size={20}
              color="#63D8FF"
            />

          </TouchableOpacity>

        </View>

        {/* =======================
            FORGOT PASSWORD
        ======================= */}

        <TouchableOpacity>

          <Text style={styles.forgotText}>
            Forgot Password?
          </Text>

        </TouchableOpacity>

        {/* =======================
            SIGN IN BUTTON
        ======================= */}

        <TouchableOpacity
          style={styles.signInWrapper}
          onPress={handleSignIn}
          disabled={loading}
        >

          {/* =======================
              MOVING GRADIENT
          ======================= */}

          <Animated.View
            style={{
              transform:[{translateX:slideX}],
              position:'absolute',
              width:'200%',
              height:'100%',
            }}
          >

            <LinearGradient
              colors={[
                '#ff3cac',
                '#7B42F6',
                '#2b86ff'
              ]}
              start={{x:0,y:0}}
              end={{x:1,y:0}}
              style={styles.gradient}
            />

          </Animated.View>

<<<<<<< Updated upstream
          <Text style={styles.signInText}>
            SIGN IN
          </Text>

=======
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.signInText}>SIGN IN</Text>
          )}
>>>>>>> Stashed changes
        </TouchableOpacity>

        {/* =======================
            BIOMETRIC BUTTON
        ======================= */}

        <TouchableOpacity
          style={styles.bioButton}
        >

          <MaterialCommunityIcons
            name="fingerprint"
            size={20}
            color="#63D8FF"
          />

          <Text style={styles.bioText}>
            Biometrics Sign In
          </Text>

        </TouchableOpacity>

        {/* =======================
            SOCIAL LOGIN TITLE
        ======================= */}

        <Text style={styles.orText}>
          OR CONTINUE WITH
        </Text>

        {/* =======================
            SOCIAL BUTTONS
        ======================= */}

        <View style={styles.socialRow}>

          {/* =======================
              APPLE BUTTON
          ======================= */}

          <TouchableOpacity
            style={styles.socialButton}
          >

            <FontAwesome
              name="apple"
              size={24}
              color="#FFFFFF"
            />

            <Text style={styles.socialLabel}>
              Apple
            </Text>

          </TouchableOpacity>

          {/* =======================
              GOOGLE BUTTON
          ======================= */}

          <TouchableOpacity
            style={styles.socialButton}
          >

            <FontAwesome
              name="google"
              size={20}
              color="#EA4335"
            />

            <Text style={styles.socialLabel}>
              Google
            </Text>

          </TouchableOpacity>

        </View>

        {/* =======================
            CREATE ACCOUNT BUTTON
        ======================= */}

        <TouchableOpacity
          onPress={() => router.push('/Signup' as Href)}
        >

          <Text style={styles.createText}>
            Don't have an account?{' '}
            <Text style={styles.createAccent}>
              Create Account
            </Text>
          </Text>

        </TouchableOpacity>

      </View>

    </View>

  );
}

// =======================
// STYLES
// =======================

const styles = StyleSheet.create({

  // =======================
  // MAIN CONTAINER
  // =======================

  container:{
    flex:1,
    backgroundColor:'#02020A',
    justifyContent:'center',
    alignItems:'center',
    paddingHorizontal:22,
  },

  // =======================
  // MAIN IMAGE
  // =======================
  // Widened image and moved upward

  logo:{
    width:700,
    height:420,

    resizeMode:'contain',

    // Push image upward
    marginTop:-260,

    // Creates space BELOW image
    // so it sits ABOVE the text cleanly
    marginBottom:-120,

    alignSelf:'center',
},
  // =======================
  // SUBTITLE
  // =======================

  subtitle:{
    color:'#63D8FF',
    fontSize:11,
    letterSpacing:2,
    marginBottom:16,
    textAlign:'center',
  },

  // =======================
  // MAIN CARD
  // =======================
  // Removed ugly double border lines

  card:{
    width:'92%',
    maxWidth:480,
    backgroundColor:'#101020',
    borderRadius:32,
    paddingVertical:26,
    paddingHorizontal:22,

    shadowColor:'#7B42F6',
    shadowOpacity:0.45,
    shadowRadius:24,
    elevation:20,
  },

  // =======================
  // LOGIN TITLE
  // =======================

  loginTitle:{
    color:'#FFF',
    fontSize:34,
    fontWeight:'700',
    textAlign:'center',
    marginBottom:24,
  },

  // =======================
  // INPUT BOX
  // =======================

  inputBox:{
    flexDirection:'row',
    alignItems:'center',
    backgroundColor:'#1A1A36',
    borderRadius:18,
    paddingHorizontal:16,
    height:60,
    marginBottom:18,
  },

  // =======================
  // INPUT TEXT
  // =======================

  input:{
    flex:1,
    color:'#FFF',
    fontSize:16,
    marginLeft:10,
  },

  // =======================
  // FORGOT PASSWORD
  // =======================

  forgotText:{
    color:'#63D8FF',
    textAlign:'right',
    fontSize:14,
    marginBottom:20,
  },

  // =======================
  // SIGN IN BUTTON
  // =======================

  signInWrapper:{
    height:58,
    borderRadius:18,
    overflow:'hidden',
    justifyContent:'center',
    alignItems:'center',
    marginBottom:16,
  },

  // =======================
  // BUTTON GRADIENT
  // =======================

  gradient:{
    width:'100%',
    height:'100%',
  },

  // =======================
  // SIGN IN TEXT
  // =======================

  signInText:{
    color:'#FFF',
    fontSize:20,
    fontWeight:'bold',
    letterSpacing:1,
  },

  // =======================
  // BIOMETRICS BUTTON
  // =======================

  bioButton:{
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'#17172D',
    borderRadius:18,
    paddingVertical:16,
    marginBottom:22,
  },

  // =======================
  // BIOMETRIC TEXT
  // =======================

  bioText:{
    color:'#63D8FF',
    marginLeft:10,
    fontWeight:'600',
    fontSize:16,
  },

  // =======================
  // OR TEXT
  // =======================

  orText:{
    color:'#767676',
    textAlign:'center',
    fontSize:11,
    marginBottom:18,
    letterSpacing:2,
  },

  // =======================
  // SOCIAL BUTTON ROW
  // =======================

  socialRow:{
    flexDirection:'row',
    justifyContent:'space-between',
    gap:14,
    marginBottom:24,
  },

  // =======================
  // SOCIAL BUTTON
  // =======================

  socialButton:{
    flex:1,
    backgroundColor:'#1A1A36',
    borderRadius:18,
    height:60,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },

  // =======================
  // SOCIAL LABEL
  // =======================

  socialLabel:{
    color:'#FFFFFF',
    marginLeft:10,
    fontWeight:'600',
    fontSize:16,
  },

  // =======================
  // CREATE ACCOUNT TEXT
  // =======================

  createText:{
    color:'#AAAAAA',
    textAlign:'center',
    fontSize:14,
  },

  // =======================
  // CREATE ACCOUNT HIGHLIGHT
  // =======================

  createAccent:{
    color:'#FF4FD8',
    fontWeight:'bold',
  },

});