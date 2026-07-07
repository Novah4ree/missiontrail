// =======================
// IMPORTS
// =======================
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Href, useRouter } from 'expo-router';

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
  map: require('../../assets/images/tabIcons/map.png'),
  mission: require('../../assets/images/tabIcons/mission.png'),
  trails: require('../../assets/images/tabIcons/trails.png'),
  vault: require('../../assets/images/tabIcons/vault.png'),
  profile: require('../../assets/images/tabIcons/profile.png'),
  companion: require('../../assets/images/tabIcons/companion.png'),
};

const bottomTabs = [
  { key: 'home-backup', label: 'Home', image: tabImages.home },
  { key: 'map', label: 'Map', image: tabImages.map },
  { key: 'mission', label: 'Mission', image: tabImages.mission },
  { key: 'trails', label: 'Trails', image: tabImages.trails },
  { key: 'vault', label: 'Vault', image: tabImages.vault },
  { key: 'profile', label: 'Profile', image: tabImages.profile },
  { key: 'companion', label: 'Compan...', image: tabImages.companion },
] as const;

export default function ProfileScreen() {
  const safeArea = useSafeAreaInsets();
  const router = useRouter();

  // Handle Logout & Redirect
  const handleSignOut = async () => {
    try {
      // 1. Terminate active Supabase session
      await supabase.auth.signOut();
      
      // 2. Clear route state and force direct login redirect
      router.replace('/login' as Href);
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
        <Text style={styles.headerTitle}>OPERATOR PROFILE</Text>

        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle-outline" size={80} color="#00e5ff" />
            <View style={styles.onlineBadge} />
          </View>
          <Text style={styles.usernameText}>Explorer_01</Text>
          <Text style={styles.rankText}>RANK: CADET</Text>
        </View>

        {/* STATS OVERVIEW */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Ionicons name="footsteps" size={22} color="#ff63f7" />
            <Text style={styles.statValue}>14.2k</Text>
            <Text style={styles.statLabel}>Total Steps</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="map" size={22} color="#00e5ff" />
            <Text style={styles.statValue}>6.4</Text>
            <Text style={styles.statLabel}>Miles Tracked</Text>
          </View>
        </View>

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
                onPress={() => {
                  if (tab.key === 'home-backup') router.push('/home-backup' as Href);
                  if (tab.key === 'profile') router.push('/profile' as Href);
                }}
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