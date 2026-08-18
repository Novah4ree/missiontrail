import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MissionTrailColors as C } from '@/constants/theme';

// This state distinguishes missing GPS from a nearby search with no matches.
// Purpose: Renders the trails empty state interface.
export function TrailsEmptyState({
  locationRequired,
  isRefreshing,
  onClear,
  onRefresh,
  onUseLocation,
  onViewMap,
}: {
  locationRequired: boolean;
  isRefreshing: boolean;
  onClear: () => void;
  onRefresh: () => void;
  onUseLocation: () => void;
  onViewMap: () => void;
}) {
  return (
    <View style={styles.state}>
      <Ionicons name={locationRequired ? 'location-outline' : 'trail-sign-outline'} size={35} color={C.purple} />
      <Text style={styles.title}>
        {locationRequired ? 'Find trails near you' : 'No trails or parks were found within this search area.'}
      </Text>
      <Text style={styles.copy}>
        {locationRequired
          ? 'Use your location to show only trails within 25 miles.'
          : 'Clear active filters, refresh your location, or inspect the current search area on the map.'}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={isRefreshing}
          onPress={locationRequired ? onUseLocation : onClear}
          style={({ pressed }) => [styles.button, isRefreshing && styles.disabled, pressed && styles.pressed]}
          accessibilityLabel={locationRequired ? 'Use my location' : 'Clear trail search and filters'}
        >
          <Text style={styles.buttonText}>{locationRequired ? 'Use My Location' : 'Clear Filters'}</Text>
        </Pressable>
        {!locationRequired ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={isRefreshing}
              onPress={onRefresh}
              style={({ pressed }) => [styles.secondaryButton, isRefreshing && styles.disabled, pressed && styles.pressed]}
              accessibilityLabel="Refresh current location and nearby trails"
            >
              <Text style={styles.buttonText}>{isRefreshing ? 'Refreshing…' : 'Refresh Location'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onViewMap}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              accessibilityLabel="View the nearby search area on the map"
            >
              <Text style={styles.buttonText}>View Map</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 48 },
  title: { color: C.text, fontSize: 18, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  copy: { color: C.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  actions: { alignItems: 'center', gap: 10, marginTop: 18 },
  button: { minHeight: 44, justifyContent: 'center', borderRadius: 999, backgroundColor: '#69227E', paddingHorizontal: 20 },
  secondaryButton: { minHeight: 44, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 20 },
  buttonText: { color: C.text, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
});
