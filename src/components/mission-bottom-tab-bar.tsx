import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export type MissionTabKey =
  | 'home'
  | 'mission'
  | 'trails'
  | 'vault'
  | 'profile'
  | 'companion';

const TAB_IMAGES = {
  home: require('../../assets/images/tabIcons/homemain.png'),
  mission: require('../../assets/images/tabIcons/mission.png'),
  trails: require('../../assets/images/tabIcons/trails.png'),
  vault: require('../../assets/images/tabIcons/vault.png'),
  profile: require('../../assets/images/tabIcons/profile.png'),
  companion: require('../../assets/images/tabIcons/companion.png'),
};

const TABS = [
  // Home opens the Live Map; keeping a separate Map tab would duplicate it.
  { key: 'home', label: 'Home', image: TAB_IMAGES.home, route: '/home-backup' },
  { key: 'mission', label: 'Mission', image: TAB_IMAGES.mission, route: '/mission' },
  { key: 'trails', label: 'Trails', image: TAB_IMAGES.trails, route: '/trails' },
  { key: 'vault', label: 'Vault', image: TAB_IMAGES.vault, route: '/vault' },
  { key: 'profile', label: 'Profile', image: TAB_IMAGES.profile, route: '/profile' },
  { key: 'companion', label: 'Compan...', image: TAB_IMAGES.companion, route: '/companion' },
] as const;

/** Displays the same six cyberpunk navigation buttons used by the Live Map. */
export function MissionBottomTabBar({ activeTab }: { activeTab: MissionTabKey }) {
  const router = useRouter();
  const window = useWindowDimensions();
  const isSmallPhone = window.height < 740 || window.width < 380;
  const tabBarHeight = isSmallPhone ? 72 : 82;
  const iconWrapSize = isSmallPhone ? 38 : 44;
  const iconSize = isSmallPhone ? 61 : 56;

  return (
    <View style={[styles.tabBar, { height: tabBarHeight }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={`${tab.label.replace('...', 'ion')} tab`}
            accessibilityState={{ selected: isActive }}
            hitSlop={4}
            onPress={() => router.push(tab.route)}
            style={({ pressed }) => [
              styles.tabButton,
              { height: tabBarHeight - 6 },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.tabIconWrap,
                { width: iconWrapSize, height: iconWrapSize, borderRadius: iconWrapSize / 2 },
                isActive && styles.activeTabIconWrap,
              ]}
            >
              <Image
                source={tab.image}
                resizeMode="contain"
                style={{ width: iconSize, height: iconSize }}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.tabLabel,
                { fontSize: isSmallPhone ? 9 : 10 },
                isActive && styles.activeTabLabel,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6D28D9',
    backgroundColor: 'rgba(6, 4, 26, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#A855F7',
    shadowOpacity: 0.3,
    shadowRadius: 9,
    elevation: 9,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabIconWrap: {
    borderWidth: 1,
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(86, 19, 216, 0.32)',
  },
  tabLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  activeTabLabel: {
    color: '#00E5FF',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
