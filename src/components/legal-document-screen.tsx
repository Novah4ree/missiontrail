import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactNode } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

type Section = {
  heading: string;
  body: ReactNode;
};

type Props = {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: Section[];
};

const COLORS = {
  background: "#060611",
  surface: "#120E26",
  border: "rgba(168, 85, 247, 0.25)",
  text: "#F8F7FF",
  muted: "#AAA5BF",
  cyan: "#22D3EE",
};

export function LegalDocumentScreen({ title, effectiveDate, intro, sections }: Props) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          <Text style={styles.backText}>Privacy & Account</Text>
        </Pressable>

        <Text style={styles.eyebrow}>MISSION TRAILS</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.date}>Effective {effectiveDate}</Text>
        <Text style={styles.intro}>{intro}</Text>

        <View style={styles.sections}>
          {sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              {typeof section.body === "string" ? (
                <Text style={styles.body}>{section.body}</Text>
              ) : (
                section.body
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export const legalStyles = StyleSheet.create({
  paragraph: { color: COLORS.muted, fontSize: 15, lineHeight: 23, marginBottom: 10 },
  bullet: { color: COLORS.muted, fontSize: 15, lineHeight: 23, marginBottom: 7 },
  strong: { color: COLORS.text, fontWeight: "800" },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 22, paddingBottom: 54 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 26 },
  backText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  eyebrow: { color: COLORS.cyan, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: "900", marginTop: 7 },
  date: { color: COLORS.muted, fontSize: 13, marginTop: 7 },
  intro: { color: COLORS.text, fontSize: 16, lineHeight: 24, marginTop: 18 },
  sections: { gap: 14, marginTop: 26 },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 18,
  },
  heading: { color: COLORS.text, fontSize: 18, fontWeight: "900", marginBottom: 9 },
  body: { color: COLORS.muted, fontSize: 15, lineHeight: 23 },
});
