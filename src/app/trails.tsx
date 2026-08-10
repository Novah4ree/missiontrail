import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Circle, MapView, Marker, PROVIDER_GOOGLE } from '@/components/maps/map-components';
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
import { formatDistanceMiles } from '@/utils/distance';
import { getTrailAreaSummary } from '@/utils/nearby-location-policy';

type ViewMode = 'list' | 'map';

const GPS_MAP_DELTA = 0.02;
const ZIP_MAP_DELTA = 0.2;

// This screen coordinates trail search, filters, map markers, and navigation.
// note: Builds and controls the trails screen.
export default function TrailsScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const safeArea = useSafeAreaInsets();
  const discovery = useNearbyTrails();
  const mapRef = useRef<any>(null);
  const shownLocationAlertRef = useRef<'denied' | 'services_off' | null>(null);
  const intentionalCameraCoordinateRef = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const isCatalogBusy = discovery.isLoadingCatalog
    || discovery.isRefreshingCatalog
    || discovery.isSearchingZip;
  const activeCoordinate = useMemo(
    () => discovery.activeLocation
      ? { latitude: discovery.activeLocation.latitude, longitude: discovery.activeLocation.longitude }
      : null,
    [discovery.activeLocation],
  );
  const currentGpsCoordinate = useMemo(
    () => discovery.currentUserLocation
      ? { latitude: discovery.currentUserLocation.latitude, longitude: discovery.currentUserLocation.longitude }
      : null,
    [discovery.currentUserLocation],
  );
  const gpsAccuracyMeters = Number.isFinite(discovery.currentUserLocation?.accuracy)
    && (discovery.currentUserLocation?.accuracy ?? 0) > 0
    ? discovery.currentUserLocation?.accuracy ?? null
    : null;
  const activeMapDelta = discovery.locationSource === 'gps' ? GPS_MAP_DELTA : ZIP_MAP_DELTA;
  const areaSummary = getTrailAreaSummary({
    source: discovery.locationSource,
    areaLabel: discovery.areaLabel,
    zipCode: discovery.activeLocation?.source === 'zip'
      ? discovery.activeLocation.zipCode
      : undefined,
  });

  // Shows the first result only before a selection exists. A stale selected ID
  // never silently changes identity to a different trail.
  const selectedTrail = useMemo(
    () => selectedTrailId
      ? discovery.trails.find((trail) => trail.id === selectedTrailId) ?? null
      : discovery.trails[0] ?? null,
    [discovery.trails, selectedTrailId],
  );

  // Mission's explore action asks this screen to highlight the first GPS-sorted trail.
  useEffect(() => {
    const nearestTrail = discovery.trails[0];
    if (focus !== 'nearest' || discovery.locationSource !== 'gps' || !nearestTrail) return;
    setSelectedTrailId((currentTrailId) => currentTrailId ?? nearestTrail.id);
  }, [discovery.locationSource, discovery.trails, focus]);

  // initialRegion only controls the first map render, so every active-location
  // search change also gets an explicit camera update. Passive GPS watcher
  // updates only move the user marker and do not pull the camera.
  useEffect(() => {
    if (Platform.OS === 'web' || viewMode !== 'map' || !activeCoordinate) return;
    const coordinateKey = `${activeCoordinate.latitude}:${activeCoordinate.longitude}`;
    if (intentionalCameraCoordinateRef.current !== coordinateKey) return;
    intentionalCameraCoordinateRef.current = null;
    mapRef.current?.animateToRegion({
      ...activeCoordinate,
      latitudeDelta: activeMapDelta,
      longitudeDelta: activeMapDelta,
    }, 650);
  }, [activeCoordinate, activeMapDelta, viewMode]);

  // A list selection can intentionally switch to the map and center the
  // selected destination without changing the underlying nearby result set.
  useEffect(() => {
    if (Platform.OS === 'web' || viewMode !== 'map' || !selectedTrailId || !selectedTrail) return;
    mapRef.current?.animateToRegion({
      latitude: selectedTrail.latitude,
      longitude: selectedTrail.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }, 450);
  }, [selectedTrail, selectedTrailId, viewMode]);

  // Retries GPS and alerts once only for physical-device permission settings.
  // note: Finds my exact location.
  const findMyExactLocation = useCallback(async () => {
    // "Near Me" is deliberately an unfiltered map search: it should reveal
    // every nearby trail and park, not only a previous category or text match.
    discovery.setQuery('');
    discovery.setFilters({ selected: ['near_me'] });
    setSearchInput('');
    setSelectedTrailId(null);
    setViewMode('map');
    intentionalCameraCoordinateRef.current = 'pending-gps';
    const result = await discovery.useMyLocation(true);
    if (result.kind === 'located') {
      intentionalCameraCoordinateRef.current = `${result.coordinate.latitude}:${result.coordinate.longitude}`;
      shownLocationAlertRef.current = null;
      mapRef.current?.animateToRegion({
        ...result.coordinate,
        latitudeDelta: GPS_MAP_DELTA,
        longitudeDelta: GPS_MAP_DELTA,
      }, 650);
      return;
    }
    if (
      (result.kind === 'denied' || result.kind === 'services_off')
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

  const recenterMap = useCallback(() => {
    if (!currentGpsCoordinate) return;
    if (__DEV__) console.info('[GPS] Manual recenter', currentGpsCoordinate);
    discovery.setMapCameraLocation(currentGpsCoordinate);
    mapRef.current?.animateToRegion({
      ...currentGpsCoordinate,
      latitudeDelta: GPS_MAP_DELTA,
      longitudeDelta: GPS_MAP_DELTA,
    }, 450);
  }, [currentGpsCoordinate, discovery.setMapCameraLocation]);

  // Saves the selected trail so the details screen can load its full typed data.
  // important note: Opens trail.
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
  // important note: Clears the current trail search.
  const clearSearch = useCallback(() => {
    discovery.setQuery('');
    discovery.setFilters({ selected: [] });
    setSearchInput('');
  }, [discovery]);

  const changeSearchText = useCallback((value: string) => {
    setSearchInput(value);
    discovery.setQuery(value);
  }, [discovery]);

  const searchCityOrArea = useCallback(async () => {
    const location = await discovery.searchLocation(searchInput);
    if (!location) return;
    intentionalCameraCoordinateRef.current = `${location.latitude}:${location.longitude}`;
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: ZIP_MAP_DELTA,
      longitudeDelta: ZIP_MAP_DELTA,
    }, 650);
    // The city lookup determines the search center; it is not also treated as
    // a trail-name filter that could hide all of the nearby results.
    discovery.setQuery('');
    setSelectedTrailId(null);
    setViewMode('map');
  }, [discovery, searchInput]);

  const showTrailOnMap = useCallback((trail: Trail) => {
    setSelectedTrailId(trail.id);
    setViewMode('map');
  }, []);

  // important note: Opens location settings.
  const openLocationSettings = useCallback(() => {
    void Linking.openSettings().catch((settingsError) => {
      if (__DEV__) console.warn('[Trails] Device settings could not be opened:', settingsError);
      Alert.alert('Settings unavailable', 'Open your device Settings and enable location for Mission Trails.');
    });
  }, []);

  // important note: Switches favorite on or off.
  const toggleFavorite = useCallback(async (trail: Trail) => {
    try {
      await discovery.toggleFavorite(trail.id);
    } catch (favoriteError) {
      if (__DEV__) console.warn('[Trails] Favorite update failed:', favoriteError);
      Alert.alert('Could not update saved trails', 'Your previous saved state was restored. Please try again.');
    }
  }, [discovery]);

  // Builds one optimized FlatList row and connects its buttons to screen actions.
  // important note: Builds the trail UI.
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
      onViewOnMap={() => showTrailOnMap(item)}
      onToggleFavorite={() => void toggleFavorite(item)}
    />
  ), [discovery, openTrail, selectedTrailId, showTrailOnMap, toggleFavorite]);

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
          value={searchInput}
          onChangeText={changeSearchText}
          onSubmitSearch={() => void searchCityOrArea()}
          isLocating={discovery.isLocating}
          onUseLocation={() => void findMyExactLocation()}
        />
        <TrailFiltersView
          filters={discovery.filters}
          onChange={discovery.setFilters}
        />
      </View>

      {discovery.locationStatus === 'denied' || discovery.locationStatus === 'services_off' ? (
        <View style={styles.permissionBanner}>
          <Ionicons name="location-outline" size={18} color={C.warning} />
          <Text style={styles.permissionText}>
            {discovery.locationStatus === 'denied'
              ? 'Location access is off. Turn on location access to find trails near you.'
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
            disabled={isCatalogBusy}
            onPress={() => void discovery.refresh(true)}
            style={({ pressed }) => [styles.bannerButton, isCatalogBusy && styles.disabled, pressed && styles.pressed]}
          >
            {isCatalogBusy ? <ActivityIndicator size="small" color={C.warning} /> : <Text style={styles.bannerButtonText}>Try Again</Text>}
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
            disabled={isCatalogBusy}
            onPress={() => void discovery.refresh(true)}
            style={({ pressed }) => [styles.bannerButton, isCatalogBusy && styles.disabled, pressed && styles.pressed]}
          >
            {isCatalogBusy ? <ActivityIndicator size="small" color={C.warning} /> : <Text style={styles.bannerButtonText}>Try Again</Text>}
          </Pressable>
        </View>
      ) : null}

      {viewMode === 'list' ? (
        discovery.isLoadingCatalog && discovery.trails.length === 0 ? <TrailsLoadingState /> : (
          <FlatList
            data={discovery.trails}
            keyExtractor={(trail) => trail.id}
            renderItem={renderTrail}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            refreshing={discovery.isRefreshingCatalog}
            onRefresh={() => void discovery.refresh(true)}
            contentContainerStyle={[styles.list, { paddingBottom: safeArea.bottom + 112 }]}
            ListHeaderComponent={<View style={styles.resultsRow}><Text style={styles.resultsTitle}>{discovery.trails.length} trails & parks found</Text><Text style={styles.resultsMeta}>{areaSummary}</Text></View>}
            ListEmptyComponent={discovery.error ? null : (
              <TrailsEmptyState
                locationRequired={discovery.locationStatus !== 'granted'}
                isRefreshing={discovery.isRefreshingCatalog}
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
          ) : !activeCoordinate ? (
            <View style={styles.mapState}><Ionicons name="location-outline" size={34} color={C.cyan} /><Text style={styles.mapStateText}>Your location is needed to display nearby trail markers.</Text></View>
          ) : (
            <MapView
              ref={mapRef}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={StyleSheet.absoluteFill}
              initialRegion={{ ...activeCoordinate, latitudeDelta: activeMapDelta, longitudeDelta: activeMapDelta }}
              showsUserLocation={false}
              showsMyLocationButton={false}
              userInterfaceStyle="dark"
              onRegionChangeComplete={(region: { latitude: number; longitude: number }) => discovery.setMapCameraLocation({ latitude: region.latitude, longitude: region.longitude })}
            >
              {currentGpsCoordinate ? (
                <Marker
                  coordinate={currentGpsCoordinate}
                  title="You are here"
                  description={gpsAccuracyMeters ? `GPS accuracy: about ${Math.round(gpsAccuracyMeters)} m` : undefined}
                  pinColor={C.cyan}
                />
              ) : null}
              <Circle
                center={activeCoordinate}
                radius={25 * 1_609.344}
                strokeColor="rgba(0, 229, 255, 0.55)"
                fillColor="rgba(0, 229, 255, 0.08)"
              />
              {discovery.locationSource === 'zip' ? <Marker coordinate={activeCoordinate} title="Search area" pinColor={C.cyan} /> : null}
              {discovery.trails.map((trail) => <TrailMapMarker key={trail.id} trail={trail} selected={trail.id === selectedTrail?.id} onPress={() => setSelectedTrailId(trail.id)} />)}
            </MapView>
          )}

          {discovery.hasPendingAreaSearch ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Recenter map on my current location" onPress={recenterMap} style={({ pressed }) => [styles.searchAreaButton, pressed && styles.pressed]}>
              <Ionicons name="locate" size={16} color={C.text} /><Text style={styles.searchAreaText}>Return to My Area</Text>
            </Pressable>
          ) : null}

          {selectedTrail ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`View ${selectedTrail.name}`} onPress={() => void openTrail(selectedTrail)} style={[styles.mapCard, { bottom: safeArea.bottom + 104 }]}>
              <View style={styles.mapCardCopy}>
                <Text numberOfLines={1} style={styles.mapCardName}>{selectedTrail.name}</Text>
                <Text style={styles.mapCardMeta}>
                  {formatDistanceMiles(selectedTrail.distanceMiles)} away · {selectedTrail.difficulty}
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

// This small control lets the important switch between list and map presentations.
// important note: Displays the view toggle UI.
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
