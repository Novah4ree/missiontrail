import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
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

import { MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/maps/map-components';
import { CreateMeetupModal } from '@/components/trails/create-meetup-modal';
import { TrailMeetupCard } from '@/components/trails/trail-meetup-card';
import { TrailSessionConfirmModal } from '@/components/trails/trail-session-confirm-modal';
import { MissionTrailColors as C } from '@/constants/theme';
import { useLocationState } from '@/providers/location-provider';
import { getHikingRoute, HikingRouteError } from '@/services/hiking-route-service';
import { loadSelectedTrail, saveSelectedTrail } from '@/services/selected-trail-service';
import {
  ActiveTrailConflictError,
  loadActiveTrailActivity,
  startTrailActivity,
} from '@/services/trail-activity-service';
import {
  blockMeetupHost,
  createTrailMeetup,
  getTrailMeetups,
  reportMeetupHost,
  requestToJoinMeetup,
  type CreateMeetupInput,
} from '@/services/trail-data-service';
import {
  enrichTrailDetails,
  reverseGeocodeTrailLocation,
  type TrailAddressResult,
} from '@/services/trail-discovery-service';
import {
  getTrailDailyForecast,
  type TrailDailyForecast,
} from '@/services/weather-forecast-service';
import type { ActiveTrailActivity, HikingRoute, Trail, TrailAmenity, TrailMeetup, TrailSearchCoordinate } from '@/types/trails';
import { calculateDistanceMeters, formatGeographicDistance } from '@/utils/distance';
import { validateActiveGpsLocation } from '@/utils/location-validation';
import {
  calculateTrailGeometryLengthMiles,
  getTrailDestinationCoordinate,
  getValidLineCoordinates,
} from '@/utils/trail-location';
import { createTrailNavigationPlan, getTrailNavigationUrl } from '@/utils/trail-navigation';
import { formatTrailheadProximityRadius, isActiveTrailCurrent } from '@/utils/trail-proximity';

const TRAIL_MAP_DELTA = 0.025;
const DIRECTIONS_REFRESH_DISTANCE_METERS = 250;

// This screen presents one trail and manages its route, safety, and meetup actions.
// Important note: Builds and controls the trail details screen.
export default function TrailDetailsScreen() {
  const { trailId, section } = useLocalSearchParams<{ trailId?: string; section?: string }>();
  const router = useRouter();
  const { location, setGpsLocation } = useLocationState();
  const safeArea = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<any>(null);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [directionsOrigin, setDirectionsOrigin] = useState<TrailSearchCoordinate | null>(null);
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
  const [forecast, setForecast] = useState<TrailDailyForecast | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<TrailAddressResult | null>(null);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [activeTrailToReplace, setActiveTrailToReplace] = useState<ActiveTrailActivity | null>(null);

  // Returns to Trails safely even if this details route has no back history.
  // Important note: Takes the user back to trails.
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
    // Important note: Loads the trail, weather, and meetup details.
    async function load() {
      try {
        const selected = await loadSelectedTrail(trailId);
        if (!selected) throw new Error('This trail is no longer available. Return to Explore Trails and select it again.');
        if (!getTrailDestinationCoordinate(selected)) {
          throw new Error('This trail does not have valid trailhead coordinates. Return to Explore Trails and choose another location.');
        }
        const [selectedMeetups, enrichedTrail] = await Promise.all([
          getTrailMeetups(selected.id),
          enrichTrailDetails(selected).catch((detailsError: unknown) => {
            if (__DEV__) console.warn('[Trail details] Provider metrics could not load.', detailsError);
            return selected;
          }),
        ]);
        if (!active) return;
        setTrail(enrichedTrail);
        setMeetups(selectedMeetups);
        if (enrichedTrail !== selected) void saveSelectedTrail(enrichedTrail);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Trail details are unavailable.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [trailId]);

  const trailDestination = useMemo(
    () => trail ? getTrailDestinationCoordinate(trail) : null,
    [trail],
  );
  const trailMapRegion = useMemo(() => trailDestination ? {
    ...trailDestination,
    latitudeDelta: TRAIL_MAP_DELTA,
    longitudeDelta: TRAIL_MAP_DELTA,
  } : null, [trailDestination]);
  const providerTrailCoordinates = useMemo(
    () => getValidLineCoordinates(trail?.geometry),
    [trail?.geometry],
  );
  const directionsCoordinates = useMemo(
    () => getValidLineCoordinates(route?.geometry),
    [route?.geometry],
  );
  const currentGpsLocation = useMemo(
    () => validateActiveGpsLocation(location.currentGpsLocation),
    [location.currentGpsLocation],
  );
  const currentGpsCoordinate = useMemo(() => currentGpsLocation ? {
    latitude: currentGpsLocation.latitude,
    longitude: currentGpsLocation.longitude,
  } : null, [currentGpsLocation]);
  const distanceToTrailheadMeters = useMemo(
    () => currentGpsCoordinate && trailDestination
      ? calculateDistanceMeters(currentGpsCoordinate, trailDestination)
      : null,
    [currentGpsCoordinate, trailDestination],
  );

  // Continue foreground GPS updates after Explore Trails unmounts so the
  // displayed trailhead distance follows real device movement.
  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    void (async () => {
      try {
        const [servicesEnabled, permission] = await Promise.all([
          Location.hasServicesEnabledAsync(),
          Location.getForegroundPermissionsAsync(),
        ]);
        if (!active || !servicesEnabled || permission.status !== Location.PermissionStatus.GRANTED) return;
        subscription = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 3_000,
        }, (position) => {
          if (active) setGpsLocation(position);
        });
        if (!active) subscription.remove();
      } catch (watchError) {
        if (__DEV__) console.warn('[Trail details] Live GPS distance updates could not start.', watchError);
      }
    })();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [setGpsLocation]);

  // Routing is comparatively expensive. Refresh it only after meaningful GPS
  // movement while the distance label itself continues updating every fix.
  useEffect(() => {
    if (!currentGpsCoordinate) {
      setDirectionsOrigin(null);
      return;
    }
    setDirectionsOrigin((current) => !current
      || calculateDistanceMeters(current, currentGpsCoordinate) >= DIRECTIONS_REFRESH_DISTANCE_METERS
      ? currentGpsCoordinate
      : current);
  }, [currentGpsCoordinate]);

  // Reverse geocodes only when the provider did not supply a usable address.
  useEffect(() => {
    if (!trail || !trailDestination || trail.address?.trim()) {
      setResolvedAddress(null);
      setIsAddressLoading(false);
      return;
    }
    let active = true;
    setResolvedAddress(null);
    setIsAddressLoading(true);
    void reverseGeocodeTrailLocation(trailDestination)
      .then((address) => { if (active) setResolvedAddress(address); })
      .catch((addressError: unknown) => {
        if (__DEV__) console.warn('[Trail details] Trail address could not be resolved.', addressError);
      })
      .finally(() => { if (active) setIsAddressLoading(false); });
    return () => { active = false; };
  }, [trail, trailDestination]);

  // Recalculates directions when the selected trail changes.
  useEffect(() => {
    if (!trail) return;
    const selectedTrail = trail;
    let active = true;
    // Uses an already-granted location for directions without prompting while
    // the user is only browsing the trail details.
    // Important note: Loads route.
    async function loadRoute() {
      setIsRouteLoading(true);
      setRoute(null);
      setRouteMessage(null);
      try {
        if (!directionsOrigin) {
          throw new Error('Current location is unavailable, so directions to the trailhead cannot be calculated. The selected trail remains centered.');
        }
        if (!trailDestination) throw new Error('The selected trailhead coordinates are unavailable.');
        try {
          const hikingRoute = await getHikingRoute(directionsOrigin, trailDestination);
          if (active) setRoute(hikingRoute);
        } catch (routeError) {
          if (__DEV__) console.warn('[Trail details] Directions to trailhead could not load.', routeError);
          const routeFailure = routeError instanceof HikingRouteError
            ? routeError.message
            : 'Directions unavailable.';
          if (active) setRouteMessage(providerTrailCoordinates.length > 1
            ? `${routeFailure} Showing ${trailGeometryLabel(selectedTrail)}.`
            : routeFailure);
        }
      } catch (locationError) {
        if (active) {
          const message = locationError instanceof Error ? locationError.message : 'Current location is unavailable.';
          setRouteMessage(providerTrailCoordinates.length > 1
            ? `${message} Showing ${trailGeometryLabel(selectedTrail)}.`
            : message);
        }
      } finally {
        if (active) setIsRouteLoading(false);
      }
    }
    void loadRoute();
    return () => { active = false; };
  }, [directionsOrigin, providerTrailCoordinates.length, trail, trailDestination]);

  // Fetches today's forecast for the trail and cancels stale screen requests.
  useEffect(() => {
    if (!trail) return;
    const controller = new AbortController();
    setIsForecastLoading(true);
    setForecast(null);
    setForecastError(null);

    void getTrailDailyForecast(trail.latitude, trail.longitude, controller.signal)
      .then(setForecast)
      .catch((forecastLoadError: unknown) => {
        if (
          forecastLoadError instanceof Error
          && forecastLoadError.name === 'AbortError'
        ) return;
        if (__DEV__) console.warn('[Trail details] Forecast could not load.', forecastLoadError);
        setForecastError('Today’s forecast is temporarily unavailable.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsForecastLoading(false);
      });

    return () => controller.abort();
  }, [trail]);

  // Reasserts the trailhead as the primary camera target. Directions remain an
  // overlay and never take control of the camera.
  useEffect(() => {
    if (!trailMapRegion || Platform.OS === 'web') return;
    mapRef.current?.animateToRegion(trailMapRegion, 350);
  }, [trail, trailMapRegion]);

  // Scrolls directly to meetups when the user tapped "View Meetups" on a card.
  useEffect(() => {
    if (section === 'meetups' && meetupSectionY !== null) {
      scrollRef.current?.scrollTo({ y: meetupSectionY, animated: true });
    }
  }, [meetupSectionY, section]);

  // Opens turn-by-turn walking directions to the selected trailhead.
  // Important note: Starts navigation.
  async function startNavigation(replaceExisting = false) {
    if (!trail || isStarting) return;
    const navigationPlan = createTrailNavigationPlan(trail, currentGpsCoordinate);
    if (!navigationPlan) {
      Alert.alert(
        'Directions unavailable',
        'This trail does not have valid trailhead coordinates. Use its available address or another location method.',
      );
      return;
    }
    if (trail.status === 'closed' || trail.publicAccess === false) {
      Alert.alert('Trail unavailable', 'This trail cannot be started while it is closed or restricted.');
      return;
    }
    setIsStarting(true);
    try {
      if (!replaceExisting) {
        const existing = await loadActiveTrailActivity();
        if (existing && isActiveTrailCurrent(existing) && existing.trail.id !== trail.id) {
          setActiveTrailToReplace(existing);
          return;
        }
      }
      // Save the destination before Maps backgrounds this app. Mission step
      // credit can then remain paused until the user reaches the trailhead.
      const trailhead = { ...trail, ...navigationPlan.destination };
      const navigationUrl = getTrailNavigationUrl(
        Platform.OS === 'ios' ? 'ios' : 'other',
        trail.name,
        navigationPlan.destination,
        navigationPlan.origin,
      );
      if (!navigationUrl) {
        throw new Error('The selected trail destination could not be validated.');
      }
      await startTrailActivity(
        trailhead,
        navigationPlan.origin ?? undefined,
        undefined,
        { replaceExisting },
      );
      await Linking.openURL(navigationUrl);
    } catch (navigationError) {
      if (navigationError instanceof ActiveTrailConflictError) {
        setActiveTrailToReplace(navigationError.activeActivity);
        return;
      }
      if (__DEV__) console.warn('[Trail details] Maps navigation could not open.', navigationError);
      Alert.alert(
        'Navigation unavailable',
        displayTrailAddress(trail.address, resolvedAddress, false)
          ? 'A maps app could not be opened. Use the trail address shown above with another location method.'
          : 'A maps app could not be opened, and no trail address is available. Try another location method.',
      );
    } finally {
      setIsStarting(false);
    }
  }

  // Records a join request and updates the button so it cannot be sent repeatedly.
  // Important note: Requests join.
  async function requestJoin(meetup: TrailMeetup) {
    await requestToJoinMeetup(meetup.id);
    setRequestedMeetupIds((current) => [...new Set([...current, meetup.id])]);
    Alert.alert('Request sent', `The host of ${meetup.title} can now review your request.`);
  }

  // Confirms a safety report before calling the future moderation service placeholder.
  // Important note: Reports host.
  function reportHost(meetup: TrailMeetup) {
    Alert.alert('Report unsafe behavior?', 'A future moderated backend will securely review this report.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => void reportMeetupHost(meetup.id).then(() => Alert.alert('Report recorded', 'Thank you for helping keep public meetups safe.')) },
    ]);
  }

  // Confirms a block and immediately hides that host's meetup from this screen.
  // Important note: Blocks host.
  function blockHost(meetup: TrailMeetup) {
    Alert.alert(`Block ${meetup.hostName}?`, 'Their meetup will be hidden from this screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => void blockMeetupHost(meetup.id).then(() => setMeetups((current) => current.filter((item) => item.id !== meetup.id))) },
    ]);
  }

  // Adds the newly created local meetup to the visible meetup section.
  // Important note: Creates meetup.
  async function createMeetup(input: CreateMeetupInput) {
    const meetup = await createTrailMeetup(input);
    setMeetups((current) => [meetup, ...current]);
  }

  const detailStats = trail ? getTrailStats(trail, distanceToTrailheadMeters) : [];

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
                trailMapRegion && trailDestination ? <MapView
                  key={`${trail.id}:${trailDestination.latitude}:${trailDestination.longitude}`}
                  ref={mapRef}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  style={StyleSheet.absoluteFill}
                  userInterfaceStyle="dark"
                  initialRegion={trailMapRegion}
                  onMapReady={() => mapRef.current?.animateToRegion(trailMapRegion, 0)}
                >
                  {currentGpsCoordinate ? <Marker coordinate={currentGpsCoordinate} title="Your current location" pinColor={C.cyan} /> : null}
                  <Marker coordinate={trailDestination} title={trail.name} description="Trailhead" pinColor={C.magenta} />
                  {providerTrailCoordinates.length > 1 ? <Polyline coordinates={providerTrailCoordinates} strokeColor={C.magenta} strokeWidth={5} /> : null}
                  {directionsCoordinates.length > 1 ? <Polyline coordinates={directionsCoordinates} strokeColor={C.cyan} strokeWidth={4} /> : null}
                </MapView> : <View style={styles.mapState}><Text style={styles.muted}>Trail map coordinates are unavailable.</Text></View>
              )}
              <View style={styles.routeBadge}><Ionicons name="navigate-outline" size={14} color={C.cyan} /><Text style={styles.routeBadgeText}>ROUTE PREVIEW</Text></View>
            </View>

            <View style={styles.mainContent}>
              <Text style={styles.eyebrow}>{trail.activityType.toUpperCase()} • {trail.status.toUpperCase()}</Text>
              <Text style={styles.title}>{trail.name}</Text>
              <Text style={styles.address}>{displayTrailAddress(trail.address, resolvedAddress, isAddressLoading) ?? 'Address unavailable'}</Text>
              {trail.description ? <Text style={styles.description}>{trail.description}</Text> : null}

              <View style={styles.statsRow}>
                {detailStats.map((stat, index) => <Stat key={`${stat.label}:${index}`} label={stat.label} value={stat.value} />)}
              </View>

              {isRouteLoading ? <View style={styles.loadingRow}><ActivityIndicator color={C.cyan} /><Text style={styles.muted}>Calculating hike directions…</Text></View> : null}
              {providerTrailCoordinates.length > 1 ? <Text style={styles.routeInfo}>{capitalize(trailGeometryLabel(trail))} shown in magenta.</Text> : null}
              {route ? <Text style={styles.routeInfo}>Directions to start shown in cyan: {route.distanceMiles.toFixed(1)} mi · {Math.round(route.durationMinutes)} min</Text> : null}
              {routeMessage ? <Text style={styles.warning}>{routeMessage}</Text> : null}

              <Section title="Trail Intel">
                <Detail icon="speedometer-outline" label="Difficulty" value={capitalize(trail.difficulty)} />
                <Detail icon="layers-outline" label="Terrain / surface" value={trail.terrain} />
                {trail.accessibility ? <Detail icon="accessibility-outline" label="Accessibility" value={trail.accessibility} /> : null}
                {trail.petRules ? <Detail icon="paw-outline" label="Pet rules" value={trail.petRules} /> : null}
                <Detail icon="people-outline" label="Public access" value={trail.publicAccess === true ? 'Public access is listed.' : trail.publicAccess === false ? 'Access is restricted.' : 'Access information is unavailable.'} />
              </Section>

              <Section title="Amenities">
                <View style={styles.amenities}>
                  {(['parking', 'restrooms', 'water', 'pet_friendly'] as TrailAmenity[]).map((amenity) => <Amenity key={amenity} amenity={amenity} available={trail.amenities.includes(amenity)} />)}
                </View>
              </Section>

              <Section title="Weather & Safety">
                <DailyForecast
                  forecast={forecast}
                  isLoading={isForecastLoading}
                  error={forecastError}
                />
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
            <Pressable accessibilityRole="button" accessibilityLabel="Start GPS navigation for this trail" disabled={trail.status === 'closed' || trail.publicAccess === false || isStarting} onPress={() => void startNavigation()} style={[styles.startButton, (trail.status === 'closed' || trail.publicAccess === false || isStarting) && styles.disabled]}>
              <Ionicons name="navigate" size={19} color={C.text} /><Text style={styles.startText}>{isStarting ? 'Opening Maps…' : trail.status === 'closed' ? 'Trail Closed' : 'Start Navigation'}</Text>
            </Pressable>
            <Text style={styles.verificationText}>{trailheadDistanceMessage(distanceToTrailheadMeters)}</Text>
          </View>

          <CreateMeetupModal visible={showCreateMeetup} trail={trail} onClose={() => setShowCreateMeetup(false)} onCreate={createMeetup} />
        </>
      )}
      <TrailSessionConfirmModal
        visible={Boolean(activeTrailToReplace && trail)}
        title="You already have an active trail"
        message={`${activeTrailToReplace?.trail.name ?? 'Another trail'} is currently being tracked.\n\nWould you like to end it and start ${trail?.name ?? 'this trail'}?`}
        cancelLabel="Keep Current Trail"
        confirmLabel="Switch Trails"
        busy={isStarting}
        onCancel={() => setActiveTrailToReplace(null)}
        onConfirm={() => {
          setActiveTrailToReplace(null);
          void startNavigation(true);
        }}
      />
    </View>
  );
}

// Gives related detail rows a consistent heading and spacing.
// Important note: Displays a labeled section of trail information.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

// Displays one quick trail measurement such as length, time, or elevation.
// Important note: Displays the stat UI.
function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

// Displays one labeled trail fact with an icon for easier scanning.
// Important note: Displays the detail UI.
function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.detail}><Ionicons name={icon} size={18} color={C.cyan} /><View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View></View>;
}

// Converts an amenity code into a readable availability badge.
// Important note: Displays the amenity UI.
function Amenity({ amenity, available }: { amenity: TrailAmenity; available: boolean }) {
  const label = ({ parking: 'Parking', restrooms: 'Restrooms', water: 'Water', pet_friendly: 'Pet friendly' } as const)[amenity];
  return <View style={[styles.amenity, !available && styles.unavailableAmenity]}><Ionicons name={available ? 'checkmark-circle' : 'remove-circle-outline'} size={16} color={available ? C.green : C.textMuted} /><Text style={styles.amenityText}>{label}: {available ? 'Yes' : 'No'}</Text></View>;
}

// Important note: Displays the daily forecast UI.
function DailyForecast({
  forecast,
  isLoading,
  error,
}: {
  forecast: TrailDailyForecast | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <View style={styles.weather}>
        <ActivityIndicator color={C.warning} />
        <Text style={styles.noticeText}>Loading today’s trail forecast…</Text>
      </View>
    );
  }
  if (!forecast || error) {
    return (
      <View style={styles.weather}>
        <Ionicons name="cloud-offline-outline" size={22} color={C.warning} />
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Forecast unavailable</Text>
          <Text style={styles.noticeText}>{error ?? 'Check an official forecast before leaving.'}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.weather}>
      <Ionicons name={weatherIcon(forecast.weatherCode)} size={24} color={C.warning} />
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>
          {forecast.summary} · {Math.round(forecast.temperatureMaxF)}° / {Math.round(forecast.temperatureMinF)}°
        </Text>
        <Text style={styles.noticeText}>
          Rain {Math.round(forecast.precipitationProbabilityPercent)}% · Wind up to {Math.round(forecast.windSpeedMaxMph)} mph · UV {Math.round(forecast.uvIndexMax)}
        </Text>
        <Text style={styles.forecastSource}>
          Today, {formatForecastDate(forecast.date)} · Forecast by Open-Meteo
        </Text>
      </View>
    </View>
  );
}

// Important note: Chooses an icon that matches the forecast.
function weatherIcon(code: number): keyof typeof Ionicons.glyphMap {
  if (code === 0 || code === 1) return 'sunny-outline';
  if (code === 2) return 'partly-sunny-outline';
  if (code === 3 || code === 45 || code === 48) return 'cloudy-outline';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow-outline';
  if (code >= 95) return 'thunderstorm-outline';
  return 'rainy-outline';
}

// Important note: Formats forecast date for display.
function formatForecastDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

// Capitalizes stored lowercase labels before showing them to the user.
// Important note: Makes the first letter of a text value uppercase.
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }

function displayTrailAddress(
  providerAddress: string | undefined,
  geocoded: TrailAddressResult | null,
  loading: boolean,
) {
  const supplied = providerAddress?.trim();
  if (supplied) return supplied;
  if (loading) return 'Looking up trail location…';
  if (!geocoded) return null;

  const locality = [geocoded.locality, geocoded.stateCode ?? geocoded.state]
    .filter(Boolean)
    .join(', ');
  const lines = [geocoded.street, locality].filter(Boolean);
  return lines.join('\n') || geocoded.formatted?.trim() || null;
}

function trailLengthMiles(trail: Trail) {
  if (Number.isFinite(trail.lengthMiles) && trail.lengthMiles > 0) return trail.lengthMiles;
  if (typeof trail.routeDistanceMiles === 'number' && Number.isFinite(trail.routeDistanceMiles) && trail.routeDistanceMiles > 0) {
    return trail.routeDistanceMiles;
  }
  return calculateTrailGeometryLengthMiles(trail.geometry);
}

function getTrailStats(trail: Trail, distanceToTrailheadMeters: number | null) {
  const length = trailLengthMiles(trail);
  const duration = Number.isFinite(trail.estimatedDurationMinutes) && trail.estimatedDurationMinutes > 0
    ? Math.round(trail.estimatedDurationMinutes)
    : null;
  const elevation = typeof trail.elevationGainFeet === 'number'
    && Number.isFinite(trail.elevationGainFeet)
    && trail.elevationGainFeet >= 0
    ? Math.round(trail.elevationGainFeet)
    : null;
  const estimatedPrefix = trail.metricSource === 'geometry_estimate' ? '~' : '';

  return [
    length !== null
      ? { label: 'Length', value: `${estimatedPrefix}${length.toFixed(1)} mi` }
      : distanceToTrailheadMeters !== null
        ? { label: 'Distance away', value: formatGeographicDistance(distanceToTrailheadMeters) }
        : { label: 'Type', value: trailCategoryLabel(trail) },
    duration !== null
      ? { label: 'Est. time', value: `${estimatedPrefix}${duration} min` }
      : { label: 'Activity', value: capitalize(trail.activityType) },
    elevation !== null
      ? { label: 'Elevation', value: `${elevation} ft` }
      : trail.difficulty !== 'unknown'
        ? { label: 'Difficulty', value: capitalize(trail.difficulty) }
        : { label: 'Type', value: trailCategoryLabel(trail) },
  ];
}

function trailCategoryLabel(trail: Trail) {
  return ({
    trail: 'Trail',
    trailhead: 'Trailhead',
    park: 'Park',
    nature_reserve: 'Nature reserve',
    nature_area: 'Nature area',
    walking_path: 'Walking path',
  } as const)[trail.category];
}

function trailGeometryLabel(trail: Trail) {
  return trail.source === 'mission_trails' ? 'saved trail route' : 'provider trail geometry';
}

function trailheadDistanceMessage(distanceMeters: number | null) {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) {
    return 'Opens walking directions. GPS distance to the trailhead is unavailable.';
  }
  return `Opens walking directions. You are ${formatGeographicDistance(distanceMeters)} from the trailhead. Mission steps activate within ${formatTrailheadProximityRadius()}.`;
}

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
  forecastSource: { color: '#A99B7E', fontSize: 9, lineHeight: 14, marginTop: 5 },
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
