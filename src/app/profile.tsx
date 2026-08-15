import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDailyProgress } from "@/hooks/use-daily-progress";
import { useDailyActivity } from "@/providers/activity-progress-provider";
import { getPlayerLevelProgress } from "@/utils/player-level";
import { supabase } from "../../lib/supabase";

const screen = Dimensions.get("window");
const isSmallPhone = screen.height < 740 || screen.width < 380;
const sidePadding = isSmallPhone ? 10 : 14;
const tabBarHeight = isSmallPhone ? 70 : 78;

type ExplorerRank = {
  level: number;
  name: string;
  color: string;
};

const RANK_ADJECTIVES = [
  "Rookie",
  "Neon",
  "Urban",
  "Wild",
  "Swift",
  "Hidden",
  "Lunar",
  "Solar",
  "Cosmic",
  "Nova",
  "Astral",
  "Storm",
  "Ember",
  "Frost",
  "Shadow",
  "Radiant",
  "Electric",
  "Quantum",
  "Celestial",
  "Mythic",
  "Phantom",
  "Eclipse",
  "Aurora",
  "Stellar",
  "Infinite",
] as const;

const RANK_TITLES = [
  "Scout",
  "Walker",
  "Wanderer",
  "Seeker",
  "Tracker",
  "Explorer",
  "Pathfinder",
  "Trailblazer",
  "Navigator",
  "Voyager",
  "Ranger",
  "Adventurer",
  "Wayfinder",
  "Relic Hunter",
  "Cartographer",
  "Expeditioner",
  "Vanguard",
  "Nomad",
  "Pioneer",
  "Legend",
] as const;

const RANK_SUFFIXES = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "Prime",
  "Ascendant",
  "Elite",
  "Master",
] as const;

const RANK_COLORS = [
  "#22D3EE",
  "#00E5FF",
  "#A855F7",
  "#C084FC",
  "#FF4FD8",
  "#F472B6",
  "#22C55E",
  "#84CC16",
  "#F59E0B",
  "#F97316",
] as const;

function normalizeExplorerLevel(level: number) {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.floor(level));
}

function getExplorerRank(level: number): ExplorerRank {
  const safeLevel = normalizeExplorerLevel(level);
  const zeroBased = safeLevel - 1;

  const adjectiveIndex = zeroBased % RANK_ADJECTIVES.length;

  const titleIndex =
    Math.floor(zeroBased / RANK_ADJECTIVES.length) % RANK_TITLES.length;

  const suffixIndex =
    Math.floor(zeroBased / (RANK_ADJECTIVES.length * RANK_TITLES.length)) %
    RANK_SUFFIXES.length;

  const prestigeCycle = Math.floor(
    zeroBased /
      (RANK_ADJECTIVES.length * RANK_TITLES.length * RANK_SUFFIXES.length),
  );

  const adjective = RANK_ADJECTIVES[adjectiveIndex];
  const title = RANK_TITLES[titleIndex];
  const suffix = RANK_SUFFIXES[suffixIndex];

  const prestige = prestigeCycle > 0 ? ` P${prestigeCycle + 1}` : "";

  const name = [adjective, title, suffix].filter(Boolean).join(" ") + prestige;

  const color = RANK_COLORS[Math.floor(zeroBased / 5) % RANK_COLORS.length];

  return {
    level: safeLevel,
    name,
    color,
  };
}

function getNextExplorerRank(level: number): ExplorerRank {
  return getExplorerRank(normalizeExplorerLevel(level) + 1);
}

const COLORS = {
  background: "#060611",
  surface: "#0D0B1C",
  surfaceStrong: "#120E26",
  surfaceSoft: "#16112B",
  purple: "#A855F7",
  purpleDark: "#6D28D9",
  cyan: "#22D3EE",
  cyanBright: "#00E5FF",
  pink: "#FF4FD8",
  green: "#22C55E",
  warning: "#F59E0B",
  red: "#FF3B6B",
  white: "#FFFFFF",
  text: "#F8F7FF",
  textMuted: "#A9A5C0",
  textDim: "#706A88",
  border: "rgba(168, 85, 247, 0.25)",
  cyanBorder: "rgba(34, 211, 238, 0.38)",
};

const tabImages = {
  home: require("../../assets/images/tabIcons/homemain.png"),
  mission: require("../../assets/images/tabIcons/mission.png"),
  trails: require("../../assets/images/tabIcons/trails.png"),
  vault: require("../../assets/images/tabIcons/vault.png"),
  profile: require("../../assets/images/tabIcons/profile.png"),
  companion: require("../../assets/images/tabIcons/companion.png"),
};

const bottomTabs = [
  { key: "home", label: "Home", image: tabImages.home, route: "/home-backup" },
  {
    key: "mission",
    label: "Mission",
    image: tabImages.mission,
    route: "/mission",
  },
  { key: "trails", label: "Trails", image: tabImages.trails, route: "/trails" },
  { key: "vault", label: "Vault", image: tabImages.vault, route: "/vault" },
  {
    key: "profile",
    label: "Profile",
    image: tabImages.profile,
    route: "/profile",
  },
  {
    key: "companion",
    label: "Compan...",
    image: tabImages.companion,
    route: "/companion",
  },
] as const;

type ProfileMatchColumn = "id" | "user_id";

type ProfileRecord = {
  id?: string | null;
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  state?: string | null;
  explorer_rank?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type RealProfile = {
  userId: string | null;
  email: string | null;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  city: string;
  state: string;
  joinedAt: string | null;
  databaseProfileExists: boolean;
  matchColumn: ProfileMatchColumn;
};

type ProfileDraft = {
  displayName: string;
  username: string;
  bio: string;
  city: string;
  state: string;
};

const EMPTY_PROFILE: RealProfile = {
  userId: null,
  email: null,
  displayName: "Explorer",
  username: "explorer",
  bio: "",
  avatarUrl: null,
  city: "",
  state: "",
  joinedAt: null,
  databaseProfileExists: false,
  matchColumn: "id",
};

export default function ProfileScreen() {
  const safeArea = useSafeAreaInsets();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  const {
    progress,
    isLoading: isProgressLoading,
    message: progressMessage,
    refresh: refreshProgress,
  } = useDailyProgress();
  const dailyActivity = useDailyActivity();

  const [profile, setProfile] = useState<RealProfile>(EMPTY_PROFILE);
  const [authMetadata, setAuthMetadata] = useState<Record<string, unknown>>({});
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({
    displayName: "",
    username: "",
    bio: "",
    city: "",
    state: "",
  });

  const playerLevel = getPlayerLevelProgress(progress?.totalXp ?? 0);

  // SAME live activity source used by Home / Today's Exploring.
  const todayMiles = dailyActivity.todayDistanceMiles;
  const todaySteps = dailyActivity.todaySteps;

  // These stay server/mission based.
  const tripsToday = progress?.verifiedSessionCount ?? 0;
  const activeSeconds = progress?.verifiedActiveSeconds ?? 0;
  const dailyStreak = progress?.dailyStreak ?? 0;

  const completedMissions = useMemo(
    () =>
      (progress?.missions ?? []).filter(
        (mission) => mission.completed || mission.state === "claimed",
      ).length,
    [progress?.missions],
  );

  const totalMissions = progress?.missions?.length ?? 0;
  const companion = progress?.companion;
  const companionBond = Math.round(companion?.bondPercent ?? 0);
  const companionEnergy = companion?.energy ?? 0;
  const companionMaximumEnergy = companion?.maximumEnergy ?? 0;

  const energyPercent =
    companionMaximumEnergy > 0
      ? Math.round((companionEnergy / companionMaximumEnergy) * 100)
      : 0;

  // Explorer rank comes from the same real XP-derived level used across the app.
  const currentLevel = playerLevel.level;
  const currentRank = getExplorerRank(currentLevel);
  const nextRank = getNextExplorerRank(currentLevel);

  useEffect(() => {
    void loadRealProfile();
  }, []);

  async function loadRealProfile() {
    setIsProfileLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setProfile(EMPTY_PROFILE);
        setAuthMetadata({});
        return;
      }

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

      setAuthMetadata(metadata);

      const profileResult = await loadProfileRow(user.id);
      const row = profileResult.row;

      const firstName = readString(metadata.first_name);
      const lastName = readString(metadata.last_name);
      const metadataFullName = [firstName, lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      const emailName = user.email?.split("@")[0]?.trim() || "explorer";

      const username =
        readString(row?.username) ||
        readString(metadata.username) ||
        readString(metadata.handle) ||
        emailName;

      const displayName =
        readString(row?.display_name) ||
        readString(metadata.display_name) ||
        readString(metadata.full_name) ||
        readString(metadata.name) ||
        metadataFullName ||
        username;

      const avatarUrl =
        readString(row?.avatar_url) ||
        readString(metadata.avatar_url) ||
        readString(metadata.picture) ||
        readString(metadata.photo_url) ||
        null;

      const bio = readString(row?.bio) || readString(metadata.bio) || "";

      const city = readString(row?.city) || readString(metadata.city) || "";

      const state = readString(row?.state) || readString(metadata.state) || "";

      setAvatarFailed(false);

      setProfile({
        userId: user.id,
        email: user.email ?? null,
        displayName,
        username: normalizeUsername(username) || "explorer",
        bio,
        avatarUrl,
        city,
        state,
        joinedAt: readString(row?.created_at) || user.created_at || null,
        databaseProfileExists: Boolean(row),
        matchColumn: profileResult.matchColumn,
      });
    } catch (error) {
      if (__DEV__) {
        console.warn("[Profile] Could not load real profile.", error);
      }

      Alert.alert(
        "Profile unavailable",
        "Mission Trails could not load your account profile from Supabase. Your verified activity can still appear below.",
      );
    } finally {
      setIsProfileLoading(false);
    }
  }

  async function handleRefresh() {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      await Promise.all([
        loadRealProfile(),
        refreshProgress(),
        dailyActivity.refreshActivity(),
      ]);
    } catch (error) {
      if (__DEV__) {
        console.warn("[Profile] Refresh failed.", error);
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  function openEditProfile() {
    setDraft({
      displayName: profile.displayName,
      username: profile.username,
      bio: profile.bio,
      city: profile.city,
      state: profile.state,
    });
    setEditError(null);
    setIsEditOpen(true);
  }

  async function saveProfile() {
    if (isSavingProfile) return;

    const displayName = draft.displayName.trim();
    const username = normalizeUsername(draft.username);
    const bio = draft.bio.trim();
    const city = draft.city.trim();
    const state = draft.state.trim();

    if (!profile.userId) {
      setEditError("You need to be signed in to update your profile.");
      return;
    }

    if (!displayName) {
      setEditError("Add a display name.");
      return;
    }

    if (!username) {
      setEditError("Add a username.");
      return;
    }

    if (username.length < 3) {
      setEditError("Username must be at least 3 characters.");
      return;
    }

    setIsSavingProfile(true);
    setEditError(null);

    const updates = {
      display_name: displayName,
      username,
      bio: bio || null,
      city: city || null,
      state: state || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (profile.databaseProfileExists) {
        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq(profile.matchColumn, profile.userId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("profiles").upsert(
          {
            id: profile.userId,
            ...updates,
          },
          { onConflict: "id" },
        );

        if (error) throw error;
      }

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          ...authMetadata,
          display_name: displayName,
          username,
          bio,
          city,
          state,
        },
      });

      if (authUpdateError) throw authUpdateError;

      await loadRealProfile();
      setIsEditOpen(false);

      Alert.alert(
        "Profile updated",
        "Your Mission Trails profile is now saved.",
      );
    } catch (error) {
      if (__DEV__) {
        console.warn("[Profile] Save failed.", error);
      }

      const message =
        error instanceof Error
          ? error.message
          : "Your profile could not be saved.";

      setEditError(message);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleShare() {
    try {
      const location = [profile.city, profile.state].filter(Boolean).join(", ");

      await Share.share({
        message: [
          `${profile.displayName} on Mission Trails`,
          `@${profile.username}`,
          `Level ${playerLevel.level} · ${currentRank.name}`,
          `${playerLevel.totalXp.toLocaleString()} lifetime XP`,
          location ? `Exploring from ${location}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } catch (error) {
      if (__DEV__) {
        console.warn("[Profile] Share failed.", error);
      }
    }
  }

  function confirmSignOut() {
    Alert.alert(
      "Disconnect session?",
      "You will be signed out of Mission Trails on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => void performSignOut(),
        },
      ],
    );
  }

  async function performSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
    } catch (error) {
      if (__DEV__) {
        console.warn("[Profile] Sign out failed.", error);
      }

      Alert.alert(
        "Could not sign out",
        "Your session could not be disconnected. Try again.",
      );
    }
  }

  const showAvatar = Boolean(profile.avatarUrl) && !avatarFailed;

  const locationText =
    [profile.city, profile.state].filter(Boolean).join(", ") ||
    "Location not added";

  const joinedText = profile.joinedAt
    ? `Joined ${formatJoinedDate(profile.joinedAt)}`
    : "Join date unavailable";

  const screenLoading = isProfileLoading && !profile.userId;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={styles.backgroundGlowOne} pointerEvents="none" />
      <View style={styles.backgroundGlowTwo} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: safeArea.top + 12,
            paddingBottom: safeArea.bottom + tabBarHeight + 44,
          },
        ]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={COLORS.cyanBright}
            colors={[COLORS.cyanBright]}
          />
        }
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.kicker}>MISSION TRAILS</Text>
            <Text style={styles.headerTitle}>EXPLORER PROFILE</Text>
          </View>
          <TouchableOpacity
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel="Open profile menu"
            accessibilityState={{ expanded: menuVisible }}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="shirt-outline" size={25} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileHero}>
          <View style={styles.heroAccentLine} />

          <View style={styles.identityRow}>
            <View style={styles.avatarOuterRing}>
              <View style={styles.avatarInnerRing}>
                {showAvatar ? (
                  <Image
                    source={{ uri: profile.avatarUrl! }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <Ionicons name="person" size={50} color={COLORS.cyanBright} />
                )}
              </View>

              <View style={styles.accountBadge}>
                <Ionicons
                  name="checkmark"
                  size={11}
                  color={COLORS.background}
                />
              </View>
            </View>

            <View style={styles.identityCopy}>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>ACCOUNT ACTIVE</Text>
              </View>

              <Text style={styles.usernameText} numberOfLines={1}>
                {screenLoading ? "Loading explorer…" : profile.displayName}
              </Text>

              <Text style={styles.handleText} numberOfLines={1}>
                @{profile.username}
              </Text>

              <View style={styles.locationLine}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={COLORS.cyan}
                />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationText}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.bioText}>
            {profile.bio || "No bio yet. Tap Edit Profile to add one."}
          </Text>

          <View style={styles.joinedRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={COLORS.textMuted}
            />
            <Text style={styles.joinedText}>{joinedText}</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={openEditProfile}
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="create-outline" size={17} color={COLORS.white} />
              <Text style={styles.primaryActionText}>Edit Profile</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => void handleShare()}
              style={({ pressed }) => [
                styles.secondaryAction,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="share-social-outline"
                size={17}
                color={COLORS.cyan}
              />
              <Text style={styles.secondaryActionText}>Share</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.xpCard}>
          <View style={styles.xpTopRow}>
            <View>
              <Text style={styles.sectionEyebrow}>EXPLORER LEVEL</Text>
              <Text style={styles.levelTitle}>Level {playerLevel.level}</Text>
            </View>

            <View style={styles.rankMiniPill}>
              <Ionicons
                name="compass-outline"
                size={14}
                color={currentRank.color}
              />
              <Text
                style={[styles.rankMiniPillText, { color: currentRank.color }]}
                numberOfLines={1}
              >
                {currentRank.name}
              </Text>
            </View>
          </View>

          <View style={styles.rankContainer}>
            <Text style={[styles.rankName, { color: currentRank.color }]}>
              {currentRank.name}
            </Text>

            <Text style={styles.rankLevel}>Level {currentRank.level}</Text>

            <Text style={styles.nextRank}>Next: {nextRank.name}</Text>
          </View>

          <View style={styles.xpNumbers}>
            <Text style={styles.xpCurrent}>
              {playerLevel.xpIntoLevel.toLocaleString()} XP
            </Text>
            <Text style={styles.xpRemaining}>
              {playerLevel.xpRemaining.toLocaleString()} XP to next level
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(
                    0,
                    Math.min(100, playerLevel.progressPercent),
                  )}%` as `${number}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.lifetimeXp}>
            {playerLevel.totalXp.toLocaleString()} lifetime XP
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>TODAY'S ACTIVITY</Text>

            <Text style={styles.sectionTitle}>Today&apos;s Exploring</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="footsteps"
            value={isProgressLoading ? "…" : compactNumber(todaySteps)}
            label="Steps"
            accent={COLORS.pink}
          />

          <StatCard
            icon="navigate"
            value={isProgressLoading ? "…" : todayMiles.toFixed(2)}
            label="Miles"
            accent={COLORS.cyan}
          />

          <StatCard
            icon="time-outline"
            value={isProgressLoading ? "…" : formatActiveTime(activeSeconds)}
            label="Active"
            accent={COLORS.purple}
          />

          <StatCard
            icon="flame-outline"
            value={isProgressLoading ? "…" : String(dailyStreak)}
            label="Day Streak"
            accent={COLORS.warning}
          />

          <StatCard
            icon="trail-sign-outline"
            value={isProgressLoading ? "…" : String(tripsToday)}
            label="Trips"
            accent={COLORS.green}
          />

          <StatCard
            icon="checkmark-done-outline"
            value={
              isProgressLoading ? "…" : `${completedMissions}/${totalMissions}`
            }
            label="Missions"
            accent={COLORS.cyanBright}
          />
        </View>

        <View style={styles.companionCard}>
          <View style={styles.companionHeader}>
            <View style={styles.companionIcon}>
              <Ionicons name="paw" size={22} color={COLORS.pink} />
            </View>

            <View style={styles.companionHeaderCopy}>
              <Text style={styles.sectionEyebrow}>ACTIVE COMPANION</Text>
              <Text style={styles.companionTitle}>Companion Sync</Text>
            </View>
          </View>

          {companion?.companionId ? (
            <>
              <ProgressMetric
                label="Bond"
                value={`${companionBond}%`}
                percent={companionBond}
                accent={COLORS.pink}
              />

              <ProgressMetric
                label="Energy"
                value={`${companionEnergy}/${companionMaximumEnergy}`}
                percent={energyPercent}
                accent={COLORS.cyan}
              />
            </>
          ) : (
            <Text style={styles.emptyCompanion}>
              No active companion is connected yet.
            </Text>
          )}
        </View>

        {progressMessage ? (
          <View style={styles.progressMessageCard}>
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={COLORS.cyan}
            />

            <View style={styles.messageCopy}>
              <Text
                accessibilityLiveRegion="polite"
                style={styles.progressMessage}
              >
                {progressMessage}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => void handleRefresh()}
                style={({ pressed }) => [
                  styles.progressRetry,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.progressRetryText}>Retry Sync</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={confirmSignOut}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="log-out-outline" size={19} color={COLORS.red} />

          <View style={styles.logoutCopy}>
            <Text style={styles.logoutText}>DISCONNECT SESSION</Text>
            <Text style={styles.logoutSubtext}>Sign out of this device</Text>
          </View>

          <Ionicons name="chevron-forward" size={17} color={COLORS.textDim} />
        </Pressable>
      </ScrollView>

      <View style={[styles.bottomOverlay, { bottom: safeArea.bottom + 8 }]}>
        <View style={styles.tabBar}>
          {bottomTabs.map((tab) => {
            const isActiveTab = tab.key === "profile";

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                style={({ pressed }) => [
                  styles.tabButton,
                  pressed && !isActiveTab && styles.pressed,
                ]}
                onPress={() => {
                  if (!isActiveTab) {
                    router.push(tab.route);
                  }
                }}
              >
                <View
                  style={[
                    styles.tabIconWrap,
                    isActiveTab && styles.activeTabIconWrap,
                  ]}
                >
                  <Image
                    source={tab.image}
                    style={[
                      styles.tabIcon,
                      isActiveTab && styles.activeTabIcon,
                    ]}
                    resizeMode="contain"
                  />
                </View>

                <Text
                  style={[
                    styles.tabLabel,
                    isActiveTab && styles.activeTabLabel,
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

      {/* PROFILE HANGER MENU */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            style={[
              styles.menuPanel,
              {
                marginTop: safeArea.top + 55,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuEyebrow}>EXPLORER</Text>

                <Text style={styles.menuTitle}>Profile Menu</Text>
              </View>

              <TouchableOpacity
                style={styles.closeMenuButton}
                onPress={() => setMenuVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            {/* EDIT PROFILE */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                openEditProfile();
              }}
            >
              <View style={[styles.menuIcon, { borderColor: COLORS.purple }]}>
                <Ionicons
                  name="person-outline"
                  size={23}
                  color={COLORS.purple}
                />
              </View>

              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemTitle}>Edit Profile</Text>

                <Text style={styles.menuItemSubtitle}>
                  Change your explorer information
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textDim}
              />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* REFRESH */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                void handleRefresh();
              }}
            >
              <View style={[styles.menuIcon, { borderColor: COLORS.cyan }]}>
                <Ionicons name="sync-outline" size={23} color={COLORS.cyan} />
              </View>

              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemTitle}>Refresh Profile</Text>

                <Text style={styles.menuItemSubtitle}>
                  Sync steps, miles, missions and XP
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textDim}
              />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* SHARE */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                void handleShare();
              }}
            >
              <View style={[styles.menuIcon, { borderColor: COLORS.pink }]}>
                <Ionicons
                  name="share-social-outline"
                  size={23}
                  color={COLORS.pink}
                />
              </View>

              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemTitle}>Share Profile</Text>

                <Text style={styles.menuItemSubtitle}>
                  Share your explorer profile
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textDim}
              />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* SIGN OUT */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                confirmSignOut();
              }}
            >
              <View style={[styles.menuIcon, { borderColor: COLORS.red }]}>
                <Ionicons name="log-out-outline" size={23} color={COLORS.red} />
              </View>

              <View style={styles.menuItemTextContainer}>
                <Text style={[styles.menuItemTitle, { color: COLORS.red }]}>
                  Sign Out
                </Text>

                <Text style={styles.menuItemSubtitle}>
                  Disconnect this device
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textDim}
              />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isEditOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSavingProfile) {
            setIsEditOpen(false);
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.editSheet}>
            <View style={styles.editSheetHandle} />

            <View style={styles.editHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>PROFILE</Text>
                <Text style={styles.editTitle}>Edit Profile</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close edit profile"
                disabled={isSavingProfile}
                onPress={() => setIsEditOpen(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.editScroll}
            >
              <ProfileInput
                label="Display name"
                value={draft.displayName}
                placeholder="Your explorer name"
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    displayName: value,
                  }))
                }
              />

              <ProfileInput
                label="Username"
                value={draft.username}
                placeholder="username"
                autoCapitalize="none"
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    username: value,
                  }))
                }
              />

              <ProfileInput
                label="Bio"
                value={draft.bio}
                placeholder="Tell other explorers about you"
                multiline
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    bio: value,
                  }))
                }
              />

              <View style={styles.inlineInputs}>
                <View style={styles.inlineInput}>
                  <ProfileInput
                    label="City"
                    value={draft.city}
                    placeholder="City"
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        city: value,
                      }))
                    }
                  />
                </View>

                <View style={styles.stateInput}>
                  <ProfileInput
                    label="State"
                    value={draft.state}
                    placeholder="CA"
                    autoCapitalize="characters"
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        state: value,
                      }))
                    }
                  />
                </View>
              </View>

              <View style={styles.avatarNotice}>
                <Ionicons name="image-outline" size={19} color={COLORS.cyan} />
                <Text style={styles.avatarNoticeText}>
                  Your avatar is loaded.
                  <Text style={styles.codeText}> avatar_url </Text>
                  field. We can wire camera/gallery upload next.
                </Text>
              </View>

              {editError ? (
                <View style={styles.editErrorCard}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color={COLORS.warning}
                  />
                  <Text style={styles.editErrorText}>{editError}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSavingProfile}
                onPress={() => void saveProfile()}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.pressed,
                  isSavingProfile && styles.disabledButton,
                ]}
              >
                {isSavingProfile ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={19}
                      color={COLORS.white}
                    />
                    <Text style={styles.saveButtonText}>SAVE</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

async function loadProfileRow(userId: string): Promise<{
  row: ProfileRecord | null;
  matchColumn: ProfileMatchColumn;
}> {
  const byId = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!byId.error && byId.data) {
    return {
      row: byId.data as ProfileRecord,
      matchColumn: "id",
    };
  }

  const byUserId = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!byUserId.error && byUserId.data) {
    return {
      row: byUserId.data as ProfileRecord,
      matchColumn: "user_id",
    };
  }

  if (__DEV__) {
    if (byId.error) {
      console.warn("[Profile] profiles.id lookup failed:", byId.error.message);
    }

    if (byUserId.error) {
      console.warn(
        "[Profile] profiles.user_id lookup failed:",
        byUserId.error.message,
      );
    }
  }

  return {
    row: null,
    matchColumn: "id",
  };
}

function StatCard({
  icon,
  value,
  label,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statIconWrap, { borderColor: accent }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>

      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>

      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProgressMetric({
  label,
  value,
  percent,
  accent,
}: {
  label: string;
  value: string;
  percent: number;
  accent: string;
}) {
  const safePercent = Math.max(0, Math.min(100, percent));

  return (
    <View style={styles.metricBlock}>
      <View style={styles.metricTopRow}>
        <Text style={styles.metricLabel}>{label}</Text>

        <Text style={styles.metricValue}>{value}</Text>
      </View>

      <View style={styles.metricTrack}>
        <View
          style={[
            styles.metricFill,
            {
              width: `${safePercent}%` as `${number}%`,
              backgroundColor: accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

function AccountRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.accountRow}>
      <View style={styles.accountIcon}>
        <Ionicons name={icon} size={18} color={COLORS.cyan} />
      </View>

      <View style={styles.accountCopy}>
        <Text style={styles.accountLabel}>{label}</Text>
        <Text style={styles.accountValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ProfileInput({
  label,
  value,
  placeholder,
  onChangeText,
  multiline = false,
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.inputLabel}>{label}</Text>

      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDim}
        onChangeText={onChangeText}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
}

function compactNumber(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return Math.round(value).toLocaleString();
}

function formatActiveTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;

  const minutes = Math.floor(safeSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatJoinedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(date);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundGlowOne: {
    position: "absolute",
    top: -90,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(126, 34, 206, 0.18)",
  },
  backgroundGlowTwo: {
    position: "absolute",
    top: 320,
    left: -130,
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: "rgba(0, 229, 255, 0.07)",
  },
  scrollContainer: {
    paddingHorizontal: sidePadding,
  },
  topBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  kicker: {
    color: COLORS.cyan,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  headerTitle: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: isSmallPhone ? 20 : 24,
    fontWeight: "900",
    letterSpacing: 1,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.cyanBorder,
    backgroundColor: "rgba(34, 211, 238, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileHero: {
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(13, 11, 28, 0.94)",
    padding: isSmallPhone ? 16 : 20,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 7,
  },
  heroAccentLine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: COLORS.cyanBright,
    opacity: 0.85,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  avatarOuterRing: {
    width: isSmallPhone ? 86 : 96,
    height: isSmallPhone ? 86 : 96,
    borderRadius: isSmallPhone ? 43 : 48,
    borderWidth: 2,
    borderColor: COLORS.purple,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInnerRing: {
    width: isSmallPhone ? 76 : 86,
    height: isSmallPhone ? 76 : 86,
    borderRadius: isSmallPhone ? 38 : 43,
    borderWidth: 2,
    borderColor: COLORS.cyanBright,
    backgroundColor: "#121328",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  accountBadge: {
    position: "absolute",
    right: 0,
    bottom: 7,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: COLORS.surface,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  activePill: {
    alignSelf: "flex-start",
    minHeight: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 7,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  activeText: {
    color: "#A7F3D0",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  usernameText: {
    color: COLORS.text,
    fontSize: isSmallPhone ? 20 : 23,
    fontWeight: "900",
  },
  handleText: {
    marginTop: 3,
    color: COLORS.cyan,
    fontSize: 12,
    fontWeight: "800",
  },
  locationLine: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  locationText: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 11,
  },
  bioText: {
    marginTop: 18,
    color: "#E4DFF4",
    fontSize: 13,
    lineHeight: 20,
  },
  joinedRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  joinedText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  actionRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: COLORS.purpleDark,
    borderWidth: 1,
    borderColor: COLORS.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "900",
  },
  secondaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(34, 211, 238, 0.07)",
    borderWidth: 1,
    borderColor: COLORS.cyanBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryActionText: {
    color: COLORS.cyan,
    fontSize: 12,
    fontWeight: "900",
  },
  xpCard: {
    marginTop: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.cyanBorder,
    backgroundColor: "rgba(9, 20, 34, 0.92)",
    padding: 17,
  },
  xpTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  levelTitle: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  rankMiniPill: {
    maxWidth: "58%",
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.cyanBorder,
    backgroundColor: "rgba(34, 211, 238, 0.06)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rankMiniPillText: {
    flexShrink: 1,
    color: COLORS.cyan,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "right",
  },
  rankContainer: {
    marginTop: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.24)",
    backgroundColor: "rgba(168, 85, 247, 0.06)",
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rankName: {
    fontSize: isSmallPhone ? 16 : 18,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  rankLevel: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "800",
  },
  nextRank: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  xpNumbers: {
    marginTop: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  xpCurrent: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "900",
  },
  xpRemaining: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: "right",
  },
  progressTrack: {
    marginTop: 9,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#211B36",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: COLORS.cyanBright,
  },
  lifetimeXp: {
    marginTop: 8,
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "right",
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionHeaderCompact: {
    marginTop: 24,
    marginBottom: 11,
  },
  sectionEyebrow: {
    color: COLORS.purple,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  sectionTitle: {
    marginTop: 3,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  verifiedPill: {
    minHeight: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.28)",
    backgroundColor: "rgba(34, 197, 94, 0.07)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    color: "#86EFAC",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  statBox: {
    flexGrow: 1,
    flexBasis: isSmallPhone ? "47%" : "30%",
    minWidth: 0,
    minHeight: 108,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(13, 11, 28, 0.9)",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  statValue: {
    marginTop: 8,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
  },
  companionCard: {
    marginTop: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 79, 216, 0.24)",
    backgroundColor: "rgba(23, 10, 30, 0.92)",
    padding: 16,
  },
  companionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  companionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 79, 216, 0.35)",
    backgroundColor: "rgba(255, 79, 216, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  companionHeaderCopy: {
    flex: 1,
  },
  companionTitle: {
    marginTop: 2,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
  metricBlock: {
    marginTop: 10,
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "900",
  },
  metricTrack: {
    marginTop: 7,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#25192E",
    overflow: "hidden",
  },
  metricFill: {
    height: "100%",
    borderRadius: 4,
  },
  emptyCompanion: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },
  progressMessageCard: {
    marginTop: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.cyanBorder,
    backgroundColor: "rgba(10, 28, 38, 0.92)",
    padding: 13,
    flexDirection: "row",
    gap: 10,
  },
  messageCopy: {
    flex: 1,
  },
  progressMessage: {
    color: "#D9F7FB",
    fontSize: 11,
    lineHeight: 17,
  },
  progressRetry: {
    alignSelf: "flex-start",
    marginTop: 8,
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: COLORS.purpleDark,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  progressRetryText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "900",
  },
  accountCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(13, 11, 28, 0.9)",
    paddingHorizontal: 14,
  },
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 24,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(18, 11, 32, 0.94)",

    borderWidth: 1,
    borderColor: "#63309A",

    shadowColor: COLORS.purple,
    shadowOpacity: 0.25,
    shadowRadius: 10,

    elevation: 8,
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.70)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },

  menuPanel: {
    width: "88%",
    maxWidth: 390,
    marginTop: 70,
    marginRight: 14,
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#0D0918",
    borderWidth: 1,
    borderColor: "#57257C",

    shadowColor: "#A855F7",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },

  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  menuEyebrow: {
    color: "#BB63FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
  },

  menuTitle: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
  },

  closeMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171123",
    borderWidth: 1,
    borderColor: "#3D2853",
  },

  menuItem: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },

  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    backgroundColor: "#12101E",
    borderWidth: 1,
  },

  menuItemTextContainer: {
    flex: 1,
  },

  menuItemTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  menuItemSubtitle: {
    marginTop: 4,
    color: "#928DA6",
    fontSize: 12,
    fontWeight: "600",
  },

  menuDivider: {
    height: 1,
    backgroundColor: "#28183A",
    marginVertical: 5,
  },
  accountRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cyanBorder,
    backgroundColor: "rgba(34, 211, 238, 0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "800",
  },
  accountValue: {
    marginTop: 3,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(168, 85, 247, 0.13)",
  },
  logoutButton: {
    marginTop: 14,
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 107, 0.22)",
    backgroundColor: "rgba(48, 10, 24, 0.7)",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 15,
  },
  logoutCopy: {
    flex: 1,
  },
  logoutText: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  logoutSubtext: {
    marginTop: 3,
    color: COLORS.textDim,
    fontSize: 9,
  },
  bottomOverlay: {
    position: "absolute",
    left: sidePadding,
    right: sidePadding,
  },
  tabBar: {
    height: tabBarHeight,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#6D28D9",
    backgroundColor: "rgba(6, 4, 26, 0.97)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 9,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    height: tabBarHeight - 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabIconWrap: {
    width: isSmallPhone ? 32 : 36,
    height: isSmallPhone ? 32 : 36,
    borderRadius: isSmallPhone ? 16 : 18,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTabIconWrap: {
    borderWidth: 1,
    borderColor: COLORS.cyanBright,
    backgroundColor: "rgba(34, 211, 238, 0.12)",
  },
  tabIcon: {
    width: isSmallPhone ? 34 : 38,
    height: isSmallPhone ? 34 : 38,
    opacity: 0.84,
  },
  activeTabIcon: {
    opacity: 1,
  },
  tabLabel: {
    color: COLORS.textMuted,
    fontSize: isSmallPhone ? 8 : 9,
    fontWeight: "800",
  },
  activeTabLabel: {
    color: COLORS.cyanBright,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  editSheet: {
    maxHeight: "90%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceStrong,
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  editSheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textDim,
    marginBottom: 12,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  editTitle: {
    marginTop: 3,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  editScroll: {
    paddingBottom: 10,
  },
  inputBlock: {
    marginTop: 12,
  },
  inputLabel: {
    marginBottom: 7,
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#0A0918",
    color: COLORS.text,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 104,
    paddingTop: 13,
    textAlignVertical: "top",
  },
  inlineInputs: {
    flexDirection: "row",
    gap: 10,
  },
  inlineInput: {
    flex: 1,
  },
  stateInput: {
    width: 96,
  },
  avatarNotice: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cyanBorder,
    backgroundColor: "rgba(34, 211, 238, 0.06)",
    padding: 12,
    flexDirection: "row",
    gap: 9,
  },
  avatarNoticeText: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 10,
    lineHeight: 16,
  },
  codeText: {
    color: COLORS.cyan,
    fontWeight: "900",
  },
  editErrorCard: {
    marginTop: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    backgroundColor: "rgba(66, 38, 6, 0.75)",
    padding: 11,
    flexDirection: "row",
    gap: 8,
  },
  editErrorText: {
    flex: 1,
    color: "#FDE7B0",
    fontSize: 10,
    lineHeight: 16,
  },
  saveButton: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.purpleDark,
    borderWidth: 1,
    borderColor: COLORS.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#100B1D",
    borderWidth: 1,
    borderColor: "#452260",
  },

  headerSpacer: {
    width: 44,
  },

  eyebrow: {
    textAlign: "center",
    color: "#BB63FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 3,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  card: {
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: "#0D0918",
    borderWidth: 1,
    borderColor: "#38214D",
  },

  settingRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
  },

  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#12101F",
    borderWidth: 1,
    marginRight: 14,
  },

  settingText: {
    flex: 1,
    paddingRight: 8,
  },

  settingTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  settingSubtitle: {
    marginTop: 4,
    color: "#928DA6",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },

  version: {
    marginTop: 35,
    textAlign: "center",
    color: "#585267",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
});
