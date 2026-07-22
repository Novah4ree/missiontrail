import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateMeetupModal } from '@/components/trails/create-meetup-modal';
import { TrailMeetupCard } from '@/components/trails/trail-meetup-card';
import { MissionTrailColors as C } from '@/constants/theme';
import { getHikingRoute } from '@/services/hiking-route-service';
import { loadSelectedTrail } from '@/services/selected-trail-service';
import {
  blockMeetupHost,
  createTrailMeetup,
  getTrailMeetups,
  reportMeetupHost,
  requestToJoinMeetup,
  type CreateMeetupInput,
} from '@/services/trail-data-service';
import { startTrailActivity } from '@/services/trail-activity-service';
import type { HikingRoute, Trail, TrailAmenity, TrailMeetup, TrailSearchCoordinate } from '@/types/trails';

let MapView: any = View;
let Marker: any = View;
let Polyline: any = View;
let PROVIDER_GOOGLE: unknown = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

// This screen presents one trail and manages its route, safety, and meetup actions.
export default function TrailDetailsScreen() {
  const { trailId, section } = useLocalSearchParams<{ trailId?: string; section?: string }>();
  const router = useRouter();
  const safeArea = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<any>(null);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [origin, setOrigin] = useState<TrailSearchCoordinate | null>(null);
  const [route, setRoute] = useState<HikingRoute | null>(null);
  const [meetups, setMeetups] = useState<TrailMeetup[]>([]);
  const [requestedMeetupIds, setRequestedMeetupIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showCreateMeetup, setShowCreateMeetup] = useState(false);
  const [meetupSectionY, setMeetupSectionY] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);

  // Returns to Trails safely even if this details route has no back history.
  function returnToTrails() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/trails');
  }

  // Reloads detail data whenever navigation supplies a different trail ID.
  useEffect(() => {
    let active = true;
    // Loads the trail handoff and its public meetups when the route opens.
    async function load() {
      try {
        const selected = await loadSelectedTrail(trailId);
        if (!selected) throw new Error('This trail is no longer available. Return to Explore Trails and select it again.');
        const selectedMeetups = await getTrailMeetups(selected.id);
        if (!active) return;
        setTrail(selected);
        setMeetups(selectedMeetups);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Trail details are unavailable.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [trailId]);

  // Recalculates directions when the selected trail changes.
  useEffect(() => {
    if (!trail) return;
    const selectedTrail = trail;
    let active = true;
    // Requests an approximate origin and asks the protected service for directions.
    async function loadRoute() {
      setIsRouteLoading(true);
      try {
        if (!(await Location.hasServicesEnabledAsync())) throw new Error('Location is off. The saved trail preview is still available.');
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) throw new Error('Location permission was denied. You can review the trail, but verified tracking cannot start.');
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const start = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        if (active) setOrigin(start);
        try {
          const hikingRoute = await getHikingRoute(start, { latitude: selectedTrail.latitude, longitude: selectedTrail.longitude });
          if (active) setRoute(hikingRoute);
        } catch {
          if (active) setRouteMessage('Live hiking directions are unavailable. Showing the saved public trail route.');
        }
      } catch (locationError) {
        if (active) setRouteMessage(locationError instanceof Error ? locationError.message : 'Current location is unavailable.');
      } finally {
        if (active) setIsRouteLoading(false);
      }
    }
    void loadRoute();
    return () => { active = false; };
  }, [trail]);

  const previewGeometry = route?.geometry ?? trail?.geometry;
  // Converts GeoJSON longitude/latitude pairs into the map library's coordinate shape.
  const routeCoordinates = useMemo(() => previewGeometry?.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })) ?? [], [previewGeometry]);

  // Zooms the map so the full route is visible after its coordinates load.
  useEffect(() => {
    if (routeCoordinates.length < 2 || Platform.OS === 'web') return;
    mapRef.current?.fitToCoordinates(routeCoordinates, { edgePadding: { top: 45, right: 45, bottom: 45, left: 45 }, animated: true });
  }, [routeCoordinates]);

  // Scrolls directly to meetups when the user tapped "View Meetups" on a card.
  useEffect(() => {
    if (section === 'meetups' && meetupSectionY !== null) {
      scrollRef.current?.scrollTo({ y: meetupSectionY, animated: true });
    }
  }, [meetupSectionY, section]);

  // Sends the route to Live Map without granting progress, relics, or XP here.
  async function startNavigation() {
    if (!trail || isStarting) return;
    if (trail.status !== 'open' || !trail.publicAccess) {
      Alert.alert('Trail unavailable', 'This trail cannot be started while it is closed or restricted.');
      return;
    }
    if (!origin) {
      Alert.alert('Location needed', 'Enable foreground location to begin a verified GPS trail session.');
      return;
    }
    setIsStarting(true);
    // Only Live Map GPS validation can add progress, complete missions, or award XP.
    await startTrailActivity({
      ...trail,
      estimatedDurationMinutes: route?.durationMinutes ?? trail.estimatedDurationMinutes,
      routeDistanceMiles: route?.distanceMiles ?? trail.lengthMiles,
      geometry: route?.geometry ?? trail.geometry,
    }, origin);
    router.replace('/home-backup');
  }

  // Records a join request and updates the button so it cannot be sent repeatedly.
  async function requestJoin(meetup: TrailMeetup) {
    await requestToJoinMeetup(meetup.id);
    setRequestedMeetupIds((current) => [...new Set([...current, meetup.id])]);
    Alert.alert('Request sent', `The host of ${meetup.title} can now review your request.`);
  }

  // Confirms a safety report before calling the future moderation service placeholder.
  function reportHost(meetup: TrailMeetup) {
    Alert.alert('Report unsafe behavior?', 'A future moderated backend will securely review this report.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => void reportMeetupHost(meetup.id).then(() => Alert.alert('Report recorded', 'Thank you for helping keep public meetups safe.')) },
    ]);
  }

  // Confirms a block and immediately hides that host's meetup from this screen.
  function blockHost(meetup: TrailMeetup) {
    Alert.alert(`Block ${meetup.hostName}?`, 'Their meetup will be hidden from this screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => void blockMeetupHost(meetup.id).then(() => setMeetups((current) => current.filter((item) => item.id !== meetup.id))) },
    ]);
  }

  // Adds the newly created local meetup to the visible meetup section.
  async function createMeetup(input: CreateMeetupInput) {
    const meetup = await createTrailMeetup(input);
    setMeetups((current) => [meetup, ...current]);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: safeArea.top + 8 }]}>
        <Pressable accessibilityLabel="Back to Explore Trails" onPress={returnToTrails} style={styles.iconButton}><Ionicons name="arrow-back" size={22} color={C.text} /></Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>Trail Details</Text>
        <View style={styles.iconButton} />
      </View>

      {isLoading ? <View style={styles.fullState}><ActivityIndicator size="large" color={C.cyan} /></View> : error || !trail ? (
        <View style={styles.fullState}><Ionicons name="warning-outline" size={30} color={C.warning} /><Text style={styles.error}>{error ?? 'Trail not found.'}</Text></View>
      ) : (
        <>
          <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: safeArea.bottom + 112 }]}>
            <View style={styles.mapWrap}>
              {Platform.OS === 'web' ? <View style={styles.mapState}><Text style={styles.muted}>Route preview maps are available on iOS and Android.</Text></View> : (
                <MapView ref={mapRef} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} style={StyleSheet.absoluteFill} userInterfaceStyle="dark" initialRegion={{ latitude: trail.latitude, longitude: trail.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }}>
                  {origin ? <Marker coordinate={origin} title="Your approximate location" pinColor={C.cyan} /> : null}
                  <Marker coordinate={{ latitude: trail.latitude, longitude: trail.longitude }} title={trail.startLocation} pinColor={C.magenta} />
                  {routeCoordinates.length > 1 ? <Polyline coordinates={routeCoordinates} strokeColor={C.cyan} strokeWidth={5} /> : null}
                </MapView>
              )}
              <View style={styles.routeBadge}><Ionicons name="navigate-outline" size={14} color={C.cyan} /><Text style={styles.routeBadgeText}>ROUTE PREVIEW</Text></View>
            </View>

            <View style={styles.mainContent}>
              <Text style={styles.eyebrow}>{trail.activityType.toUpperCase()} • {trail.status.toUpperCase()}</Text>
              <Text style={styles.title}>{trail.name}</Text>
              <Text style={styles.address}>{trail.startLocation} · {trail.address ?? 'Address not provided'}</Text>
              <Text style={styles.description}>{trail.description ?? 'Not provided.'}</Text>

              <View style={styles.statsRow}>
                <Stat label="Length" value={`${trail.lengthMiles.toFixed(1)} mi`} />
                <Stat label="Est. time" value={`${trail.estimatedDurationMinutes} min`} />
                <Stat label="Elevation" value={trail.elevationGainFeet !== undefined ? `${trail.elevationGainFeet} ft` : 'Not provided'} />
              </View>

              {isRouteLoading ? <View style={styles.loadingRow}><ActivityIndicator color={C.cyan} /><Text style={styles.muted}>Calculating hike directions…</Text></View> : null}
              {route ? <Text style={styles.routeInfo}>Directions to start: {route.distanceMiles.toFixed(1)} mi · {Math.round(route.durationMinutes)} min</Text> : null}
              {routeMessage ? <Text style={styles.warning}>{routeMessage}</Text> : null}

              <Section title="Trail Intel">
                <Detail icon="speedometer-outline" label="Difficulty" value={capitalize(trail.difficulty)} />
                <Detail icon="layers-outline" label="Terrain / surface" value={trail.terrain} />
                <Detail icon="accessibility-outline" label="Accessibility" value={trail.accessibility || 'Not provided.'} />
                <Detail icon="paw-outline" label="Pet rules" value={trail.petRules || 'Not provided.'} />
                <Detail icon="people-outline" label="Public access" value={trail.publicAccess ? 'Public access is listed.' : 'Access is restricted.'} />
              </Section>

              <Section title="Amenities">
                <View style={styles.amenities}>
                  {(['parking', 'restrooms', 'water', 'pet_friendly'] as TrailAmenity[]).map((amenity) => <Amenity key={amenity} amenity={amenity} available={trail.amenities.includes(amenity)} />)}
                </View>
              </Section>

              <Section title="Weather & Safety">
                <View style={styles.weather}><Ionicons name="partly-sunny-outline" size={22} color={C.warning} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>Weather warning placeholder</Text><Text style={styles.noticeText}>Live forecasts are not connected yet. Check an official forecast and park alerts before leaving.</Text></View></View>
                {trail.safetyNotes.map((note) => <View key={note} style={styles.safetyLine}><Ionicons name="shield-checkmark-outline" size={16} color={C.green} /><Text style={styles.safetyText}>{note}</Text></View>)}
              </Section>

              <View onLayout={(event) => setMeetupSectionY(event.nativeEvent.layout.y)}>
                <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Public Meetups</Text><Pressable accessibilityRole="button" accessibilityLabel="Create a trail meetup" onPress={() => setShowCreateMeetup(true)} style={styles.createButton}><Ionicons name="add" size={18} color={C.text} /><Text style={styles.createText}>Create</Text></Pressable></View>
                <View style={styles.privacyNotice}><Ionicons name="lock-closed-outline" size={20} color={C.cyan} /><Text style={styles.privacyText}>Meet in public, tell someone where you are going, and avoid sharing private information. Other users never see your live location—only the public trail meeting point.</Text></View>
                {meetups.length ? meetups.map((meetup) => <TrailMeetupCard key={meetup.id} meetup={meetup} requested={requestedMeetupIds.includes(meetup.id)} onJoin={() => void requestJoin(meetup)} onReport={() => reportHost(meetup)} onBlock={() => blockHost(meetup)} />) : <Text style={styles.emptyMeetups}>No public meetups are scheduled. You can create the first one.</Text>}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: safeArea.bottom + 12 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Start GPS navigation for this trail" disabled={!origin || trail.status !== 'open' || isStarting} onPress={() => void startNavigation()} style={[styles.startButton, (!origin || trail.status !== 'open' || isStarting) && styles.disabled]}>
              <Ionicons name="navigate" size={19} color={C.text} /><Text style={styles.startText}>{isStarting ? 'Opening Live Map…' : trail.status === 'closed' ? 'Trail Closed' : 'Start Navigation'}</Text>
            </Pressable>
            <Text style={styles.verificationText}>XP and relic eligibility unlock only after verified GPS movement.</Text>
          </View>

          <CreateMeetupModal visible={showCreateMeetup} trail={trail} onClose={() => setShowCreateMeetup(false)} onCreate={createMeetup} />
        </>
      )}
    </View>
  );
}

// Gives related detail rows a consistent heading and spacing.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

// Displays one quick trail measurement such as length, time, or elevation.
function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

// Displays one labeled trail fact with an icon for easier scanning.
function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.detail}><Ionicons name={icon} size={18} color={C.cyan} /><View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View></View>;
}

// Converts an amenity code into a readable availability badge.
function Amenity({ amenity, available }: { amenity: TrailAmenity; available: boolean }) {
  const label = ({ parking: 'Parking', restrooms: 'Restrooms', water: 'Water', pet_friendly: 'Pet friendly' } as const)[amenity];
  return <View style={[styles.amenity, !available && styles.unavailableAmenity]}><Ionicons name={available ? 'checkmark-circle' : 'remove-circle-outline'} size={16} color={available ? C.green : C.textMuted} /><Text style={styles.amenityText}>{label}: {available ? 'Yes' : 'Not provided'}</Text></View>;
}

// Capitalizes stored lowercase labels before showing them to the user.
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  header: { minHeight: 94, paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0E0618', borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '900' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fullState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 },
  content: { backgroundColor: C.background },
  mapWrap: { height: 300, backgroundColor: '#10162B' },
  mapState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  routeBadge: { position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: C.cyan, backgroundColor: 'rgba(5,0,12,0.88)', paddingHorizontal: 10, paddingVertical: 7 },
  routeBadgeText: { color: C.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  mainContent: { padding: 20 },
  eyebrow: { color: C.magenta, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: C.text, fontSize: 28, fontWeight: '900', marginTop: 5 },
  address: { color: C.cyan, fontSize: 11, lineHeight: 17, marginTop: 7 },
  description: { color: '#EEE5F5', fontSize: 14, lineHeight: 21, marginTop: 15 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  stat: { flex: 1, minHeight: 78, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', padding: 7 },
  statValue: { color: C.cyan, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  statLabel: { color: C.textMuted, fontSize: 9, marginTop: 4, textAlign: 'center' },
  loadingRow: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 14 },
  muted: { color: C.textMuted, fontSize: 12, textAlign: 'center' },
  routeInfo: { color: C.green, fontSize: 11, fontWeight: '800', marginTop: 12 },
  warning: { color: C.warning, fontSize: 11, lineHeight: 17, marginTop: 12 },
  error: { color: C.warning, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  section: { marginTop: 26 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '900', marginBottom: 12 },
  detail: { flexDirection: 'row', gap: 11, borderBottomWidth: 1, borderBottomColor: '#281736', paddingVertical: 12 },
  detailCopy: { flex: 1 },
  detailLabel: { color: C.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  detailValue: { color: C.text, fontSize: 13, lineHeight: 19, marginTop: 4 },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: '#295C47', backgroundColor: '#0D241B', paddingHorizontal: 10 },
  unavailableAmenity: { borderColor: C.border, backgroundColor: C.surface },
  amenityText: { color: C.text, fontSize: 10, fontWeight: '700' },
  weather: { flexDirection: 'row', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: '#594421', backgroundColor: '#251B0C', padding: 13, marginBottom: 10 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: '#FFE2A9', fontSize: 12, fontWeight: '900' },
  noticeText: { color: '#D9C7A4', fontSize: 11, lineHeight: 17, marginTop: 3 },
  safetyLine: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  safetyText: { flex: 1, color: C.textMuted, fontSize: 12, lineHeight: 18 },
  createButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#702288', paddingHorizontal: 14 },
  createText: { color: C.text, fontSize: 11, fontWeight: '900' },
  privacyNotice: { flexDirection: 'row', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: '#24556B', backgroundColor: '#0C202A', padding: 13, marginBottom: 12 },
  privacyText: { flex: 1, color: '#BEE9F3', fontSize: 11, lineHeight: 17 },
  emptyMeetups: { color: C.textMuted, fontSize: 12, lineHeight: 18, paddingVertical: 20 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: 'rgba(5,0,12,0.97)', borderTopWidth: 1, borderTopColor: C.border },
  startButton: { minHeight: 50, borderRadius: 999, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#73258C', borderWidth: 1, borderColor: C.magenta },
  disabled: { opacity: 0.42 },
  startText: { color: C.text, fontSize: 14, fontWeight: '900' },
  verificationText: { color: C.textMuted, fontSize: 9, textAlign: 'center', marginTop: 6 },
});
