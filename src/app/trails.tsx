import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapView, PROVIDER_GOOGLE } from '@/components/maps/map-components';
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
import type { Trail } from '@/types/trails';

type ViewMode = 'list' | 'map';

// This screen coordinates trail search, filters, map markers, and navigation.
export default function TrailsScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const safeArea = useSafeAreaInsets();
  const discovery = useNearbyTrails();
  const mapRef = useRef<any>(null);
  const shownLocationAlertRef = useRef<'denied' | 'services_off' | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const isBusy = discovery.isLoading || discovery.isRefreshing;

  // Reuses the selected marker, or safely falls back to the first visible trail.
  const selectedTrail = useMemo(
    () => discovery.trails.find((trail) => trail.id === selectedTrailId) ?? discovery.trails[0],
    [discovery.trails, selectedTrailId],
  );

  // Mission's explore action asks this screen to highlight the first GPS-sorted trail.
  useEffect(() => {
    const nearestTrail = discovery.trails[0];
    if (focus !== 'nearest' || discovery.locationStatus !== 'granted' || !nearestTrail) return;
    setSelectedTrailId((currentTrailId) => currentTrailId ?? nearestTrail.id);
  }, [discovery.locationStatus, discovery.trails, focus]);

  // Moves the camera to a valid device or simulator GPS fix.
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
    const result = await discovery.refresh(true);
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
    try {
      setSelectedTrailId(trail.id);
      await saveSelectedTrail(trail);
      router.push({ pathname: '/trail-details', params: { trailId: trail.id, section } } as never);
    } catch (navigationError) {
      if (__DEV__) console.warn('[Trails] Trail details navigation failed:', navigationError);
      Alert.alert('Unable to open trail', 'The trail details could not be opened. Please try again.');
    }
  }, [router]);

  // Restores the complete trail list by clearing search text and active filters.
  const clearSearch = useCallback(() => {
    discovery.setQuery('');
    discovery.setFilters({ selected: [] });
  }, [discovery]);

  const openLocationSettings = useCallback(() => {
    void Linking.openSettings().catch((settingsError) => {
      if (__DEV__) console.warn('[Trails] Device settings could not be opened:', settingsError);
      Alert.alert('Settings unavailable', 'Open your device Settings and enable location for Mission Trails.');
    });
  }, []);

  const toggleFavorite = useCallback(async (trail: Trail) => {
    try {
      await discovery.toggleFavorite(trail.id);
    } catch (favoriteError) {
      if (__DEV__) console.warn('[Trails] Favorite update failed:', favoriteError);
      Alert.alert('Could not update saved trails', 'Your previous saved state was restored. Please try again.');
    }
  }, [discovery]);

  // Builds one optimized FlatList row and connects its buttons to screen actions.
  const renderTrail = useCallback(({ item }: { item: Trail }) => (
    <TrailCard
      trail={item}
      meetupCount={discovery.meetupCounts[item.id] ?? 0}
      favorite={discovery.favoriteIds.includes(item.id)}
      favoriteBusy={discovery.favoriteBusyIds.includes(item.id)}
      showDistance={discovery.locationStatus === 'granted'}
      selected={item.id === selectedTrailId}
      onSelect={() => void openTrail(item)}
      onViewDetails={() => void openTrail(item)}
      onStartTrail={() => void openTrail(item)}
      onViewMeetups={() => void openTrail(item, 'meetups')}
      onToggleFavorite={() => void toggleFavorite(item)}
    />
  ), [discovery, openTrail, selectedTrailId, toggleFavorite]);

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
          isLocating={isBusy}
          onUseLocation={() => void findMyExactLocation()}
        />
        <TrailFiltersView filters={discovery.filters} onChange={discovery.setFilters} />
      </View>

      {discovery.locationStatus === 'denied' || discovery.locationStatus === 'services_off' ? (
        <View style={styles.permissionBanner}>
          <Ionicons name="location-outline" size={18} color={C.warning} />
          <Text style={styles.permissionText}>
            {discovery.locationStatus === 'denied'
              ? 'Location denied. Enable permission to see trails within 25 miles of you.'
              : 'Location Services are off. Turn them on to see trails within 25 miles of you.'}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Open location settings" onPress={openLocationSettings} style={({ pressed }) => [styles.bannerButton, pressed && styles.pressed]}>
            <Text style={styles.bannerButtonText}>Settings</Text>
          </Pressable>
        </View>
      ) : null}

      {discovery.error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={18} color={C.warning} />
          <Text style={styles.errorText}>{discovery.error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading nearby trails again"
            disabled={isBusy}
            onPress={() => void discovery.refresh(true)}
            style={({ pressed }) => [styles.bannerButton, isBusy && styles.disabled, pressed && styles.pressed]}
          >
            {isBusy ? <ActivityIndicator size="small" color={C.warning} /> : <Text style={styles.bannerButtonText}>Try Again</Text>}
          </Pressable>
        </View>
      ) : null}

      {discovery.locationWarning ? (
        <View style={styles.locationWarningBanner}>
          <Ionicons name="navigate-outline" size={18} color={C.warning} />
          <Text style={styles.locationWarningText}>{discovery.locationWarning}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try finding my location again"
            disabled={isBusy}
            onPress={() => void discovery.refresh(true)}
            style={({ pressed }) => [styles.bannerButton, isBusy && styles.disabled, pressed && styles.pressed]}
          >
            {isBusy ? <ActivityIndicator size="small" color={C.warning} /> : <Text style={styles.bannerButtonText}>Try Again</Text>}
          </Pressable>
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
            refreshing={discovery.isRefreshing}
            onRefresh={() => void discovery.refresh(true)}
            contentContainerStyle={[styles.list, { paddingBottom: safeArea.bottom + 112 }]}
            ListHeaderComponent={<View style={styles.resultsRow}><Text style={styles.resultsTitle}>{discovery.trails.length} trails found</Text><Text style={styles.resultsMeta}>{discovery.locationStatus === 'granted' ? 'Within 25 mi · nearest first' : 'Location required'}</Text></View>}
            ListEmptyComponent={discovery.error ? null : (
              <TrailsEmptyState
                locationRequired={discovery.locationStatus !== 'granted'}
                isRefreshing={discovery.isRefreshing}
                onClear={clearSearch}
                onRefresh={() => void discovery.refresh(true)}
                onUseLocation={() => void findMyExactLocation()}
                onViewMap={() => setViewMode('map')}
              />
            )}
          />
        )
      ) : (
        <View style={styles.mapWrap}>
          {Platform.OS === 'web' ? (
            <View style={styles.mapState}><Ionicons name="map-outline" size={34} color={C.cyan} /><Text style={styles.mapStateText}>Interactive trail markers are available on iOS and Android.</Text></View>
          ) : !discovery.locationCenter ? (
            <View style={styles.mapState}><Ionicons name="location-outline" size={34} color={C.cyan} /><Text style={styles.mapStateText}>Your location is needed to display nearby trail markers.</Text></View>
          ) : (
            <MapView
              ref={mapRef}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={StyleSheet.absoluteFill}
              initialRegion={{ ...discovery.locationCenter, latitudeDelta: 0.18, longitudeDelta: 0.18 }}
              showsUserLocation={discovery.locationStatus === 'granted'}
              showsMyLocationButton={false}
              userInterfaceStyle="dark"
              onRegionChangeComplete={(region: { latitude: number; longitude: number }) => discovery.setMapCenter({ latitude: region.latitude, longitude: region.longitude })}
            >
              {discovery.trails.map((trail) => <TrailMapMarker key={trail.id} trail={trail} selected={trail.id === selectedTrail?.id} onPress={() => setSelectedTrailId(trail.id)} />)}
            </MapView>
          )}

          {discovery.hasPendingAreaSearch ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Return map to my nearby trail area" disabled={isBusy} onPress={() => void discovery.searchThisArea()} style={({ pressed }) => [styles.searchAreaButton, isBusy && styles.disabled, pressed && styles.pressed]}>
              <Ionicons name="locate" size={16} color={C.text} /><Text style={styles.searchAreaText}>Return to My Area</Text>
            </Pressable>
          ) : null}

          {selectedTrail ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`View ${selectedTrail.name}`} onPress={() => void openTrail(selectedTrail)} style={[styles.mapCard, { bottom: safeArea.bottom + 104 }]}>
              <View style={styles.mapCardCopy}>
                <Text numberOfLines={1} style={styles.mapCardName}>{selectedTrail.name}</Text>
                <Text style={styles.mapCardMeta}>
                  {selectedTrail.distanceMiles.toFixed(1)} mi away · {selectedTrail.difficulty}
                </Text>
              </View>
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
        <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: value === option }} accessibilityLabel={`${option} view`} onPress={() => onChange(option)} style={({ pressed }) => [styles.toggleButton, value === option && styles.toggleSelected, pressed && styles.pressed]}>
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
  bannerButton: { minHeight: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.warning, paddingHorizontal: 12 },
  bannerButtonText: { color: C.text, fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
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
