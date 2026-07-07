import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
const items = [
  { title: "Cosmic Shard", rarity: "Legendary", color: "#ffd700", icon: require("../../assets/images/vaulticons/cosmicshard.png") },
  { title: "Nebula Crystal", rarity: "Epic", color: "#f000ff", icon: require("../../assets/images/vaulticons/nebulacrystal.png") },
  { title: "Star Fragment", rarity: "Rare", color: "#00d9ff", icon: require("../../assets/images/vaulticons/starfragment.png") },
  { title: "Undiscovered", rarity: "Unknown", color: "#4b345f", icon: require("../../assets/images/vaulticons/undiscovered.png") },
  { title: "Aurora Gem", rarity: "Epic", color: "#f000ff", icon: require("../../assets/images/vaulticons/auroragem.png") },
  { title: "Eclipse Orb", rarity: "Epic", color: "#5E4B8B", icon: require("../../assets/images/vaulticons/eclipseorb.png") },
];
export default function VaultScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
});