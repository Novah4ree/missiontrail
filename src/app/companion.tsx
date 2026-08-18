import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MissionBottomTabBar } from '@/components/mission-bottom-tab-bar';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import {
  clampPercent,
  formatCompanionName,
  getEnergyPercent,
} from '@/utils/companion-progress';

const companionImage = require('../../assets/images/tabIcons/companion.png');

// Purpose: Renders the companion screen interface.
export default function CompanionScreen() {
  const safeArea = useSafeAreaInsets();
  const { progress, isLoading, message } = useDailyProgress();
  const companion = progress?.companion;
  const companionName = formatCompanionName(companion?.companionId);

  return (
    <LinearGradient colors={['#05000c', '#160628', '#05000c']} style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingTop: safeArea.top + 20, paddingBottom: safeArea.bottom + 122 },
        ]}
      >
        <Text style={styles.eyebrow}>ACTIVE COMPANION</Text>
        <Text style={styles.title}>Companion Link</Text>

        {isLoading && !companion ? (
          <View style={styles.stateCard}>
            <Text selectable style={styles.stateText}>Loading companion link…</Text>
          </View>
        ) : !companion?.companionId ? (
          <View style={styles.stateCard}>
            <Ionicons name="sparkles-outline" size={30} color="#8f8499" />
            <Text selectable style={styles.stateText}>No active companion selected.</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Image source={companionImage} resizeMode="contain" style={styles.companionImage} />
              <Text selectable style={styles.name}>{companionName}</Text>
              <Text selectable style={styles.tier}>Bond Tier {companion.bondTier}</Text>
            </View>

            <CompanionMeter
              color="#ff2df7"
              icon="heart"
              label="Bond"
              value={clampPercent(companion.bondPercent)}
              detail={`${companion.bondPoints.toLocaleString()} total Bond points`}
            />
            <CompanionMeter
              color="#00d9ff"
              icon="flash"
              label="Energy"
              value={getEnergyPercent(companion.energy, companion.maximumEnergy)}
              detail={`${companion.energy} of ${companion.maximumEnergy} energy`}
            />

            <View style={styles.rulesCard}>
              <Text style={styles.rulesTitle}>VERIFIED REWARDS</Text>
              <Text selectable style={styles.rulesText}>
                Claiming a verified mission adds Bond and restores Energy once. Ordinary phone movement does not drain Energy.
              </Text>
            </View>
          </>
        )}

        {message ? <Text selectable style={styles.errorText}>{message}</Text> : null}
      </ScrollView>

      <View style={[styles.bottomNavigation, { bottom: safeArea.bottom + 10 }]}>
        <MissionBottomTabBar activeTab="companion" />
      </View>
    </LinearGradient>
  );
}

// Purpose: Renders the companion meter interface.
function CompanionMeter({
  color,
  icon,
  label,
  value,
  detail,
}: {
  color: string;
  icon: 'heart' | 'flash';
  label: string;
  value: number;
  detail: string;
}) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${safeValue} percent`}
      accessibilityValue={{ min: 0, max: 100, now: safeValue }}
      style={styles.meterCard}
    >
      <View style={styles.meterHeader}>
        <View style={styles.meterLabel}>
          <Ionicons name={icon} size={19} color={color} />
          <Text style={styles.meterTitle}>{label}</Text>
        </View>
        <Text selectable style={[styles.meterValue, { color }]}>{safeValue}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safeValue}%`, backgroundColor: color }]} />
      </View>
      <Text selectable style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 14 },
  eyebrow: { color: '#ff2df7', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900' },
  stateCard: { minHeight: 180, borderRadius: 20, borderWidth: 1, borderColor: '#3d1550', backgroundColor: 'rgba(9,0,18,0.85)', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  stateText: { color: '#cfc3d7', fontSize: 15, textAlign: 'center' },
  heroCard: { borderRadius: 22, borderWidth: 1, borderColor: '#7e168f', backgroundColor: 'rgba(20,0,32,0.86)', alignItems: 'center', padding: 20 },
  companionImage: { width: 150, height: 150 },
  name: { color: '#fff', fontSize: 25, fontWeight: '900' },
  tier: { color: '#68e7ff', fontSize: 12, fontWeight: '800', marginTop: 4 },
  meterCard: { borderRadius: 18, borderWidth: 1, borderColor: '#3d1550', backgroundColor: 'rgba(9,0,18,0.88)', padding: 16, gap: 10 },
  meterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meterTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  meterValue: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  track: { height: 9, borderRadius: 99, overflow: 'hidden', backgroundColor: '#2a1735' },
  fill: { height: '100%', borderRadius: 99 },
  detail: { color: '#a99bb5', fontSize: 11 },
  rulesCard: { borderRadius: 16, borderWidth: 1, borderColor: '#28465a', backgroundColor: 'rgba(8,26,39,0.8)', padding: 15, gap: 7 },
  rulesTitle: { color: '#68e7ff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  rulesText: { color: '#d2e9ef', fontSize: 12, lineHeight: 18 },
  errorText: { color: '#ffc46b', fontSize: 12, lineHeight: 17 },
  bottomNavigation: { position: 'absolute', left: 12, right: 12, zIndex: 20 },
});
