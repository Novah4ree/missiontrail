// ======================================================
// WELCOME_MAT.TSX
// ======================================================
// Mission Trail Verification Screen
//
// FLOW:
//
// 1. User creates account
// 2. User arrives here
// 3. Welcome message appears
// 4. User checks email
// 5. User clicks verification link
// 6. Supabase updates verification status
// 7. User returns to app
// 8. User presses CHECK VERIFICATION
// 9. Screen updates automatically
// 10. VERIFIED message appears
// 11. HOME / LOGIN button appears
// ======================================================

import React, { useState } from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { router } from 'expo-router';

// ======================================================
// SUPABASE
// ======================================================

import { supabase } from '../../lib/supabase';

// ======================================================
// SCREEN
// ======================================================

export default function WelcomeMat() {

  // ======================================================
  // USER VERIFIED STATE
  // ======================================================

  const [isVerified, setIsVerified] = useState(false);

  // ======================================================
  // LOADING STATE
  // ======================================================

  const [checkingVerification, setCheckingVerification] =
    useState(false);

  // ======================================================
  // CHECK EMAIL VERIFICATION
  // ======================================================

  const checkVerification = async () => {

    // ======================================================
    // START LOADING
    // ======================================================

    setCheckingVerification(true);

    // ======================================================
    // GET USER
    // ======================================================

    const {

      data: { user },

      error,

    } = await supabase.auth.getUser();

    // ======================================================
    // STOP LOADING
    // ======================================================

    setCheckingVerification(false);

    // ======================================================
    // ERROR
    // ======================================================

    if (error) {

      Alert.alert(
        'Error',
        error.message
      );

      return;
    }

    // ======================================================
    // USER VERIFIED
    // ======================================================

    if (user?.email_confirmed_at) {

      // ======================================================
      // UPDATE SCREEN STATE
      // ======================================================

      setIsVerified(true);

      return;
    }

    // ======================================================
    // USER NOT VERIFIED
    // ======================================================

    Alert.alert(
      'Not Verified',
      'Please check your email and verify your account first.'
    );
  };

  // ======================================================
  // GO TO LOGIN SCREEN
  // ======================================================

  const goToLogin = () => {

    router.replace('/login');
  };

  // ======================================================
  // SCREEN
  // ======================================================

  return (

    <View style={styles.container}>

      {/* ======================================================
          TITLE
      ====================================================== */}

      <Text style={styles.title}>
        Mission Trail
      </Text>

      {/* ======================================================
          MESSAGE AREA
      ====================================================== */}

      {!isVerified ? (

        // ======================================================
        // BEFORE VERIFICATION
        // ======================================================

        <>

          <Text style={styles.message}>

            Congratulations on creating your new Mission Trail account.

            {'\n\n'}

            A verification email has been sent to your inbox.

            {'\n\n'}

            Please check your email and verify your account.

          </Text>

          {/* ======================================================
              CHECK VERIFICATION BUTTON
          ====================================================== */}

          <TouchableOpacity
            style={styles.button}
            onPress={checkVerification}
          >

            <Text style={styles.buttonText}>

              {
                checkingVerification
                  ? 'CHECKING...'
                  : 'CHECK VERIFICATION'
              }

            </Text>

          </TouchableOpacity>

        </>

      ) : (

        // ======================================================
        // AFTER VERIFICATION
        // ======================================================

        <>

          <Text style={styles.verifiedMessage}>

            Your account has been successfully verified.

            {'\n\n'}

            Please continue to the login screen.

          </Text>

          {/* ======================================================
              LOGIN BUTTON
          ====================================================== */}

          <TouchableOpacity
            style={styles.successButton}
            onPress={goToLogin}
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
// STYLES
// ======================================================

const styles = StyleSheet.create({

  // ======================================================
  // MAIN CONTAINER
  // ======================================================

  container:{
    flex:1,

    backgroundColor:'#000000',

    justifyContent:'center',

    alignItems:'center',

    paddingHorizontal:25,
  },

  // ======================================================
  // TITLE
  // ======================================================

  title:{
    color:'#FFFFFF',

    fontSize:42,

    fontWeight:'bold',

    marginBottom:35,

    textAlign:'center',
  },

  // ======================================================
  // MESSAGE
  // ======================================================

  message:{
    color:'#DDDDDD',

    fontSize:20,

    textAlign:'center',

    lineHeight:34,

    marginBottom:40,
  },

  // ======================================================
  // VERIFIED MESSAGE
  // ======================================================

  verifiedMessage:{
    color:'#63D8FF',

    fontSize:22,

    textAlign:'center',

    lineHeight:36,

    marginBottom:40,

    fontWeight:'bold',
  },

  // ======================================================
  // MAIN BUTTON
  // ======================================================

  button:{
    width:'100%',

    height:68,

    backgroundColor:'#2b86ff',

    borderRadius:20,

    justifyContent:'center',

    alignItems:'center',
  },

  // ======================================================
  // SUCCESS BUTTON
  // ======================================================

  successButton:{
    width:'100%',

    height:68,

    backgroundColor:'#14b86a',

    borderRadius:20,

    justifyContent:'center',

    alignItems:'center',
  },

  // ======================================================
  // BUTTON TEXT
  // ======================================================

  buttonText:{
    color:'#FFFFFF',

    fontSize:18,

    fontWeight:'bold',

    letterSpacing:1,
  },

});