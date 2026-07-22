import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';

import type { Trail } from '@/types/trails';

let Marker: any = View;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Marker = require('react-native-maps').Marker;
}

// This component draws one public trail location as a selectable map marker.
export function TrailMapMarker({ trail, selected, onPress }: {
  trail: Trail;
  selected: boolean;
  onPress: () => void;
}) {
  if (Platform.OS === 'web') return null;
  return (
    <Marker coordinate={{ latitude: trail.latitude, longitude: trail.longitude }} onPress={onPress} title={trail.name}>
      <View style={[styles.marker, selected && styles.selected]}>
        <Ionicons name={trail.category === 'park' ? 'leaf' : 'trail-sign'} size={16} color="#FFFFFF" />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  marker: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#7E168F', alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#008FB3', transform: [{ scale: 1.18 }] },
});
