import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";

type Category = "account" | "privacy" | "purchase" | "unsafe_location" | "technical" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "account", label: "Account" },
  { value: "privacy", label: "Privacy" },
  { value: "purchase", label: "Purchase" },
  { value: "unsafe_location", label: "Unsafe Location" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

const COLORS = {
  background: "#060611",
  surface: "#120E26",
  border: "rgba(168, 85, 247, 0.30)",
  text: "#F8F7FF",
  muted: "#AAA5BF",
  purple: "#A855F7",
  cyan: "#22D3EE",
  red: "#FF3B6B",
};

export default function SupportScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("technical");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => message.trim().length >= 10 && message.trim().length <= 4000 && !submitting,
    [message, submitting],
  );

  async function submitSupportRequest() {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Please sign in before sending a support request.");

      const { data, error } = await supabase.functions.invoke("support-request", {
        body: { category, message: message.trim() },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || data?.submitted !== true) {
        throw new Error(data?.message || error?.message || "Support request failed.");
      }

      setMessage("");
      Alert.alert(
        "Support Request Sent",
        data?.ticketId ? `Ticket ${data.ticketId} was created.` : "Your request was sent.",
      );
    } catch (error) {
      Alert.alert(
        "Could Not Send Request",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          <Text style={styles.backText}>Privacy & Account</Text>
        </Pressable>

        <Text style={styles.eyebrow}>MISSION TRAILS</Text>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.intro}>
          Send an account, privacy, purchase, safety, or technical support request. Do not include passwords, full payment-card numbers, or an identity-document image in a support message.
        </Text>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryWrap}>
          {CATEGORIES.map((item) => {
            const selected = category === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setCategory(item.value)}
                style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {category === "unsafe_location" ? (
          <View style={styles.safetyNote}>
            <Ionicons name="warning-outline" size={22} color={COLORS.red} />
            <Text style={styles.safetyText}>
              Do not approach the location to collect more details. Describe what was unsafe from a safe place. Do not enter private property or stand in traffic to make a report.
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Message</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Describe what happened and what you need help with..."
          placeholderTextColor="#716B85"
          multiline
          maxLength={4000}
          style={styles.input}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>{message.length}/4000</Text>

        <Pressable
          onPress={() => void submitSupportRequest()}
          disabled={!canSubmit}
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color={COLORS.text} />
              <Text style={styles.submitText}>Send Support Request</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => router.push("/account-deletion")} style={styles.deleteLink}>
          <Ionicons name="trash-outline" size={19} color={COLORS.red} />
          <Text style={styles.deleteLinkText}>Delete my Mission Trails account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 22, paddingBottom: 54 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 24 },
  backText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  eyebrow: { color: COLORS.cyan, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: "900", marginTop: 7 },
  intro: { color: COLORS.muted, fontSize: 15, lineHeight: 23, marginTop: 10 },
  label: { color: COLORS.text, fontSize: 15, fontWeight: "900", marginTop: 24, marginBottom: 10 },
  categoryWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  categoryChipSelected: { borderColor: COLORS.cyan, backgroundColor: "rgba(34, 211, 238, 0.10)" },
  categoryText: { color: COLORS.muted, fontSize: 13, fontWeight: "800" },
  categoryTextSelected: { color: COLORS.cyan },
  safetyNote: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 107, 0.35)",
    backgroundColor: "rgba(255, 59, 107, 0.08)",
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  safetyText: { flex: 1, color: COLORS.text, fontSize: 13, lineHeight: 20 },
  input: {
    minHeight: 170,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    padding: 14,
  },
  counter: { color: COLORS.muted, fontSize: 12, textAlign: "right", marginTop: 6 },
  submitButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: COLORS.purple,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitText: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  deleteLink: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, marginTop: 28 },
  deleteLinkText: { color: COLORS.red, fontSize: 14, fontWeight: "800" },
});
