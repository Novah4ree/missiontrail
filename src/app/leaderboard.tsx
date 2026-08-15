import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDailyProgress } from "@/hooks/use-daily-progress";
import { getPlayerLevelProgress } from "@/utils/player-level";

export default function LeaderboardScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();

  const { progress, isLoading } = useDailyProgress();

  const totalXp = progress?.totalXp ?? 0;
  const playerLevel = getPlayerLevelProgress(totalXp);

  const currentUserDistance = (progress?.verifiedDistanceMeters ?? 0) / 1000;

  function returnToLiveMap() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/home-backup");
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={styles.cosmicOverlay} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: safeArea.top + 16,
            paddingBottom: safeArea.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={returnToLiveMap}
          >
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>🏆 GLOBAL RANKINGS</Text>

            <Text style={styles.subtitle}>Top Cosmic Explorers</Text>
          </View>
        </View>

        {/* EMPTY LEADERBOARD */}
        <View style={styles.emptyLeaderboard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="trophy-outline" size={40} color="#74eaff" />
          </View>

          <Text style={styles.emptyTitle}>No Explorers Ranked Yet</Text>

          <Text style={styles.emptyText}>
            Rankings will appear here once real explorers begin earning verified
            distance.
          </Text>
        </View>

        {/* CURRENT USER */}
        <View style={styles.userCard}>
          <View>
            <Text style={styles.userLabel}>YOUR PROGRESS</Text>

            <Text style={styles.userName}>You</Text>
          </View>

          <View style={styles.userStats}>
            <Text style={styles.userLevel}>
              {isLoading ? "Level ..." : `Level ${playerLevel.level}`}
            </Text>

            <Text style={styles.userDistance}>
              {isLoading ? "..." : `${currentUserDistance.toFixed(2)} km today`}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050518",
  },

  cosmicOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(18, 10, 46, 0.3)",
  },

  content: {
    paddingHorizontal: 16,
    gap: 18,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.5)",
    backgroundColor: "rgba(3, 2, 18, 0.82)",
  },

  headerCopy: {
    flex: 1,
  },

  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: "#a855f7",
    textShadowRadius: 10,
  },

  subtitle: {
    color: "#74eaff",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },

  emptyLeaderboard: {
    minHeight: 320,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.45)",
    backgroundColor: "rgba(6, 4, 26, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 40,

    shadowColor: "#a855f7",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 7,
  },

  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 229, 255, 0.06)",
    marginBottom: 20,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyText: {
    color: "#a9a5c0",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 9,
    maxWidth: 300,
  },

  userCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(217, 70, 239, 0.75)",
    backgroundColor: "rgba(10, 4, 32, 0.94)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    shadowColor: "#d946ef",
    shadowOpacity: 0.48,
    shadowRadius: 12,
    elevation: 9,
  },

  userLabel: {
    color: "#ff63f7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  userName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  userStats: {
    alignItems: "flex-end",
  },

  userLevel: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "900",
  },

  userDistance: {
    color: "#74eaff",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
