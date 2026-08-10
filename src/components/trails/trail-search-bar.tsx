import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';

// This search bar filters public places and offers a separate current-location action.
// Important note: Displays the trail search bar UI.
export function TrailSearchBar({ value, onChangeText, onUseLocation, onSubmitSearch, isLocating = false }: {
  value: string;
  onChangeText: (value: string) => void;
  onUseLocation: () => void;
  onSubmitSearch?: () => void;
  isLocating?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={C.textMuted} />
        <TextInput
          accessibilityLabel="Search trails, parks, or a US ZIP code"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder="Trails, parks, or ZIP"
          placeholderTextColor="#796B86"
          returnKeyType="search"
          onSubmitEditing={() => onSubmitSearch?.()}
          style={styles.input}
          value={value}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
            onPress={() => onChangeText('')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="close-circle" size={19} color={C.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isLocating ? 'Locating...' : 'Find and center on my exact location'}
        disabled={isLocating}
        onPress={onUseLocation}
        style={({ pressed }) => [styles.locationButton, isLocating && styles.disabled, pressed && styles.pressed]}
      >
        {isLocating
          ? <><ActivityIndicator color={C.cyan} /><Text style={styles.locatingText}>Locating...</Text></>
          : <Ionicons name="locate" size={21} color={C.cyan} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 15 },
  inputWrap: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 13 },
  input: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 12 },
  locationButton: { minWidth: 48, minHeight: 48, flexDirection: 'row', borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.cyan, backgroundColor: '#102436', paddingHorizontal: 8 },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.72 },
  locatingText: { color: C.cyan, fontSize: 10, fontWeight: '800', marginLeft: 4 },
});
