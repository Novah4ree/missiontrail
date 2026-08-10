import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';
import type { TrailFilterKey, TrailFilters } from '@/types/trails';

const options: { value: TrailFilterKey; label: string }[] = [
  { value: 'near_me', label: 'Near Me' },
  { value: 'parks', label: 'Parks' },
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
// Important note: Displays the trail filters view UI.
export function TrailFiltersView({ filters, onChange }: {
  filters: TrailFilters;
  onChange: (filters: TrailFilters) => void;
}) {
  // Activity, difficulty, and length are alternative choices within their own
  // groups; parks, accessibility, and meetups can be combined with them.
  function toggleFilter(value: TrailFilterKey) {
    if (value === 'near_me') {
      const selected: TrailFilterKey[] = filters.selected.includes('near_me')
        ? filters.selected.filter((item) => item !== 'near_me')
        : [...filters.selected, 'near_me'];
      onChange({ selected });
      return;
    }
    const exclusiveGroups: TrailFilterKey[][] = [
      ['walking', 'hiking'],
      ['easy', 'moderate', 'challenging'],
      ['under_3', '3_5', '5_plus'],
    ];
    const group = exclusiveGroups.find((items) => items.includes(value));
    const selected = filters.selected.includes(value)
      ? filters.selected.filter((item) => item !== value)
      : [...filters.selected.filter((item) => !group?.includes(item)), value];
    onChange({ selected });
  }

  return (
    <ScrollView
      horizontal
      accessibilityLabel="Trail filters"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: filters.selected.length === 0 }}
        accessibilityLabel="Filter: All Trails"
        onPress={() => onChange({ selected: [] })}
        style={({ pressed }) => [
          styles.chip,
          filters.selected.length === 0 && styles.selectedChip,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.label, filters.selected.length === 0 && styles.selectedLabel]}>
          All Trails
        </Text>
      </Pressable>
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
