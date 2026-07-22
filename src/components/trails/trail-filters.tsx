import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';
import type { TrailFilterKey, TrailFilters } from '@/types/trails';

const options: { value: TrailFilterKey; label: string }[] = [
  { value: 'near_me', label: 'Near Me' },
  { value: 'walking', label: 'Walking' },
  { value: 'hiking', label: 'Hiking' },
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'challenging', label: 'Challenging' },
  { value: 'under_3', label: 'Under 3 Miles' },
  { value: '3_5', label: '3–5 Miles' },
  { value: '5_plus', label: '5+ Miles' },
  { value: 'accessible', label: 'Accessible' },
  { value: 'meetups_today', label: 'Meetups Today' },
];

// This row displays every available trail filter as a selectable chip.
export function TrailFiltersView({ filters, onChange }: {
  filters: TrailFilters;
  onChange: (filters: TrailFilters) => void;
}) {
  // Adds or removes one filter without changing the other selected filters.
  function toggleFilter(value: TrailFilterKey) {
    const selected = filters.selected.includes(value)
      ? filters.selected.filter((item) => item !== value)
      : [...filters.selected, value];
    onChange({ selected });
  }

  return (
    <ScrollView
      horizontal
      accessibilityLabel="Trail filters"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const selected = filters.selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Filter: ${option.label}`}
            onPress={() => toggleFilter(option.value)}
            style={({ pressed }) => [styles.chip, selected && styles.selectedChip, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
  chip: { minHeight: 42, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 14 },
  selectedChip: { borderColor: C.cyan, backgroundColor: '#123146', shadowColor: C.cyan, shadowOpacity: 0.24, shadowRadius: 7 },
  pressed: { opacity: 0.75 },
  label: { color: C.textMuted, fontSize: 12, fontWeight: '800' },
  selectedLabel: { color: C.text },
});
