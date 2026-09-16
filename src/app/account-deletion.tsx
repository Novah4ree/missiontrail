import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";

const COLORS = {
  background: "#060611",
  surface: "#120E26",
  border: "rgba(168, 85, 247, 0.35)",
  text: "#F8F7FF",
  muted: "#AAA5BF",
  red: "#FF3B6B",
  white: "#FFFFFF",
};

export default function AccountDeletionScreen() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmation.trim().toUpperCase() === "DELETE" && !deleting;

  async function deleteAccount() {
    if (!canDelete) return;

    setDeleting(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error("Please sign in again before deleting your account.");
      }

      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: "DELETE" },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || data?.deleted !== true) {
        throw new Error(data?.message || error?.message || "Account deletion failed.");
      }

      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

      if (Platform.OS === "web") {
        router.replace("/login");
        return;
      }

      Alert.alert(
        "Account Deleted",
        "Your Mission Trails account has been deleted. Data that must be retained for security, fraud prevention, legal, or transaction-record obligations may be kept only as described in the Privacy Policy.",
        [{ text: "OK", onPress: () => router.replace("/login") }],
      );
    } catch (error) {
      Alert.alert(
        "Could Not Delete Account",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          <Text style={styles.backText}>Privacy & Account</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <Ionicons name="trash-outline" size={34} color={COLORS.red} />
        </View>

        <Text style={styles.title}>Delete Mission Trails Account</Text>
        <Text style={styles.body}>
          This permanently deletes your Mission Trails sign-in and user-linked app data from the active account system. This is not the same as signing out or temporarily disabling the account.
        </Text>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>What you will lose</Text>
          <Text style={styles.warningText}>
            Your profile, Mission Trails progress, relic assignments and collection history tied to the account, companion progress, mission progress, and other user-linked app records may be permanently removed and cannot be restored.
          </Text>
        </View>

        <Text style={styles.label}>Type DELETE to confirm</Text>
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
          placeholderTextColor="#6F6984"
          style={styles.input}
          editable={!deleting}
          accessibilityLabel="Type DELETE to confirm account deletion"
        />

        <Pressable
          onPress={() => void deleteAccount()}
          disabled={!canDelete}
          style={[styles.deleteButton, !canDelete && styles.deleteButtonDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDelete, busy: deleting }}
        >
          {deleting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="trash" size={20} color={COLORS.white} />
              <Text style={styles.deleteButtonText}>Permanently Delete Account</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footerNote}>
          Purchases already processed by Apple or Google may remain in their transaction records under their own legal and accounting requirements. Deleting Mission Trails does not erase records controlled by Apple or Google.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 22, paddingBottom: 48 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 30 },
  backText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 59, 107, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "900", marginBottom: 12 },
  body: { color: COLORS.muted, fontSize: 16, lineHeight: 24 },
  warningCard: {
    marginTop: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
  },
  warningTitle: { color: COLORS.red, fontSize: 17, fontWeight: "900", marginBottom: 8 },
  warningText: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  label: { color: COLORS.text, fontSize: 14, fontWeight: "800", marginTop: 26, marginBottom: 8 },
  input: {
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    letterSpacing: 1.5,
  },
  deleteButton: {
    marginTop: 18,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 16,
  },
  deleteButtonDisabled: { opacity: 0.4 },
  deleteButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "900" },
  footerNote: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 22 },
});
