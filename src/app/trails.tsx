import { useRouter } from 'expo-router';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const tabs = [
  { key: 'home-backup', label: 'Home' },
  { key: 'profile', label: 'Profile' },
  { key: 'map', label: 'Map' },
  { key: 'mission', label: 'Mission' },
  { key: 'trails', label: 'Trails' },
  { key: 'vault', label: 'Vault' },
  { key: 'companion', label: 'Companion' },
];
const screen = Dimensions.get("window");
const isSmallPhone = screen.height < 740 || screen.width < 380;
const sidePadding = isSmallPhone ? 9 : 12;
const tabBarHeight = isSmallPhone ? 72 : 82;

const tabImages = {
  home: require("../../assets/images/tabIcons/homemain.png"),
  mission: require("../../assets/images/tabIcons/mission.png"),
  trails: require("../../assets/images/tabIcons/trails.png"),
  vault: require("../../assets/images/tabIcons/vault.png"),
  profile: require("../../assets/images/tabIcons/profile.png"),
  companion: require("../../assets/images/tabIcons/companion.png"),
};
type BottomTabNavigatorProps = {
  activeTab: string;
};

export default function BottomTabNavigator({ activeTab }: BottomTabNavigatorProps) {
  const router = useRouter();

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActiveTab = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, isActiveTab && styles.activeTabItem]}
            onPress={() => {
              if (tab.key === 'home-backup') router.push('/home-backup');
              if (tab.key === 'profile') router.push('/profile');
              if (tab.key === 'mission') router.push('/mission');
              if (tab.key === 'trails') router.push('/trails');
              if (tab.key === 'vault') router.push('/vault');
              if (tab.key === 'companion') router.push('/companion');
            }}
          >
            <Text style={[styles.tabLabel, isActiveTab && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  
  tabItem: {
    alignItems: 'center',
  },
  activeTabItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },

  tabBar: {
    minHeight: tabBarHeight,
    maxHeight: tabBarHeight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#6d28d9",
    backgroundColor: "rgba(6, 4, 26, 0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: "#a855f7",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 9,
  },

  tabButton: {
    flex: 1,
    minWidth: 0,
    height: tabBarHeight - 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  tabIconWrap: {
    width: isSmallPhone ? 38 : 44,
    height: isSmallPhone ? 38 : 44,
    borderRadius: isSmallPhone ? 19 : 22,
    alignItems: "center",
    justifyContent: "center",
  },

  activeTabIconWrap: {
    borderWidth: 1,
    borderColor: "#00e5ff",
    backgroundColor: "rgba(86, 19, 216, 0.32)",
  },

  tabIcon: {
    width: isSmallPhone ? 61 : 56,
    height: isSmallPhone ? 61 : 56,
  },

  tabLabel: {
    color: "#ffffff",
    fontSize: isSmallPhone ? 9 : 10,
    fontWeight: "800",
  },

  activeTabLabel: {
    color: "#00e5ff",
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});

