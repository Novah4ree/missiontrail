import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LeaderboardPlayer = {
  rank: number;
  name: string;
  distance: string;
  level?: number;
};

// This holds fake leaderboard data until the backend is connected.
const topPlayers: LeaderboardPlayer[] = [
  { rank: 1, name: 'CosmicWalker', distance: '2,847 km' },
  { rank: 2, name: 'StarStrider', distance: '2,643 km' },
  { rank: 3, name: 'NovaNomad', distance: '2,521 km' },
];

// This holds the rest of the fake ranked players.
const rankedPlayers: LeaderboardPlayer[] = [
  { rank: 4, name: 'OrbitRunner', distance: '2,318 km' },
  { rank: 5, name: 'LunarScout', distance: '2,104 km' },
  { rank: 6, name: 'CometChaser', distance: '1,982 km' },
  { rank: 7, name: 'AstroRider', distance: '1,744 km' },
  { rank: 8, name: 'GalaxyGhost', distance: '1,602 km' },
  { rank: 9, name: 'NebulaNinja', distance: '1,489 km' },
];

const userRank: LeaderboardPlayer = {
  rank: 127,
  name: 'You',
  level: 42,
  distance: '847 km',
};

// This shows the full Global Rankings screen.
export default function LeaderboardScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();

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
        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>🏆 GLOBAL RANKINGS</Text>
            <Text style={styles.subtitle}>Top Cosmic Explorers</Text>
          </View>
        </View>

        <View style={styles.topThreeGrid}>
          {topPlayers.map((player) => renderTopPlayerCard(player))}
        </View>

        <View style={styles.rankedList}>
          {rankedPlayers.map((player) => renderPlayerRow(player))}
        </View>

        {renderUserRankCard(userRank)}
      </ScrollView>
    </View>
  );
}

// This shows one top-three player card.
function renderTopPlayerCard(player: LeaderboardPlayer) {
  const isFirstPlace = player.rank === 1;

  return (
    <View
      key={player.rank}
      style={[
        styles.topPlayerCard,
        isFirstPlace && styles.firstPlaceCard,
      ]}
    >
      <View style={[styles.medalCircle, { borderColor: getRankColor(player.rank) }]}>
        <Text style={[styles.medalText, { color: getRankColor(player.rank) }]}>#{player.rank}</Text>
      </View>

      <Text style={styles.topPlayerName}>{player.name}</Text>
      <Text style={styles.topPlayerDistance}>{player.distance}</Text>
    </View>
  );
}

// This shows one player row in the leaderboard list.
function renderPlayerRow(player: LeaderboardPlayer) {
  return (
    <View key={player.rank} style={styles.playerRow}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{player.rank}</Text>
      </View>

      <Text style={styles.playerName}>{player.name}</Text>
      <Text style={styles.playerDistance}>{player.distance}</Text>
    </View>
  );
}

// This shows the current user's rank card at the bottom.
function renderUserRankCard(player: LeaderboardPlayer) {
  return (
    <View style={styles.userCard}>
      <View>
        <Text style={styles.userLabel}>YOUR RANK</Text>
        <Text style={styles.userName}>#{player.rank} {player.name}</Text>
      </View>

      <View style={styles.userStats}>
        <Text style={styles.userLevel}>Level {player.level}</Text>
        <Text style={styles.userDistance}>{player.distance}</Text>
      </View>
    </View>
  );
}

// This picks a bright medal color for each top rank.
function getRankColor(rank: number) {
  if (rank === 1) return '#facc15';
  if (rank === 2) return '#d9ddff';
  return '#ff9f43';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050518',
  },

  cosmicOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(18, 10, 46, 0.3)',
  },

  content: {
    paddingHorizontal: 16,
    gap: 18,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.5)',
    backgroundColor: 'rgba(3, 2, 18, 0.82)',
  },

  headerCopy: {
    flex: 1,
  },

  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: '#a855f7',
    textShadowRadius: 10,
  },

  subtitle: {
    color: '#74eaff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },

  topThreeGrid: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },

  topPlayerCard: {
    flex: 1,
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.55)',
    backgroundColor: 'rgba(6, 4, 26, 0.92)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOpacity: 0.42,
    shadowRadius: 10,
    elevation: 8,
  },

  firstPlaceCard: {
    borderColor: 'rgba(250, 204, 21, 0.78)',
    shadowColor: '#facc15',
  },

  medalCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  medalText: {
    fontSize: 13,
    fontWeight: '900',
  },

  topPlayerName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },

  topPlayerDistance: {
    color: '#74eaff',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },

  rankedList: {
    gap: 9,
  },

  playerRow: {
    minHeight: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.28)',
    backgroundColor: 'rgba(8, 5, 28, 0.88)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  rankBadge: {
    width: 42,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
  },

  rankText: {
    color: '#d9ddff',
    fontSize: 12,
    fontWeight: '900',
  },

  playerName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  playerDistance: {
    color: '#74eaff',
    fontSize: 12,
    fontWeight: '800',
  },

  userCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.75)',
    backgroundColor: 'rgba(10, 4, 32, 0.94)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#d946ef',
    shadowOpacity: 0.48,
    shadowRadius: 12,
    elevation: 9,
  },

  userLabel: {
    color: '#ff63f7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  userName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },

  userStats: {
    alignItems: 'flex-end',
  },

  userLevel: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '900',
  },

  userDistance: {
    color: '#74eaff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
