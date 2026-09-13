import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { useDailyProgress } from "@/hooks/use-daily-progress";
import { getPlayerLevelProgress } from "@/utils/player-level";

type LeaderboardEntry = {
  rank_position: number;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  explorer_score: number;
  is_current_user: boolean;
};


// Purpose: Renders the leaderboard screen interface.
export default function LeaderboardScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();

  const { progress, isLoading } = useDailyProgress();

  const totalXp = progress?.totalXp ?? 0;
  const playerLevel = getPlayerLevelProgress(totalXp);

  const currentUserDistance = (progress?.verifiedDistanceMeters ?? 0) / 1000;


  const [
    leaderboardEntries,
    setLeaderboardEntries,
  ] =
    useState<LeaderboardEntry[]>([]);


  const [
    leaderboardLoading,
    setLeaderboardLoading,
  ] =
    useState(true);


  const [
    leaderboardError,
    setLeaderboardError,
  ] =
    useState<string | null>(null);


  // Purpose:
  // Loads the real global Explorer Score ranking.
  async function loadLeaderboard() {
    setLeaderboardLoading(true);
    setLeaderboardError(null);

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "server_get_explorer_leaderboard",
        {
          p_limit: 50,
        },
      );

      if (error) {
        throw error;
      }

      const rows =
        Array.isArray(data)
          ? data
          : [];

      setLeaderboardEntries(
        rows.map(
          (row) => ({
            rank_position:
              Number(
                row.rank_position ??
                0,
              ),

            user_id:
              String(
                row.user_id ??
                "",
              ),

            display_name:
              String(
                row.display_name ??
                "Explorer",
              ),

            username:
              String(
                row.username ??
                "explorer",
              ),

            avatar_url:
              row.avatar_url
                ? String(
                    row.avatar_url,
                  )
                : null,

            explorer_score:
              Number(
                row.explorer_score ??
                0,
              ),

            is_current_user:
              row.is_current_user ===
              true,
          }),
        ),
      );
    } catch (error) {
      console.warn(
        "[Leaderboard] Could not load rankings.",
        error,
      );

      setLeaderboardError(
        "Global rankings could not be loaded.",
      );
    } finally {
      setLeaderboardLoading(false);
    }
  }


  useEffect(() => {
    void loadLeaderboard();
  }, []);


  // Purpose:
  // Reloads both the player's Explorer Score and
  // global rankings whenever Leaderboard opens.
  useFocusEffect(
    useCallback(
      () => {
        void loadLeaderboard();

        return undefined;
      },
      [],
    ),
  );

  const currentUserRanking =
    leaderboardEntries.find(
      (entry) =>
        entry.is_current_user,
    );


  // Purpose: Implements the return to live map operation.
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

        {/* REAL GLOBAL LEADERBOARD */}
        <View style={styles.rankingPanel}>
          <View style={styles.rankingHeader}>
            <View>
              <Text style={styles.rankingEyebrow}>
                GLOBAL EXPLORERS
              </Text>

              <Text style={styles.rankingTitle}>
                Explorer Score Rankings
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh leaderboard"
              onPress={() =>
                void loadLeaderboard()
              }
              style={styles.refreshButton}
            >
              <Ionicons
                name="refresh"
                size={18}
                color="#74eaff"
              />
            </Pressable>
          </View>


          {leaderboardLoading ? (
            <View style={styles.rankingStatus}>
              <Ionicons
                name="hourglass-outline"
                size={28}
                color="#74eaff"
              />

              <Text style={styles.rankingStatusText}>
                Loading explorers...
              </Text>
            </View>
          ) : leaderboardError ? (
            <View style={styles.rankingStatus}>
              <Ionicons
                name="cloud-offline-outline"
                size={28}
                color="#ff63f7"
              />

              <Text style={styles.rankingStatusText}>
                {leaderboardError}
              </Text>
            </View>
          ) : leaderboardEntries.length === 0 ? (
            <View style={styles.rankingStatus}>
              <Ionicons
                name="trophy-outline"
                size={34}
                color="#74eaff"
              />

              <Text style={styles.rankingStatusText}>
                No Explorer Score has been earned yet.
              </Text>
            </View>
          ) : (
            <View style={styles.rankingList}>
              {leaderboardEntries.map(
                (entry) => {
                  const medal =
                    entry.rank_position === 1
                      ? "🥇"
                      : entry.rank_position === 2
                        ? "🥈"
                        : entry.rank_position === 3
                          ? "🥉"
                          : null;


                  return (
                    <View
                      key={entry.user_id}
                      style={[
                        styles.rankingRow,

                        entry.is_current_user
                          ? styles.rankingRowCurrent
                          : undefined,
                      ]}
                    >
                      <View style={styles.rankNumberWrap}>
                        <Text style={styles.rankNumber}>
                          {medal ??
                            `#${entry.rank_position}`}
                        </Text>
                      </View>


                      <View style={styles.explorerAvatar}>
                        <Ionicons
                          name="person"
                          size={19}
                          color={
                            entry.is_current_user
                              ? "#ff63f7"
                              : "#74eaff"
                          }
                        />
                      </View>


                      <View style={styles.explorerCopy}>
                        <Text
                          numberOfLines={1}
                          style={styles.explorerName}
                        >
                          {entry.display_name}
                          {entry.is_current_user
                            ? "  • YOU"
                            : ""}
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={styles.explorerUsername}
                        >
                          @{entry.username}
                        </Text>
                      </View>


                      <View style={styles.explorerScoreWrap}>
                        <Text style={styles.explorerScore}>
                          {entry.explorer_score.toLocaleString()}
                        </Text>

                        <Text style={styles.explorerScoreLabel}>
                          SCORE
                        </Text>
                      </View>
                    </View>
                  );
                },
              )}
            </View>
          )}
        </View>


        {/* CURRENT USER */}
        <View style={styles.userCard}>
          <View>
            <Text style={styles.userLabel}>YOUR PROGRESS</Text>

            <Text style={styles.userName}>
              You
            </Text>

            <Text style={styles.userRank}>
              {currentUserRanking
                ? `Global Rank #${currentUserRanking.rank_position}`
                : "Global Rank —"}
            </Text>
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

  rankingPanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.45)",
    backgroundColor: "rgba(6, 4, 26, 0.92)",
    padding: 14,
    gap: 12,
  },

  rankingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  rankingEyebrow: {
    color: "#ff63f7",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  rankingTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(116, 234, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 229, 255, 0.06)",
  },

  rankingStatus: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  rankingStatusText: {
    color: "#a9a5c0",
    fontSize: 13,
    textAlign: "center",
  },

  rankingList: {
    gap: 8,
  },

  rankingRow: {
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(116, 234, 255, 0.13)",
    backgroundColor: "rgba(10, 7, 31, 0.92)",
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  rankingRowCurrent: {
    borderColor: "rgba(255, 99, 247, 0.85)",
    backgroundColor: "rgba(54, 9, 68, 0.72)",
  },

  rankNumberWrap: {
    width: 38,
    alignItems: "center",
  },

  rankNumber: {
    color: "#facc15",
    fontSize: 14,
    fontWeight: "900",
  },

  explorerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(116, 234, 255, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(116, 234, 255, 0.06)",
  },

  explorerCopy: {
    flex: 1,
    minWidth: 0,
  },

  explorerName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  explorerUsername: {
    color: "#8e88a5",
    fontSize: 10,
    marginTop: 2,
  },

  explorerScoreWrap: {
    minWidth: 68,
    alignItems: "flex-end",
  },

  explorerScore: {
    color: "#74eaff",
    fontSize: 16,
    fontWeight: "900",
  },

  explorerScoreLabel: {
    color: "#77718d",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 1,
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

  userRank: {
    color: "#ff63f7",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 3,
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
