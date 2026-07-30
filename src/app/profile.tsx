// =======================
// IMPORTS
// =======================
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { getPlayerLevelProgress } from '@/utils/player-level';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Stepping up twice to escape /app and /src to reach root lib
import { supabase } from '../../lib/supabase';

const screen = Dimensions.get('window');
const isSmallPhone = screen.height < 740 || screen.width < 380;
const sidePadding = isSmallPhone ? 9 : 12;
const tabBarHeight = isSmallPhone ? 72 : 82;

// =======================
// IMAGES & TABS CONFIG (Stepping up twice to reach root assets)
// =======================
const tabImages = {
  home: require('../../assets/images/tabIcons/homemain.png'),
  mission: require('../../assets/images/tabIcons/mission.png'),
  trails: require('../../assets/images/tabIcons/trails.png'),
  vault: require('../../assets/images/tabIcons/vault.png'),
  profile: require('../../assets/images/tabIcons/profile.png'),
  companion: require('../../assets/images/tabIcons/companion.png'),
};

const bottomTabs = [
  // Home is the Live Map entry, so a second Map button is not needed.
  { key: 'home', label: 'Home', image: tabImages.home, route: '/home-backup' },
  { key: 'mission', label: 'Mission', image: tabImages.mission, route: '/mission' },
  { key: 'trails', label: 'Trails', image: tabImages.trails, route: '/trails' },
  { key: 'vault', label: 'Vault', image: tabImages.vault, route: '/vault' },
  { key: 'profile', label: 'Profile', image: tabImages.profile, route: '/profile' },
  { key: 'companion', label: 'Compan...', image: tabImages.companion, route: '/companion' },
] as const;

type ProfileHeaderData = {
  displayName: string;
  username: string;
  avatarUrl?: string;
  explorerRank: string;
  auraColors: string[];
  bio: string;
  isOnline: boolean;
};

const profilePlaceholder: ProfileHeaderData = {
  displayName: 'Unnamed Explorer',
  username: 'username-unavailable',
  explorerRank: 'Rank unavailable',
  auraColors: [],
  bio: 'No bio added yet.',
  isOnline: false,
};

function metadataText(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function metadataAuraColors(metadata: Record<string, unknown>) {
  const colors = metadata.aura_colors;
  const values = Array.isArray(colors)
    ? colors
    : [metadata.aura_color, metadata.secondary_aura_color];
  return values.filter(
    (value): value is string =>
      typeof value === 'string'
      && /^(#[0-9a-f]{3,8}|rgba?\([^)]+\))$/i.test(value.trim()),
  ).map((value) => value.trim()).slice(0, 4);
}

export default function ProfileScreen() {
  const safeArea = useSafeAreaInsets();
  const router = useRouter();
  const { progress, isLoading, message: progressMessage, refresh } = useDailyProgress();
  const todayMiles = ((progress?.verifiedDistanceMeters ?? 0) / 1_609.344).toFixed(2);
  const playerLevel = getPlayerLevelProgress(progress?.totalXp ?? 0);
  const [profileHeader, setProfileHeader] = useState<ProfileHeaderData>(profilePlaceholder);

  useEffect(() => {
    let isMounted = true;

    async function loadProfileHeader() {
      const { data, error } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (error || !data.user) {
        setProfileHeader(profilePlaceholder);
        return;
      }

      const metadata = data.user.user_metadata as Record<string, unknown>;
      const emailUsername = data.user.email?.split('@')[0]?.trim();
      const firstName = metadataText(metadata, 'first_name');
      const lastName = metadataText(metadata, 'last_name');
      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      setProfileHeader({
        displayName: metadataText(metadata, 'full_name', 'display_name', 'name')
          ?? fullName
          ?? emailUsername
          ?? profilePlaceholder.displayName,
        username: metadataText(metadata, 'username', 'handle')
          ?? emailUsername
          ?? profilePlaceholder.username,
        avatarUrl: metadataText(metadata, 'avatar_url', 'picture', 'photo_url'),
        explorerRank: metadataText(metadata, 'explorer_rank', 'rank')
          ?? profilePlaceholder.explorerRank,
        auraColors: metadataAuraColors(metadata),
        bio: metadataText(metadata, 'bio', 'about', 'description')
          ?? profilePlaceholder.bio,
        isOnline: true,
      });
    }

    void loadProfileHeader();
    return () => {
      isMounted = false;
    };
  }, []);

  const auraDots: (string | null)[] = profileHeader.auraColors.length
    ? profileHeader.auraColors
    : [null, null, null];

  // Handle Logout & Redirect
  const handleSignOut = async () => {
    try {
      // 1. Terminate active Supabase session
      await supabase.auth.signOut();
      
      // 2. Clear route state and force direct login redirect
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      
      <View style={styles.cosmicOverlay} pointerEvents="none" />

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContainer, 
          { 
            paddingTop: safeArea.top + 20, 
            paddingBottom: safeArea.bottom + tabBarHeight + 40 
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View
          style={[
            styles.profileCard,
            {
              paddingHorizontal: isSmallPhone ? 18 : 24,
              paddingTop: 18,
              paddingBottom: 22,
              gap: 0,
            },
          ]}
        >
          <View style={{ width: '100%', minHeight: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.headerTitle, { marginVertical: 0 }]}>OPERATOR PROFILE</Text>
            <Pressable
              accessibilityLabel="Open profile menu"
              accessibilityRole="button"
              disabled
              hitSlop={10}
              style={({ pressed }) => ({
                position: 'absolute',
                right: 0,
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(0, 229, 255, 0.45)',
                backgroundColor: 'rgba(0, 229, 255, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#ffffff" />
            </Pressable>
          </View>

          <View
            style={{
              marginTop: 16,
              width: 106,
              height: 106,
              borderRadius: 53,
              borderWidth: 2,
              borderColor: '#00e5ff',
              backgroundColor: '#17132f',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible',
            }}
          >
            {profileHeader.avatarUrl ? (
              <ExpoImage
                source={{ uri: profileHeader.avatarUrl }}
                contentFit="cover"
                transition={180}
                style={{ width: 98, height: 98, borderRadius: 49 }}
              />
            ) : (
              <Ionicons name="person" size={54} color="#8a90bd" />
            )}
            <View
              accessibilityLabel={profileHeader.isOnline ? 'Online' : 'Offline'}
              style={{
                position: 'absolute',
                right: 2,
                bottom: 7,
                width: 19,
                height: 19,
                borderRadius: 10,
                borderWidth: 3,
                borderColor: '#08051c',
                backgroundColor: profileHeader.isOnline ? '#35f38b' : '#72758d',
              }}
            />
          </View>

          <Text selectable style={[styles.usernameText, { marginTop: 12, textAlign: 'center' }]}>
            {profileHeader.displayName}
          </Text>
          <Text
            selectable
            style={{ marginTop: 3, color: '#9298bd', fontSize: 13, fontWeight: '700' }}
          >
            @{profileHeader.username.replace(/^@+/, '')}
          </Text>

          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <View
              style={{
                minHeight: 30,
                borderRadius: 15,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#6d28d9',
              }}
            >
              <Ionicons name="sparkles" size={13} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 }}>
                {isLoading && !progress ? 'LEVEL —' : `LEVEL ${playerLevel.level}`}
              </Text>
            </View>
            <View
              style={{
                minHeight: 30,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: 'rgba(0, 229, 255, 0.55)',
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: 'rgba(0, 229, 255, 0.08)',
              }}
            >
              <Ionicons name="compass-outline" size={14} color="#00e5ff" />
              <Text style={{ color: '#c6f8ff', fontSize: 11, fontWeight: '800' }}>
                EXPLORER RANK · {profileHeader.explorerRank.toUpperCase()}
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 15,
              minHeight: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: '#9ba0c8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>
              AURA
            </Text>
            {auraDots.map((color, index) => (
              <View
                key={`${color ?? 'empty'}-${index}`}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: color ?? '#595d7c',
                  backgroundColor: color ?? 'transparent',
                }}
              />
            ))}
            {profileHeader.auraColors.length === 0 ? (
              <Text style={{ color: '#747997', fontSize: 10, fontWeight: '600' }}>Not selected</Text>
            ) : null}
          </View>

          <Text
            selectable
            style={{
              marginTop: 13,
              maxWidth: 310,
              color: '#d9dcf3',
              fontSize: 13,
              lineHeight: 19,
              textAlign: 'center',
            }}
          >
            {profileHeader.bio}
          </Text>
        </View>

        {/* STATS OVERVIEW */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Ionicons name="footsteps" size={22} color="#ff63f7" />
            <Text style={styles.statValue}>{isLoading ? '…' : progress?.verifiedSessionCount ?? 0}</Text>
            <Text style={styles.statLabel}>Trips Today</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="map" size={22} color="#00e5ff" />
            <Text style={styles.statValue}>{isLoading ? '…' : todayMiles}</Text>
            <Text style={styles.statLabel}>Miles Today</Text>
          </View>
        </View>

        {progressMessage ? (
          <View style={styles.progressMessageCard}>
            <Text accessibilityLiveRegion="polite" style={styles.progressMessage}>{progressMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.progressRetry}>
              <Text style={styles.progressRetryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : null}

        {/* MENU OPTIONS */}
        <View style={styles.menuContainer}>
          <Pressable style={styles.menuItem}>
            <Ionicons name="settings-outline" size={20} color="#ffffff" />
            <Text style={styles.menuText}>System Settings</Text>
            <Ionicons name="chevron-forward" size={16} color="#767676" />
          </Pressable>

          <Pressable style={styles.menuItem}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color="#ffffff" />
            <Text style={styles.menuText}>Security & Privacy</Text>
            <Ionicons name="chevron-forward" size={16} color="#767676" />
          </Pressable>

          <View style={styles.divider} />

          {/* SIGN OUT BUTTON */}
          <Pressable 
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]} 
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#ff2d75" />
            <Text style={styles.logoutText}>DISCONNECT SESSION</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <View style={[styles.bottomOverlay, { bottom: safeArea.bottom + 10 }]}>
        <View style={styles.tabBar}>
          {bottomTabs.map((tab) => {
            const isActiveTab = tab.key === 'profile';

            return (
              <Pressable 
                key={tab.key} 
                style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
                onPress={() => router.push(tab.route)}
              >
                <View style={[styles.tabIconWrap, isActiveTab && styles.activeTabIconWrap]}>
                  <Image source={tab.image} style={styles.tabIcon} resizeMode="contain" />
                </View>
                <Text style={[styles.tabLabel, isActiveTab && styles.activeTabLabel]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// =======================
// STYLES
// =======================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  cosmicOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 10, 46, 0.25)',
  },
  scrollContainer: {
    paddingHorizontal: sidePadding,
    alignItems: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    left: sidePadding,
    right: sidePadding,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: isSmallPhone ? 16 : 18,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
    textShadowColor: '#a855f7',
    textShadowRadius: 8,
    marginVertical: 20,
    textAlign: 'center',
  },
  profileCard: {
    width: '100%',
    backgroundColor: 'rgba(8, 5, 28, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#a855f7',
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#a855f7',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00e5ff',
    borderWidth: 2,
    borderColor: '#08051c',
  },
  usernameText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  rankText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  progressMessageCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(40, 18, 67, 0.82)',
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  progressMessage: {
    color: '#f3e8ff',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  progressRetry: {
    minHeight: 40,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
  },
  progressRetryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(8, 5, 28, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: '#b0b5e0',
    fontSize: 11,
    fontWeight: '600',
  },
  menuContainer: {
    width: '100%',
    backgroundColor: 'rgba(8, 5, 28, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
  },
  menuText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    marginHorizontal: 20,
    marginVertical: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    color: '#ff2d75',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
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
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
