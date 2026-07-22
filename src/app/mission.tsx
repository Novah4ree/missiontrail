
import { DailyRelicProgress } from '@/components/daily-relic-progress';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import type { VerifiedMissionProgress } from '@/types/daily-progress';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const screen = Dimensions.get('window');
const isSmallPhone = screen.height < 740 || screen.width < 380;
const sidePadding = isSmallPhone ? 9 : 12;
const tabBarHeight = isSmallPhone ? 72 : 82;

// These are the custom images for the bottom tab buttons.
const tabImages = {
  home: require('../../assets/images/tabIcons/homemain.png'),
  mission: require('../../assets/images/tabIcons/mission.png'),
  trails: require('../../assets/images/tabIcons/trails.png'),
  vault: require('../../assets/images/tabIcons/vault.png'),
  profile: require('../../assets/images/tabIcons/profile.png'),
  companion: require('../../assets/images/tabIcons/companion.png'),
};

// These are the custom mission stat icons.
const missionIcons = {
  bond: require('../../assets/images/tabIcons/missionIcons/Bond.png'),
  energy: require('../../assets/images/tabIcons/missionIcons/Energy.png'),
  burn: require('../../assets/images/tabIcons/missionIcons/Burn.png'),
  level: require('../../assets/images/tabIcons/missionIcons/level.png'),
};

// This is the data for the bottom navigation bar.
const bottomTabs = [
  { key: 'home', label: 'Home', image: tabImages.home, route: '/home-backup' },
  { key: 'mission', label: 'Mission', image: tabImages.mission, route: '/mission' },
  { key: 'trails', label: 'Trails', image: tabImages.trails, route: '/trails' },
  { key: 'vault', label: 'Vault', image: tabImages.vault, route: '/vault' },
  { key: 'profile', label: 'Profile', image: tabImages.profile, route: '/profile' },
  { key: 'companion', label: 'Compan...', image: tabImages.companion, route: '/companion' },
] as const;

type DailyMission = {
  id: string;
  title: string;
  xp: string;
  done: boolean;
  difficulty: string;
  state: VerifiedMissionProgress['state'];
  progressLabel: string;
  rewardXp: number;
};

const METERS_PER_MILE = 1_609.344;

function missionProgressLabel(mission: VerifiedMissionProgress) {
  if (mission.requirementType === 'distance') {
    return `${(mission.progress / METERS_PER_MILE).toFixed(2)} / ${(mission.target / METERS_PER_MILE).toFixed(1)} miles`;
  }
  if (mission.requirementType === 'steps') return `${Math.floor(mission.progress)} / ${Math.floor(mission.target)} steps`;
  if (mission.requirementType === 'relic') return `${Math.floor(mission.progress)} / ${Math.floor(mission.target)} relics`;
  if (mission.requirementType === 'location') return `${Math.floor(mission.progress)} / ${Math.floor(mission.target)} locations`;
  if (mission.requirementType === 'active_time') {
    return `${Math.floor(mission.progress / 60)} / ${Math.round(mission.target / 60)} minutes`;
  }
  if (mission.requirementType === 'session') return `${Math.floor(mission.progress)} / ${Math.floor(mission.target)} sessions`;
  return `${Math.floor(mission.progress)} / ${Math.floor(mission.target)}`;
}

// This is the main mission screen.
export default function MissionScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();
  const { progress, isLoading, message, claimReward } = useDailyProgress();
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const currentLevel = 1;
  const missions = useMemo<DailyMission[]>(() => (progress?.missions ?? []).map((mission, index) => ({
    id: mission.id,
    title: mission.title,
    xp: `+${mission.rewardXp} XP`,
    rewardXp: mission.rewardXp,
    done: mission.state === 'completed' || mission.state === 'claimed',
    state: mission.state,
    progressLabel: missionProgressLabel(mission),
    difficulty: index === 0 ? 'Easy' : index === (progress?.missions.length ?? 0) - 1 ? 'Hard' : 'Medium',
  })), [progress]);
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? null;

  const completedMissions = missions.filter((item) => item.done).length;
  const progressPercent = missions.length
    ? Math.round((completedMissions / missions.length) * 100)
    : 0;

  return (
    <LinearGradient colors={['#05000c', '#10001d', '#05000c']} style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: safeArea.top + 20,
            paddingBottom: safeArea.bottom + 121,
          },
        ]}
      >
        <CompanionHeader />

        <CompanionMessage />

        <DailyRelicProgress />

        <View style={styles.statsRow}>
          <StatBox icon={missionIcons.bond} value="73%" label="Bond" color="#ff2df7" />
          <StatBox icon={missionIcons.energy} value="88%" label="Energy" color="#00d9ff" />
          <StatBox icon={missionIcons.burn} value="21" label="Burn" color="#ff7b2c" />
          <StatBox icon={missionIcons.level} value="7" label="Level" color="#ffd43b" />
        </View>

        <ProgressCard
          level={currentLevel}
          completed={completedMissions}
          total={missions.length}
          percent={progressPercent}
        />

        <AdventureCard />

        <View style={styles.missionHeader}>
          <Text style={styles.sectionTitle}>LEVEL {currentLevel} MISSIONS</Text>
          <Text style={styles.counterText}>
            {completedMissions}/{missions.length}
          </Text>
        </View>

        {missions.map((mission) => (
          <MissionItem
            key={mission.id}
            mission={mission}
            onOpen={() => setSelectedMissionId(mission.id)}
          />
        ))}
        {isLoading && missions.length === 0 ? <Text style={styles.loadingText}>Loading verified missions…</Text> : null}
        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </ScrollView>

      <MissionDetailsModal
        mission={selectedMission}
        isBusy={isLoading}
        onClose={() => setSelectedMissionId(null)}
        onClaim={(missionId) => void claimReward(missionId)}
      />

      <BottomNav router={router} safeBottom={safeArea.bottom} />
    </LinearGradient>
  );
}

// This shows the glowing Novah companion at the top.
function CompanionHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.orb}>
        <Image
          source={tabImages.mission}
          style={{ width: 113, height: 122 }}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.companionName}>Novah</Text>
      <Text style={styles.companionType}>Your Missions</Text>
    </View>
  );
}

// This shows the small message from the companion.
function CompanionMessage() {
  return (
    <View style={styles.messageCard}>
      <LinearGradient colors={['#b93dff', '#5de7ff']} style={styles.messageIcon}>
        <Ionicons name="chatbubble" size={15} color="#fff" />
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <Text style={styles.messageText}>
          Novah feels energized after your morning walk, pace yourself for the adventure!
        </Text>
        <Text style={styles.smallText}>Just now</Text>
      </View>
    </View>
  );
}

// This makes one small stat box, like Bond, Energy, Burn, or Level.
function StatBox({
  icon,
  value,
  label,
  color,
}: {
  icon: any;
  value: string;
  label: string;
  color: string;
}) {
  const isImage = typeof icon === 'number';
  
  return (
    <View style={styles.statBox}>
      {isImage ? (
        <Image source={icon} style={{ width: 32, height: 32 }} resizeMode="contain" />
      ) : (
        <Ionicons name={icon} size={18} color={color} />
      )}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// This shows the XP progress bar.
function ProgressCard({
  level,
  completed,
  total,
  percent,
}: {
  level: number;
  completed: number;
  total: number;
  percent: number;
}) {
  return (
    <View style={styles.progressCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>Level {level} Progress</Text>
        <Text style={styles.percentText}>{percent}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <LinearGradient
          colors={['#ff00f5', '#19d8ff']}
          style={[styles.progressFill, { width: `${percent}%` }]}
        />
      </View>

      <Text style={styles.smallText}>
        {completed} of {total} missions completed. The next level unlocks when this one is fully cleared.
      </Text>
    </View>
  );
}

// This shows the big adventure card and start button.
function AdventureCard() {
  return (
    <LinearGradient colors={['#38145c', '#1b1946']} style={styles.adventureCard}>
      <View style={styles.row}>
        <LinearGradient colors={['#bc49ff', '#61e7ff']} style={styles.adventureIcon}>
          <Ionicons name="sunny" size={18} color="#fff" />
        </LinearGradient>

        <View style={{ flex: 1 }}>
          <Text style={styles.adventureTitle}>Welcome to TODAY’S ADVENTURE</Text>
          <Text style={styles.adventureText}>
            Lets go outside! What are you waiting for? Perfect weather for exploring. Found a peaceful trail nearby.
          </Text>
          <Text style={styles.rewardText}>💎 7XP Streak   🏆 420XP</Text>
        </View>
      </View>

      <Pressable>
        <LinearGradient colors={['#ff00dd', '#21d9ff']} style={styles.startButton}>
          <Text style={styles.startText}>Time To Explore</Text>
        </LinearGradient>
      </Pressable>
    </LinearGradient>
  );
}

// This shows one mission row from the daily mission list.
function MissionItem({
  mission,
  onOpen,
}: {
  mission: DailyMission;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityHint="Opens mission details without changing progress"
      style={({ pressed }) => [
        styles.missionItem,
        mission.done && styles.missionDone,
        pressed && styles.missionPressed,
      ]}
    >
      <Ionicons
        name={mission.done ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={mission.done ? '#00d9ff' : '#5b5267'}
      />

      <View style={styles.missionCopy}>
        <Text style={styles.missionText}>{mission.title}</Text>
        <Text style={styles.missionProgressText}>{mission.progressLabel}</Text>
      </View>

      <View style={styles.badgeColumn}>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>{mission.difficulty}</Text>
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpText}>{mission.xp}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function MissionDetailsModal({
  mission,
  isBusy,
  onClose,
  onClaim,
}: {
  mission: DailyMission | null;
  isBusy: boolean;
  onClose: () => void;
  onClaim: (missionId: string) => void;
}) {
  if (!mission) return null;
  const canClaim = mission.state === 'completed';
  const alreadyClaimed = mission.state === 'claimed';

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>{mission.title}</Text>
          <Text style={styles.modalProgress}>{mission.progressLabel}</Text>
          <Text style={styles.modalStatus}>Status: {mission.state}</Text>
          <Text style={styles.modalHelp}>
            Progress is verified automatically from the Live Map. Tapping this mission cannot complete it.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canClaim || isBusy }}
            disabled={!canClaim || isBusy}
            onPress={() => onClaim(mission.id)}
            style={[styles.claimButton, (!canClaim || isBusy) && styles.claimButtonDisabled]}
          >
            <Text style={styles.claimButtonText}>
              {alreadyClaimed ? 'Reward Claimed' : isBusy && canClaim ? 'Claiming…' : 'Claim Reward'}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// This shows the custom bottom navigation bar.
function BottomNav({
  router,
  safeBottom,
}: {
  router: any;
  safeBottom: number;
}) {
  return (
    <View style={[styles.bottomOverlay, { bottom: safeBottom + 10 }]}>
      <View style={styles.tabBar}>
        {bottomTabs.map((tab) => {
          const isActiveTab = tab.key === 'mission';

          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tabButton,
                pressed && styles.pressed
              ]}
              onPress={() => router.push(tab.route)}
            >
              <View
                style={[
                  styles.tabIconWrap,
                  isActiveTab && styles.activeTabIconWrap
                ]}
              >
                <Image
                  source={tab.image}
                  style={styles.tabIcon}
                  resizeMode="contain"
                />
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  isActiveTab && styles.activeTabLabel
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#05000c',
  },

  content: {
    paddingHorizontal: 20,
  },

  header: {
    alignItems: 'center',
    marginBottom: 22,
  },

  orb: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.9,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },

  companionName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 10,
  },

  companionType: {
    color: '#D4AF37',
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
  },

  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7e168f',
    backgroundColor: 'rgba(20, 0, 32, 0.78)',
    marginBottom: 12,
  },

  messageIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageText: {
    color: '#e9dff1',
    fontSize: 12,
  },

  smallText: {
    color: '#8f8499',
    fontSize: 10,
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },

  statBox: {
    flex: 1,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d1550',
    backgroundColor: 'rgba(9, 0, 18, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },

  statLabel: {
    color: '#8f8499',
    fontSize: 9,
    marginTop: 2,
  },

  progressCard: {
    minHeight: 118,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7e168f',
    backgroundColor: 'rgba(7, 0, 15, 0.82)',
    padding: 14,
    marginBottom: 42,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    color: '#bbecff',
    fontSize: 11,
    fontWeight: '800',
  },

  percentText: {
    color: '#b9adbf',
    fontSize: 10,
  },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1f132a',
    overflow: 'hidden',
    marginTop: 14,
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
  },

  adventureCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 42,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  adventureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  adventureTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  adventureText: {
    color: '#d8d0df',
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },

  rewardText: {
    color: '#D4AF37',
    fontSize: 10,
    marginTop: 7,
  },

  startButton: {
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  startText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  counterText: {
    color: '#8f8499',
    fontSize: 10,
  },

  missionItem: {
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#1e132b',
    backgroundColor: 'rgba(5, 0, 12, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },

  missionDone: {
    borderColor: '#008fb3',
    backgroundColor: 'rgba(0, 72, 112, 0.45)',
  },

  missionPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  missionText: {
    color: '#f2ecf7',
    fontSize: 14,
    fontWeight: '700',
  },

  missionCopy: { flex: 1, gap: 3 },
  missionProgressText: { color: '#9ddff0', fontSize: 11, fontWeight: '700' },
  loadingText: { color: '#b9adbf', textAlign: 'center', paddingVertical: 18 },
  errorText: { color: '#ffc46b', textAlign: 'center', paddingVertical: 10 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 0, 8, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#7e168f',
    backgroundColor: '#170c29',
    padding: 20,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  modalProgress: { color: '#68e7ff', fontSize: 17, fontWeight: '800', marginTop: 12 },
  modalStatus: { color: '#d8c9e3', fontSize: 12, marginTop: 6, textTransform: 'capitalize' },
  modalHelp: { color: '#a99bb5', fontSize: 12, lineHeight: 18, marginTop: 14 },
  claimButton: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008fb3',
    marginTop: 18,
  },
  claimButtonDisabled: { backgroundColor: '#33213f', opacity: 0.7 },
  claimButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  closeButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  closeButtonText: { color: '#c8a8df', fontSize: 12, fontWeight: '800' },

  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },

  difficultyBadge: {
    backgroundColor: 'rgba(0, 217, 255, 0.14)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  difficultyText: {
    color: '#6fe7ff',
    fontSize: 9,
    fontWeight: '800',
  },

  xpBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.13)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  xpText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '900',
  },

  bottomOverlay: {
    position: 'absolute',
    left: sidePadding,
    right: sidePadding,
  },

  tabBar: {
    minHeight: tabBarHeight,
    maxHeight: tabBarHeight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6d28d9',
    backgroundColor: 'rgba(6, 4, 26, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#a855f7',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 9,
  },

  tabButton: {
    flex: 1,
    minWidth: 0,
    height: tabBarHeight - 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  tabIconWrap: {
    width: isSmallPhone ? 38 : 44,
    height: isSmallPhone ? 38 : 44,
    borderRadius: isSmallPhone ? 19 : 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeTabIconWrap: {
    borderWidth: 1,
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(86, 19, 216, 0.32)',
  },

  tabIcon: {
    width: isSmallPhone ? 61 : 56,
    height: isSmallPhone ? 61 : 56,
  },

  tabLabel: {
    color: '#ffffff',
    fontSize: isSmallPhone ? 9 : 10,
    fontWeight: '800',
  },

  activeTabLabel: {
    color: '#00e5ff',
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
