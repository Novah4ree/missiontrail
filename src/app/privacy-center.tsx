import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

const COLORS = {
  background: "#060611",
  surface: "#120E26",
  border: "rgba(168, 85, 247, 0.28)",
  text: "#F8F7FF",
  muted: "#AAA5BF",
  purple: "#A855F7",
  cyan: "#22D3EE",
  red: "#FF3B6B",
};

const ITEMS = [
  {
    title: "Privacy Policy",
    subtitle: "See what Mission Trails collects, why it is used, and who processes it.",
    icon: "shield-checkmark-outline" as const,
    color: COLORS.cyan,
    route: "/privacy-policy" as const,
  },
  {
    title: "Terms of Use",
    subtitle: "Safety rules, account responsibilities, purchases, and service terms.",
    icon: "document-text-outline" as const,
    color: COLORS.purple,
    route: "/terms" as const,
  },
  {
    title: "Support",
    subtitle: "Get help with your account, privacy, purchases, trails, or safety concerns.",
    icon: "help-buoy-outline" as const,
    color: COLORS.cyan,
    route: "/support" as const,
  },
  {
    title: "Delete Account",
    subtitle: "Permanently delete your Mission Trails account and associated user-linked data.",
    icon: "trash-outline" as const,
    color: COLORS.red,
    route: "/account-deletion" as const,
  },
];

export default function PrivacyCenterScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>MISSION TRAILS</Text>
        <Text style={styles.title}>Privacy & Account</Text>
        <Text style={styles.intro}>
          Control your account, understand how your data is used, review the rules, and reach support from one place.
        </Text>

        <View style={styles.list}>
          {ITEMS.map((item) => (
            <Pressable
              key={item.title}
              onPress={() => router.push(item.route)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={[styles.iconCircle, { borderColor: item.color }]}>
                <Ionicons name={item.icon} size={23} color={item.color} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.note}>
          Mission Trails uses precise location only for location-based features that need it, such as verified discovery proximity and trail tracking. Location is not displayed to other users as a live precise position.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 22, paddingBottom: 48 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 24 },
  backText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  eyebrow: { color: COLORS.cyan, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: "900", marginTop: 7 },
  intro: { color: COLORS.muted, fontSize: 16, lineHeight: 24, marginTop: 10 },
  list: { gap: 12, marginTop: 28 },
  card: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  cardPressed: { opacity: 0.72 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  cardSubtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  note: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 24 },
});
