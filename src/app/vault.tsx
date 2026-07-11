import { useRouter } from "expo-router";
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const bottomTabs = [
  { key: "home", label: "Home", image: tabImages.home, route: "/home-backup" },
  { key: "mission", label: "Mission", image: tabImages.mission, route: "/mission" },
  { key: "trails", label: "Trails", image: tabImages.trails, route: "/trails" },
  { key: "vault", label: "Vault", image: tabImages.vault, route: "/vault" },
  { key: "profile", label: "Profile", image: tabImages.profile, route: "/profile" },
  { key: "companion", label: "Compan...", image: tabImages.companion, route: "/companion" },
] as const;
const items = [
  { title: "Cosmic Shard", rarity: "Legendary", color: "#ffd700", icon: require("../../assets/images/vaulticons/cosmicshard.png") },
  { title: "Nebula Crystal", rarity: "Epic", color: "#f000ff", icon: require("../../assets/images/vaulticons/nebulacrystal.png") },
  { title: "Star Fragment", rarity: "Rare", color: "#00d9ff", icon: require("../../assets/images/vaulticons/starfragment.png") },
  { title: "Undiscovered", rarity: "Unknown", color: "#4b345f", icon: require("../../assets/images/vaulticons/undiscovered.png") },
  { title: "Aurora Gem", rarity: "Epic", color: "#f000ff", icon: require("../../assets/images/vaulticons/auroragem.png") },
  { title: "Eclipse Orb", rarity: "Epic", color: "#5E4B8B", icon: require("../../assets/images/vaulticons/eclipseorb.png") },
];

export default function VaultScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: safeArea.bottom + tabBarHeight + 40 },
        ]}
      >
        <Image
          source={require("../../assets/images/tabIcons/vault.png")}
          style={styles.vaultIcon}
        />

        <View style={styles.statsBox}>
          <Text style={styles.statTitle}>LEGENDARY VAULT</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>2</Text>
              <Text style={styles.statText}>Legendary</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>4/6</Text>
              <Text style={styles.statText}>Collection</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: "#00d9ff" }]}>1</Text>
              <Text style={styles.statText}>Rare</Text>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          {items.map((item, index) => (
            <View
              key={index}
              style={[
                styles.card,
                {
                  borderColor: item.color,
                  backgroundColor:
                    item.title === "Undiscovered"
                      ? "rgba(80,45,70,0.25)"
                      : "rgba(237,16,149,0.15)",
                },
              ]}>
              <View style={[styles.iconBox, { borderColor: item.color }]}>
                <Image source={item.icon} style={styles.itemIcon} />
               </View>

              <Text style={[styles.cardTitle, { color: item.color }]}>
                {item.title}
              </Text>

              {item.rarity !== "" && (
                <Text style={styles.cardRarity}>{item.rarity}</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.rankBox}>
          <View>
            <Text style={styles.rankTitle}>Collector Rank</Text>
            <Text style={styles.rankText}>Elite Explorer</Text>
          </View>

          <View>
            <Text style={styles.rankNumber}>#127</Text>
            <Text style={styles.rankText}>Global</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomOverlay, { bottom: safeArea.bottom + 10 }]}>
        <View style={styles.tabBar}>
          {bottomTabs.map((tab) => {
            const isActiveTab = tab.key === "vault";

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${tab.label}`}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070011",
  },

  scroll: {
    padding: 24,
    paddingTop: 55,
    paddingBottom: 40,
  },

  vaultIcon: {
  width: 84,
  height: 84,
  resizeMode: "contain",
  alignSelf: "center",
  marginTop: -10,
  marginBottom: 8,
 },

  statsBox: {
    borderWidth: 1,
    borderColor: "#4b345f",
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 20,
    padding: 18,
  },

  statTitle: {
    color: "#f000ff",
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 2,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },

  statItem: {
    alignItems: "center",
    flex: 1,
  },

  statNumber: {
    color: "#ffd700",
    fontSize: 18,
    fontWeight: "bold",
  },

  statText: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 6,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    width: "48%",
    height: 210,
    borderRadius: 24,
    borderWidth: 1.5,
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  icon: {
    fontSize: 28,
    textAlign: "center",
  },

  cardTitle: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 8,
  },

  cardRarity: {
    color: "#aaa",
    fontSize: 13,
    textAlign: "center",
  },

  rankBox: {
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#4b345f",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginTop: 70,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemIcon: {
  width: 52,
  height: 52,
  resizeMode: "contain",
},

  rankTitle: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 6,
  },

  rankNumber: {
    color: "#ffd700",
    fontSize: 24,
    textAlign: "right",
  },

  rankText: {
    color: "#aaa",
    fontSize: 13,
  },

  bottomOverlay: {
    position: "absolute",
    left: sidePadding,
    right: sidePadding,
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
