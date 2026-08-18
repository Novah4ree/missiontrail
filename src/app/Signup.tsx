// ======================================================
// SIGNUP.TSX
// ======================================================

import React, { useState } from "react";

import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

// ======================================================
// SUPABASE
// ======================================================

import { supabase } from "../../lib/supabase";

// ======================================================
// SCREEN
// ======================================================

// Purpose: Renders the signup screen interface.
export default function SignupScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ======================================================
  // HANDLE SIGN UP
  // ======================================================

  const handleSignUp = async () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    // ------------------------------------------------------
    // CHECK REQUIRED FIELDS
    // ------------------------------------------------------

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanEmail ||
      !password ||
      !confirmPassword
    ) {
      if (Platform.OS === "web") {
        alert("Please fill out all fields.");
      } else {
        Alert.alert("Missing Information", "Please fill out all fields.");
      }

      return;
    }

    // ------------------------------------------------------
    // CHECK PASSWORDS MATCH
    // ------------------------------------------------------

    if (password !== confirmPassword) {
      if (Platform.OS === "web") {
        alert("Passwords do not match.");
      } else {
        Alert.alert(
          "Passwords Do Not Match",
          "Please make sure both passwords are the same.",
        );
      }

      return;
    }

    try {
      setLoading(true);

      // ------------------------------------------------------
      // CREATE SUPABASE ACCOUNT
      // ------------------------------------------------------

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            first_name: cleanFirstName,
            last_name: cleanLastName,
          },
        },
      });

      // ------------------------------------------------------
      // HANDLE SUPABASE ERROR
      // ------------------------------------------------------

      if (error) {
        console.log("SIGNUP ERROR:", error);

        if (Platform.OS === "web") {
          alert(error.message);
        } else {
          Alert.alert("Sign Up Failed", error.message);
        }

        return;
      }

      console.log("SIGNUP SUCCESS:", data.user?.email);
      console.log("USER ID:", data.user?.id);
      console.log("SESSION:", !!data.session);

      // ------------------------------------------------------
      // EMAIL CONFIRMATION REQUIRED
      // ------------------------------------------------------

      if (!data.session) {
        if (Platform.OS === "web") {
          alert(
            "Your account was created. Please check your email and confirm your account before logging in.",
          );

          router.replace("/login");
        } else {
          Alert.alert(
            "Check Your Email",
            "Your account was created. Please check your email and confirm your account before logging in.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/login"),
              },
            ],
          );
        }

        return;
      }

      // ------------------------------------------------------
      // ACCOUNT CREATED + LOGGED IN
      // ------------------------------------------------------

      router.replace("/welcome_mat");
    } catch (err: any) {
      console.log("SIGNUP CRASH:", err);

      const message =
        err?.message || "Something went wrong while creating your account.";

      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("Sign Up Failed", message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // UI
  // ======================================================

  return (
    <View style={styles.container}>
      <View style={styles.signupBox}>
        <Text style={styles.title}>Create Account</Text>

        {/* ==================================================
            FIRST NAME
        ================================================== */}

        <View style={styles.inputBox}>
          <Ionicons name="person-outline" size={22} color="#63D8FF" />

          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#888"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
        </View>

        {/* ==================================================
            LAST NAME
        ================================================== */}

        <View style={styles.inputBox}>
          <Ionicons name="person-outline" size={22} color="#63D8FF" />

          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#888"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </View>

        {/* ==================================================
            EMAIL
        ================================================== */}

        <View style={styles.inputBox}>
          <Ionicons name="mail-outline" size={22} color="#63D8FF" />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* ==================================================
            PASSWORD
        ================================================== */}

        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={22} color="#63D8FF" />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? "eye-outline" : "eye-off-outline"}
              size={22}
              color="#63D8FF"
            />
          </TouchableOpacity>
        </View>

        {/* ==================================================
            CONFIRM PASSWORD
        ================================================== */}

        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={22} color="#63D8FF" />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#888"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Ionicons
              name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
              size={22}
              color="#63D8FF"
            />
          </TouchableOpacity>
        </View>

        {/* ==================================================
            CREATE ACCOUNT BUTTON
        ================================================== */}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  signupBox: {
    width: "92%",
    maxWidth: 520,
    backgroundColor: "rgba(12,12,28,0.94)",
    borderRadius: 35,
    paddingVertical: 35,
    paddingHorizontal: 25,

    shadowColor: "#7B42F6",
    shadowOpacity: 0.55,
    shadowRadius: 24,

    elevation: 20,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 35,
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A36",
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 62,
    marginBottom: 18,
  },

  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 10,
  },

  button: {
    marginTop: 10,
    height: 65,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#7B42F6",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
