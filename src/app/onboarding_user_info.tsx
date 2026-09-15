// ======================================================
// ONBOARDING USER INFO
// ======================================================
//
// FILE:
//
// src/app/onboarding_user_info.tsx
//
// PURPOSE:
//
// 1. Collect onboarding information.
// 2. Save onboarding information to Supabase.
// 3. Open Photo ID verification.
// 4. Pass identity information to Check ID.
// 5. Continue to questionnaire.
//
// ======================================================

import React, { useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';

import {
  clearOnboardingVerificationTicket,
} from '@/services/onboarding-verification-ticket-service';



// ======================================================
// SCREEN
// ======================================================

// Purpose: Collects the profile and identity details needed during onboarding.
export default function OnboardingUserInfo() {

  // ====================================================
  // FORM STATE
  // ====================================================

  const [firstName, setFirstName] =
    useState('');

  const [lastName, setLastName] =
    useState('');

  const [displayName, setDisplayName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [birthday, setBirthday] =
    useState('');

  const [city, setCity] =
    useState('');

  const [state, setState] =
    useState('');

  const [country, setCountry] =
    useState('');


  // ====================================================
  // LOADING STATE
  // ====================================================


  const [
    openingIdVerification,
    setOpeningIdVerification,
  ] = useState(false);

  const [
    enteringKidsMode,
    setEnteringKidsMode,
  ] = useState(false);


  // ====================================================
  // SHOW MESSAGE
  // ====================================================
  //
  // Alert.alert can be unreliable / easy to miss when
  // testing React Native through Expo Web.
  //
  // On web we use window.alert().
  // On Android/iOS we use React Native Alert.
  //
  // ====================================================

  // Purpose: Shows an onboarding message using the platform alert dialog.
  const showMessage = (
    title: string,
    message: string
  ) => {

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined'
    ) {
      window.alert(
        `${title}\n\n${message}`
      );

      return;
    }

    Alert.alert(
      title,
      message
    );
  };


  // ====================================================
  // VALIDATE ID INFORMATION
  // ====================================================

  // Purpose: Checks that the required identity fields have been entered.
  const validateIdentityInformation =
    (): boolean => {

      if (!firstName.trim()) {

        showMessage(
          'First Name Required',
          'Please enter your first name before verifying your ID.'
        );

        return false;
      }


      if (!lastName.trim()) {

        showMessage(
          'Last Name Required',
          'Please enter your last name before verifying your ID.'
        );

        return false;
      }


      if (!birthday.trim()) {

        showMessage(
          'Birthday Required',
          'Please enter your date of birth before verifying your ID.'
        );

        return false;
      }


      return true;
    };


  // ====================================================
  // OPEN PHOTO ID VERIFICATION
  // ====================================================
  //
  // IMPORTANT:
  //
  // This button should OPEN the ID screen.
  //
  // It should NOT depend on a Supabase database write
  // completing before navigation.
  //
  // The Check ID screen contains:
  //
  //   - Upload ID Image
  //   - Take Photo
  //
  // ====================================================

  // Purpose: Validates the form and opens photo ID verification.
  const openCheckId =
    () => {

      console.log(
        '[ONBOARDING] Verify Photo ID pressed.'
      );


      // --------------------------------------------------
      // PREVENT DOUBLE TAP
      // --------------------------------------------------

      if (
        openingIdVerification ||
        enteringKidsMode
      ) {

        console.log(
          '[ONBOARDING] Button ignored because screen is busy.'
        );

        return;
      }


      // --------------------------------------------------
      // VALIDATE REQUIRED INFORMATION
      // --------------------------------------------------

      if (
        !validateIdentityInformation()
      ) {

        console.log(
          '[ONBOARDING] ID validation failed.'
        );

        return;
      }


      // --------------------------------------------------
      // OPEN CHECK ID SCREEN
      // --------------------------------------------------

      try {

        setOpeningIdVerification(
          true
        );


        console.log(
          '[ONBOARDING] Opening onboarding questionnaire...'
        );


        router.push({
          pathname:
            '/onboarding_questionnaire',

          params: {

            firstName:
              firstName.trim(),

            lastName:
              lastName.trim(),

            displayName:
              displayName.trim(),

            birthday:
              birthday.trim(),

            city:
              city.trim(),

            state:
              state.trim(),

            country:
              country.trim(),

            // Purpose:
            // Explicitly marks this as the Photo ID path so
            // a previous Kids Mode choice cannot carry over.
            accountAccessMode:
              'id_required',

            idVerificationStatus:
              'pending',
          },
        });


        console.log(
          '[ONBOARDING] Navigation command sent.'
        );

      } catch (error) {

        console.error(
          '[ONBOARDING] Unable to open ID verification:',
          error
        );


        setOpeningIdVerification(
          false
        );


        showMessage(
          'Unable to Open ID Verification',
          'The ID verification screen could not be opened.'
        );
      }
    };


  // ====================================================
  // CONTINUE IN KIDS MODE
  // ====================================================

  // Purpose:
  // Lets the user explicitly choose reduced-access Kids Mode
  // from the onboarding information screen.
  //
  // Kids Mode skips Photo ID verification and continues
  // directly toward account creation with:
  //
  // - Trails locked
  // - Meetups locked
  //
  // Any previously-issued verified ticket is deleted first.
  const continueAsKid =
    async () => {

      if (
        openingIdVerification ||
        enteringKidsMode
      ) {
        return;
      }


      // Purpose:
      // Kids Mode still needs the basic identity information
      // required by the account creation flow.
      if (!firstName.trim()) {

        showMessage(
          'First Name Required',
          'Please enter your first name before continuing.'
        );

        return;
      }


      if (!lastName.trim()) {

        showMessage(
          'Last Name Required',
          'Please enter your last name before continuing.'
        );

        return;
      }


      if (!birthday.trim()) {

        showMessage(
          'Birthday Required',
          'Please enter your date of birth before continuing.'
        );

        return;
      }


      try {

        setEnteringKidsMode(
          true
        );


        // Purpose:
        // Removes any old verified ticket so Kids Mode can
        // never inherit verified account permissions.
        await clearOnboardingVerificationTicket();


        console.log(
          '[ONBOARDING] Kids Mode selected. Opening questionnaire.'
        );


        router.replace({
          pathname:
            '/onboarding_questionnaire',

          params: {

            firstName:
              firstName.trim(),

            lastName:
              lastName.trim(),

            displayName:
              displayName.trim(),

            birthday:
              birthday.trim(),

            city:
              city.trim(),

            state:
              state.trim(),

            country:
              country.trim(),

            accountAccessMode:
              'kids',

            idVerificationStatus:
              'skipped_kids',
          },
        });


      } catch (error) {

        console.error(
          '[ONBOARDING] Unable to enter Kids Mode:',
          error
        );


        showMessage(
          'Unable to Continue',
          'Kids Mode could not be opened. Please try again.'
        );


      } finally {

        setEnteringKidsMode(
          false
        );
      }
    };


  // ====================================================
  // SCREEN BUSY
  // ====================================================

  const busy =
    openingIdVerification ||
    enteringKidsMode;


  // ====================================================
  // SCREEN
  // ====================================================

  return (

    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
      keyboardShouldPersistTaps="handled"
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <Text style={styles.title}>
        Welcome to MissionTrail
      </Text>


      <Text style={styles.subtitle}>
        {"Let's build your profile."}
      </Text>


      {/* ==================================================
          FIRST NAME
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="person-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="First Name"
          placeholderTextColor="#888"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          LAST NAME
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="person-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Last Name"
          placeholderTextColor="#888"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          DISPLAY NAME
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="at-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          placeholderTextColor="#888"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          EMAIL
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="mail-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#888"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          PHONE
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="call-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#888"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          BIRTHDAY
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="calendar-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Birthday (MM/DD/YYYY)"
          placeholderTextColor="#888"
          keyboardType="numbers-and-punctuation"
          value={birthday}
          onChangeText={setBirthday}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          CITY
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="location-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="City"
          placeholderTextColor="#888"
          value={city}
          onChangeText={setCity}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          STATE
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="map-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="State"
          placeholderTextColor="#888"
          value={state}
          onChangeText={setState}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          COUNTRY
      ================================================== */}

      <View style={styles.inputBox}>

        <Ionicons
          name="earth-outline"
          size={22}
          color="#63D8FF"
        />

        <TextInput
          style={styles.input}
          placeholder="Country"
          placeholderTextColor="#888"
          value={country}
          onChangeText={setCountry}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />

      </View>


      {/* ==================================================
          ONBOARDING ACCESS CHOICES
      ================================================== */}

      <View style={styles.accessChoiceRow}>

        {/* ================================================
            VERIFY PHOTO ID
        ================================================ */}

        <TouchableOpacity
          style={[
            styles.accessChoiceButton,

            busy &&
              styles.accessChoiceButtonDisabled,
          ]}
          onPress={openCheckId}
          activeOpacity={0.8}
          disabled={busy}
        >

          {openingIdVerification ? (

            <ActivityIndicator
              size="small"
              color="#63D8FF"
            />

          ) : (

            <Ionicons
              name="id-card-outline"
              size={25}
              color="#63D8FF"
            />

          )}


          <Text
            style={
              styles.accessChoiceText
            }
            numberOfLines={1}
          >
            Verify Photo ID
          </Text>

        </TouchableOpacity>


        {/* ================================================
            FOR KIDS
        ================================================ */}

        <TouchableOpacity
          style={[
            styles.accessChoiceButton,

            busy &&
              styles.accessChoiceButtonDisabled,
          ]}
          onPress={continueAsKid}
          activeOpacity={0.8}
          disabled={busy}
        >

          {enteringKidsMode ? (

            <ActivityIndicator
              size="small"
              color="#63D8FF"
            />

          ) : (

            <Ionicons
              name="happy-outline"
              size={25}
              color="#63D8FF"
            />

          )}


          <Text
            style={
              styles.accessChoiceText
            }
            numberOfLines={1}
          >
            For Kids
          </Text>

        </TouchableOpacity>

      </View>



    </ScrollView>
  );
}


// ======================================================
// STYLES
// ======================================================

const styles =
  StyleSheet.create({

    container: {

      flex: 1,

      backgroundColor:
        '#05010B',
    },


    content: {

      flexGrow: 1,

      paddingHorizontal: 24,

      paddingTop: 60,

      paddingBottom: 60,

      alignItems: 'center',
    },


    title: {

      color: '#FFFFFF',

      fontSize: 34,

      fontWeight: 'bold',

      marginBottom: 8,

      textAlign: 'center',
    },


    subtitle: {

      color: '#B8A7FF',

      fontSize: 16,

      marginBottom: 35,

      textAlign: 'center',
    },


    inputBox: {

      width: '100%',

      maxWidth: 550,

      flexDirection: 'row',

      alignItems: 'center',

      backgroundColor:
        '#181028',

      borderWidth: 1,

      borderColor:
        '#7B42F6',

      borderRadius: 18,

      paddingHorizontal: 18,

      height: 62,

      marginBottom: 18,
    },


    // ====================================================
    // ACCESS CHOICE BUTTONS
    // ====================================================

    accessChoiceRow: {

      width: '100%',

      maxWidth: 550,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 12,

      marginTop: 8,
    },


    accessChoiceButton: {

      flex: 1,

      minWidth: 0,

      height: 64,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'center',

      backgroundColor:
        '#181028',

      borderWidth: 1.5,

      borderColor:
        '#7B42F6',

      borderRadius: 18,

      paddingHorizontal: 10,
    },


    accessChoiceButtonDisabled: {

      opacity: 0.5,
    },


    accessChoiceText: {

      flexShrink: 1,

      color: '#FFFFFF',

      fontSize: 15,

      fontWeight: '700',

      marginLeft: 8,

      textAlign: 'center',
    },


    input: {

      flex: 1,

      color: '#FFFFFF',

      marginLeft: 12,

      fontSize: 16,

      height: '100%',
    },


    // ====================================================
    // VERIFY PHOTO ID BUTTON
    // ====================================================

    photoButton: {

      width: '100%',

      maxWidth: 550,

      height: 70,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        '#FFFFFF',

      backgroundColor:
        '#12091F',

      justifyContent:
        'center',

      alignItems:
        'center',

      flexDirection:
        'row',

      marginTop: 10,

      marginBottom: 30,
    },


    photoButtonText: {

      color: '#FFFFFF',

      fontSize: 17,

      fontWeight: '600',

      marginLeft: 12,
    },


    // ====================================================
    // KIDS MODE BUTTON
    // ====================================================

    kidsButton: {

      width: '100%',

      maxWidth: 550,

      minHeight: 92,

      borderRadius: 20,

      borderWidth: 1.5,

      borderColor:
        '#63D8FF',

      backgroundColor:
        '#181028',

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal: 24,

      paddingVertical: 18,

      marginBottom: 24,
    },


    kidsButtonTextContainer: {

      flex: 1,

      marginLeft: 18,
    },


    kidsButtonText: {

      color: '#FFFFFF',

      fontSize: 22,

      fontWeight: 'bold',

      letterSpacing: 1,
    },


    kidsButtonSubtitle: {

      color: '#B8A7FF',

      fontSize: 15,

      lineHeight: 21,

      marginTop: 4,
    },


    // ====================================================
    // CONTINUE BUTTON
    // ====================================================

    button: {

      width: '100%',

      maxWidth: 550,

      height: 65,

      borderRadius: 20,

      backgroundColor:
        '#7B42F6',

      justifyContent:
        'center',

      alignItems:
        'center',

      shadowColor:
        '#7B42F6',

      shadowOpacity: 0.6,

      shadowRadius: 18,

      elevation: 12,
    },


    buttonDisabled: {

      opacity: 0.6,
    },


    buttonText: {

      color: '#FFFFFF',

      fontSize: 18,

      fontWeight: 'bold',

      letterSpacing: 1,
    },


    loadingRow: {

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    loadingButtonText: {

      color: '#FFFFFF',

      fontSize: 18,

      fontWeight: 'bold',

      letterSpacing: 1,

      marginLeft: 10,
    },
  });
