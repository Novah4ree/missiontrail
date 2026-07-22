import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';

// This state reassures the user while trail and location data are loading.
export function TrailsLoadingState() {
  return <View style={styles.state}><ActivityIndicator color={C.cyan} size="large" /><Text style={styles.copy}>Scanning the trail grid…</Text></View>;
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, gap: 12 },
  copy: { color: C.textMuted, fontSize: 13 },
});
