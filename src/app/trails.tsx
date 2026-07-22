import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MissionBottomTabBar } from '@/components/mission-bottom-tab-bar';
import { TrailCard } from '@/components/trails/trail-card';
import { TrailFiltersView } from '@/components/trails/trail-filters';
import { TrailMapMarker } from '@/components/trails/trail-map-marker';
import { TrailSearchBar } from '@/components/trails/trail-search-bar';
import { TrailsEmptyState } from '@/components/trails/trails-empty-state';
import { TrailsLoadingState } from '@/components/trails/trails-loading-state';
import { MissionTrailColors as C } from '@/constants/theme';
import { useNearbyTrails } from '@/hooks/use-nearby-trails';
import { saveSelectedTrail } from '@/services/selected-trail-service';
import { startTrailActivity } from '@/services/trail-activity-service';
import type { Trail } from '@/types/trails';

let MapView: any = View;
let PROVIDER_GOOGLE: unknown = null;
if (Platform.OS !== 'web') {
  // react-native-maps is already installed and used by the Live Map screen.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

type ViewMode = 'list' | 'map';

// This screen coordinates trail search, filters, map markers, and navigation.
export default function TrailsScreen() {
  const router = useRouter();
  const safeArea = useSafeAreaInsets();
  const discovery = useNearbyTrails();
  const mapRef = useRef<any>(null);
  const shownLocationAlertRef = useRef<'denied' | 'services_off' | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);

  // Reuses the selected marker, or safely falls back to the first visible trail.
  const selectedTrail = useMemo(
    () => discovery.trails.find((trail) => trail.id === selectedTrailId) ?? discovery.trails[0],
    [discovery.trails, selectedTrailId],
  );

  // Moves the camera to a GPS fix or the temporary simulator preview area.
  // initialRegion only controls the first map render, so animation is required.
  useEffect(() => {
    if (Platform.OS === 'web' || viewMode !== 'map' || !discovery.locationCenter) return;
    mapRef.current?.animateToRegion({
      ...discovery.locationCenter,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 650);
  }, [discovery.locationCenter, viewMode]);

  // Retries GPS and alerts once only for physical-device permission settings.
  const findMyExactLocation = useCallback(async () => {
    setViewMode('map');
    const result = await discovery.refresh();
    if (result.kind === 'located') {
      shownLocationAlertRef.current = null;
      return;
    }
    if (
      discovery.isPhysicalDevice
      && (result.kind === 'denied' || result.kind === 'services_off')
      && shownLocationAlertRef.current !== result.kind
    ) {
      shownLocationAlertRef.current = result.kind;
      Alert.alert(
        result.kind === 'denied' ? 'Location permission needed' : 'Location Services are off',
        result.kind === 'denied'
          ? 'Allow foreground location for Mission Trails in Settings, then tap the location button again.'
          : 'Turn on Location Services in Settings, then tap the location button again.',
      );
    }
  }, [discovery]);

  // Saves the selected trail so the details screen can load its full typed data.
  const openTrail = useCallback(async (trail: Trail, section?: 'meetups') => {
    setSelectedTrailId(trail.id);
    await saveSelectedTrail(trail);
    router.push({ pathname: '/trail-details', params: { trailId: trail.id, section } } as never);
  }, [router]);

  // Starts a real tracked session, but leaves completion and XP to GPS verification.
  const startTrail = useCallback(async (trail: Trail) => {
    if (trail.status !== 'open' || !trail.publicAccess) {
      Alert.alert('Trail unavailable', 'This trail cannot be started while it is closed or restricted.');
      return;
    }
    let coordinate = discovery.isPhysicalDevice ? discovery.userLocation : null;
    if (!coordinate) {
      const result = await discovery.refresh();
      coordinate = result.kind === 'located' && result.isPhysicalDevice ? result.coordinate : null;
    }
    if (!coordinate) {
      Alert.alert('Location needed', 'Enable foreground location to start verified GPS trail tracking. You can still browse without it.');
      return;
    }
    // This handoff starts GPS tracking. It never grants XP or completes a mission.
    await startTrailActivity(trail, coordinate);
    router.replace('/home-backup');
  }, [discovery, router]);

  // Restores the complete trail list by clearing search text and active filters.
  const clearSearch = useCallback(() => {
    discovery.setQuery('');
    discovery.setFilters({ selected: [] });
  }, [discovery]);

  // Builds one optimized FlatList row and connects its buttons to screen actions.
  const renderTrail = useCallback(({ item }: { item: Trail }) => (
    <TrailCard
      trail={item}
      meetupCount={discovery.meetupCounts[item.id] ?? 0}
      favorite={discovery.favoriteIds.includes(item.id)}
      showDistance={discovery.locationStatus === 'granted'}
      selected={item.id === selectedTrailId}
      onSelect={() => setSelectedTrailId(item.id)}
      onViewDetails={() => void openTrail(item)}
      onStartTrail={() => void startTrail(item)}
      onViewMeetups={() => void openTrail(item, 'meetups')}
      onToggleFavorite={() => void discovery.toggleFavorite(item.id)}
    />
  ), [discovery, openTrail, selectedTrailId, startTrail]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: safeArea.top + 10 }]}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>MISSION TRAILS // DISCOVERY</Text>
            <Text style={styles.title}>Explore Trails</Text>
            <Text style={styles.subtitle}>Find your next real-world adventure</Text>
          </View>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </View>
        <TrailSearchBar
          value={discovery.query}
          onChangeText={discovery.setQuery}
          isLocating={discovery.isLoading}
          onUseLocation={() => void findMyExactLocation()}
        />
        <TrailFiltersView filters={discovery.filters} onChange={discovery.setFilters} />
      </View>

      {discovery.locationStatus === 'denied' || discovery.locationStatus === 'services_off' ? (
        <View style={styles.permissionBanner}>
          <Ionicons name="location-outline" size={18} color={C.warning} />
          <Text style={styles.permissionText}>
            {discovery.locationStatus === 'denied'
              ? 'Location denied. Browse the sample area or enable permission for nearby distances.'
              : 'Location services are off. Browse the sample area or turn location on.'}
          </Text>
        </View>
      ) : null}

      {discovery.error ? (
        <View style={styles.errorBanner}><Ionicons name="warning-outline" size={18} color={C.warning} /><Text style={styles.errorText}>{discovery.error}</Text></View>
      ) : null}

      {discovery.locationWarning ? (
        <View style={styles.locationWarningBanner}>
          <Ionicons name="navigate-outline" size={18} color={C.warning} />
          <Text style={styles.locationWarningText}>{discovery.locationWarning}</Text>
        </View>
      ) : null}

      {viewMode === 'list' ? (
        discovery.isLoading && discovery.trails.length === 0 ? <TrailsLoadingState /> : (
          <FlatList
            data={discovery.trails}
            keyExtractor={(trail) => trail.id}
            renderItem={renderTrail}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.list, { paddingBottom: safeArea.bottom + 112 }]}
            ListHeaderComponent={<View style={styles.resultsRow}><Text style={styles.resultsTitle}>{discovery.trails.length} trails found</Text><Text style={styles.resultsMeta}>{discovery.locationStatus === 'granted' ? 'Sorted by distance' : 'Sample area results'}</Text></View>}
            ListEmptyComponent={<TrailsEmptyState onClear={clearSearch} />}
          />
        )
      ) : (
        <View style={styles.mapWrap}>
          {Platform.OS === 'web' ? (
            <View style={styles.mapState}><Ionicons name="map-outline" size={34} color={C.cyan} /><Text style={styles.mapStateText}>Interactive trail markers are available on iOS and Android.</Text></View>
          ) : (
            <MapView
              ref={mapRef}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={StyleSheet.absoluteFill}
              initialRegion={{ ...discovery.searchCenter, latitudeDelta: 0.18, longitudeDelta: 0.18 }}
              showsUserLocation={discovery.locationStatus === 'granted'}
              showsMyLocationButton={false}
              userInterfaceStyle="dark"
              onRegionChangeComplete={(region: { latitude: number; longitude: number }) => discovery.setMapCenter({ latitude: region.latitude, longitude: region.longitude })}
            >
              {discovery.trails.map((trail) => <TrailMapMarker key={trail.id} trail={trail} selected={trail.id === selectedTrail?.id} onPress={() => setSelectedTrailId(trail.id)} />)}
            </MapView>
          )}

          {discovery.hasPendingAreaSearch ? (
            <Pressable accessibilityLabel="Search this map area" onPress={() => void discovery.searchThisArea()} style={styles.searchAreaButton}>
              <Ionicons name="search" size={16} color={C.text} /><Text style={styles.searchAreaText}>Search This Area</Text>
            </Pressable>
          ) : null}

          {selectedTrail ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`View ${selectedTrail.name}`} onPress={() => void openTrail(selectedTrail)} style={[styles.mapCard, { bottom: safeArea.bottom + 104 }]}>
              <View style={styles.mapCardCopy}><Text numberOfLines={1} style={styles.mapCardName}>{selectedTrail.name}</Text><Text style={styles.mapCardMeta}>{selectedTrail.lengthMiles.toFixed(1)} mi · {selectedTrail.estimatedDurationMinutes} min · {selectedTrail.difficulty}</Text></View>
              <Ionicons name="chevron-forward" size={21} color={C.cyan} />
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={[styles.bottomNavigation, { bottom: safeArea.bottom + 10 }]}>
        <MissionBottomTabBar activeTab="trails" />
      </View>
    </View>
  );
}

// This small control lets the student switch between list and map presentations.
function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <View style={styles.toggle} accessibilityLabel="Trail view selector">
      {(['list', 'map'] as const).map((option) => (
        <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: value === option }} accessibilityLabel={`${option} view`} onPress={() => onChange(option)} style={[styles.toggleButton, value === option && styles.toggleSelected]}>
          <Ionicons name={option === 'list' ? 'list' : 'map-outline'} size={18} color={value === option ? C.text : C.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  header: { backgroundColor: '#0E0618', borderBottomWidth: 1, borderBottomColor: '#2B173B' },
  headingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 },
  headingCopy: { flex: 1 },
  eyebrow: { color: C.magenta, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: C.text, fontSize: 28, fontWeight: '900', marginTop: 2 },
  subtitle: { color: C.textMuted, fontSize: 12, marginTop: 3 },
  toggle: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 3 },
  toggleButton: { width: 42, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggleSelected: { backgroundColor: '#702288', shadowColor: C.magenta, shadowOpacity: 0.35, shadowRadius: 6 },
  permissionBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#493523', backgroundColor: '#21180E', paddingHorizontal: 18, paddingVertical: 10 },
  permissionText: { flex: 1, color: '#F5D7A2', fontSize: 11, lineHeight: 16 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2B1420', paddingHorizontal: 18, paddingVertical: 9 },
  errorText: { flex: 1, color: '#FFD0DA', fontSize: 11 },
  locationWarningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#251B0C', borderBottomWidth: 1, borderBottomColor: '#594421', paddingHorizontal: 18, paddingVertical: 9 },
  locationWarningText: { flex: 1, color: '#FFE2A9', fontSize: 11, lineHeight: 16 },
  list: { paddingHorizontal: 16 },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 2 },
  resultsTitle: { color: C.text, fontSize: 13, fontWeight: '900' },
  resultsMeta: { color: C.textMuted, fontSize: 10 },
  mapWrap: { flex: 1, backgroundColor: '#10162B' },
  mapState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  mapStateText: { color: C.textMuted, textAlign: 'center', lineHeight: 19 },
  searchAreaButton: { position: 'absolute', top: 14, alignSelf: 'center', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, backgroundColor: '#722588', borderWidth: 1, borderColor: C.magenta, paddingHorizontal: 16 },
  searchAreaText: { color: C.text, fontSize: 12, fontWeight: '900' },
  mapCard: { position: 'absolute', left: 16, right: 16, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: C.cyan, backgroundColor: 'rgba(14,6,24,0.96)', paddingHorizontal: 16, shadowColor: C.cyan, shadowOpacity: 0.24, shadowRadius: 10 },
  mapCardCopy: { flex: 1 },
  mapCardName: { color: C.text, fontSize: 16, fontWeight: '900' },
  mapCardMeta: { color: C.textMuted, fontSize: 11, marginTop: 5, textTransform: 'capitalize' },
  bottomNavigation: { position: 'absolute', left: 12, right: 12, zIndex: 20 },
});
