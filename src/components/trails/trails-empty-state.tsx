import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';

// This state explains that no results matched and offers a quick reset action.
export function TrailsEmptyState({ onClear }: { onClear: () => void }) {
  return <View style={styles.state}><Ionicons name="trail-sign-outline" size={35} color={C.purple} /><Text style={styles.title}>No trails match yet</Text><Text style={styles.copy}>Try another city, clear a filter, or use your current area.</Text><Pressable onPress={onClear} style={styles.button} accessibilityLabel="Clear trail search and filters"><Text style={styles.buttonText}>Clear Filters</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 48 },
  title: { color: C.text, fontSize: 18, fontWeight: '900', marginTop: 12 },
  copy: { color: C.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  button: { minHeight: 44, justifyContent: 'center', borderRadius: 999, backgroundColor: '#69227E', paddingHorizontal: 20, marginTop: 18 },
  buttonText: { color: C.text, fontWeight: '900' },
});
