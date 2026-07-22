import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';

// This search bar filters public places and offers a separate current-location action.
export function TrailSearchBar({ value, onChangeText, onUseLocation, isLocating = false }: {
  value: string;
  onChangeText: (value: string) => void;
  onUseLocation: () => void;
  isLocating?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={C.textMuted} />
        <TextInput
          accessibilityLabel="Search trails, parks, or cities"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder="Trails, parks, or cities"
          placeholderTextColor="#796B86"
          returnKeyType="search"
          style={styles.input}
          value={value}
        />
        {value ? <Pressable accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChangeText('')}><Ionicons name="close-circle" size={19} color={C.textMuted} /></Pressable> : null}
      </View>
      <Pressable accessibilityLabel="Find and center on my exact location" disabled={isLocating} onPress={onUseLocation} style={[styles.locationButton, isLocating && styles.disabled]}>
        {isLocating
          ? <ActivityIndicator color={C.cyan} />
          : <Ionicons name="locate" size={21} color={C.cyan} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 15 },
  inputWrap: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 13 },
  input: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 12 },
  locationButton: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cyan, backgroundColor: '#102436' },
  disabled: { opacity: 0.65 },
});
