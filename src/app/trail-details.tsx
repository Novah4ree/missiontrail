import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "@/components/maps/map-components";
import { CreateMeetupModal } from "@/components/trails/create-meetup-modal";
import { TrailMeetupCard } from "@/components/trails/trail-meetup-card";
import { MissionTrailColors as C } from "@/constants/theme";
import { getHikingRoute } from "@/services/hiking-route-service";
import { loadSelectedTrail } from "@/services/selected-trail-service";
import { startTrailActivity } from "@/services/trail-activity-service";
import {
  blockMeetupHost,
  createTrailMeetup,
  getTrailMeetups,
  reportMeetupHost,
  requestToJoinMeetup,
  type CreateMeetupInput,
} from "@/services/trail-data-service";
import { type TrailDailyForecast } from "@/services/weather-forecast-service";
import type {
  HikingRoute,
  Trail,
  TrailAmenity,
  TrailMeetup,
  TrailSearchCoordinate,
} from "@/types/trails";

// This screen presents one trail and manages its route, safety, and meetup actions.
// Purpose: Renders the trail details screen interface.
export default function TrailDetailsScreen() {
  const { trailId, section } = useLocalSearchParams<{
    trailId?: string;
    section?: string;
  }>();
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
  const [forecast, setForecast] = useState<TrailDailyForecast | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const [calculatedElevationFeet, setCalculatedElevationFeet] = useState<
    number | null
  >(null);
  const [isElevationLoading, setIsElevationLoading] = useState(false);

  // Returns to Trails safely even if this details route has no back history.
  // Purpose: Implements the return to trails operation.
  function returnToTrails() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/trails");
  }

  // Reloads detail data whenever navigation supplies a different trail ID.
  useEffect(() => {
    let active = true;
    // Loads the trail handoff and its public meetups when the route opens.
    // Purpose: Loads the requested operation.
    async function load() {
      try {
        const selected = await loadSelectedTrail(trailId);
        if (!selected)
          throw new Error(
            "This trail is no longer available. Return to Explore Trails and select it again.",
          );
        const selectedMeetups = await getTrailMeetups(selected.id);
        if (!active) return;
        setTrail(selected);
        setMeetups(selectedMeetups);
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Trail details are unavailable.",
          );
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [trailId]);

  // Recalculates directions when the selected trail changes.
  useEffect(() => {
    if (!trail) return;
    const selectedTrail = trail;
    let active = true;
    // Uses an already-granted location for directions without prompting while
    // the user is only browsing the trail details.
    // Purpose: Loads route.
    async function loadRoute() {
      setIsRouteLoading(true);
      try {
        if (!(await Location.hasServicesEnabledAsync()))
          throw new Error(
            "Location is off. The saved trail preview is still available.",
          );
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          throw new Error(
            "Start Navigation to enable foreground location and verified GPS trail tracking.",
          );
        }
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const start = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        if (active) setOrigin(start);
        try {
          const hikingRoute = await getHikingRoute(start, {
            latitude: selectedTrail.latitude,
            longitude: selectedTrail.longitude,
          });
          if (active) setRoute(hikingRoute);
        } catch {
          if (active)
            setRouteMessage(
              "Live hiking directions are unavailable. Showing the saved public trail route.",
            );
        }
      } catch (locationError) {
        if (active)
          setRouteMessage(
            locationError instanceof Error
              ? locationError.message
              : "Current location is unavailable.",
          );
      } finally {
        if (active) setIsRouteLoading(false);
      }
    }
    void loadRoute();
    return () => {
      active = false;
    };
  }, [trail]);

  // Fetches today's forecast for the trail and cancels stale screen requests.
  useEffect(() => {
    if (!trail) return;

    // Use existing elevation data when the trail already provides it.
    if (
      typeof trail.elevationGainFeet === "number" &&
      Number.isFinite(trail.elevationGainFeet) &&
      trail.elevationGainFeet >= 0
    ) {
      setCalculatedElevationFeet(trail.elevationGainFeet);
      setIsElevationLoading(false);
      return;
    }

    const rawCoordinates = trail.geometry?.coordinates;

    if (!rawCoordinates || rawCoordinates.length < 2) {
      setCalculatedElevationFeet(null);
      setIsElevationLoading(false);
      return;
    }

    // Convert the trail geometry into guaranteed longitude/latitude pairs.
    const coordinates: [number, number][] = rawCoordinates
      .filter(
        (coordinate) =>
          Array.isArray(coordinate) &&
          coordinate.length >= 2 &&
          Number.isFinite(Number(coordinate[0])) &&
          Number.isFinite(Number(coordinate[1])),
      )
      .map(
        (coordinate) =>
          [Number(coordinate[0]), Number(coordinate[1])] as [number, number],
      );

    if (coordinates.length < 2) {
      setCalculatedElevationFeet(null);
      setIsElevationLoading(false);
      return;
    }

    let active = true;

    // Purpose: Loads elevation.
    async function loadElevation() {
      setIsElevationLoading(true);

      try {
        const elevation = await calculateTrailElevationGain(coordinates);

        if (active) {
          setCalculatedElevationFeet(elevation);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[Trail details] Elevation calculation failed.", error);
        }

        if (active) {
          setCalculatedElevationFeet(null);
        }
      } finally {
        if (active) {
          setIsElevationLoading(false);
        }
      }
    }

    void loadElevation();

    return () => {
      active = false;
    };
  }, [trail]);

  const previewGeometry = route?.geometry ?? trail?.geometry;
  // Converts GeoJSON longitude/latitude pairs into the map library's coordinate shape.
  const routeCoordinates = useMemo(
    () =>
      previewGeometry?.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })) ?? [],
    [previewGeometry],
  );

  // Uses provider length first, then falls back to the saved trail geometry.
  const trailLengthMiles = useMemo(() => {
    if (!trail) return null;

    if (typeof trail.lengthMiles === "number" && trail.lengthMiles > 0) {
      return trail.lengthMiles;
    }

    return calculateTrailDistanceMiles(trail.geometry?.coordinates);
  }, [trail]);

  // Uses provider time first, then estimates a duration from trail length/difficulty.
  const trailEstimatedMinutes = useMemo(() => {
    if (!trail) return null;

    if (
      typeof trail.estimatedDurationMinutes === "number" &&
      trail.estimatedDurationMinutes > 0
    ) {
      return trail.estimatedDurationMinutes;
    }

    if (!trailLengthMiles || trailLengthMiles <= 0) {
      return null;
    }

    let hikingSpeedMph = 2.5;

    switch (trail.difficulty) {
      case "easy":
        hikingSpeedMph = 3;
        break;
      case "moderate":
        hikingSpeedMph = 2.5;
        break;
      case "challenging":
        hikingSpeedMph = 2;
        break;
      default:
        hikingSpeedMph = 2.5;
        break;
    }

    return Math.round((trailLengthMiles / hikingSpeedMph) * 60);
  }, [trail, trailLengthMiles]);
  // Zooms the map so the full route is visible after its coordinates load.
  useEffect(() => {
    if (routeCoordinates.length < 2 || Platform.OS === "web") return;
    mapRef.current?.fitToCoordinates(routeCoordinates, {
      edgePadding: { top: 45, right: 45, bottom: 45, left: 45 },
      animated: true,
    });
  }, [routeCoordinates]);

  // Scrolls directly to meetups when the user tapped "View Meetups" on a card.
  useEffect(() => {
    if (section === "meetups" && meetupSectionY !== null) {
      scrollRef.current?.scrollTo({ y: meetupSectionY, animated: true });
    }
  }, [meetupSectionY, section]);

  // Opens turn-by-turn walking directions to the selected trailhead.
  // Purpose: Starts navigation.
  async function startNavigation() {
    if (!trail || isStarting) return;
    if (
      !Number.isFinite(trail.latitude) ||
      trail.latitude < -90 ||
      trail.latitude > 90 ||
      !Number.isFinite(trail.longitude) ||
      trail.longitude < -180 ||
      trail.longitude > 180
    ) {
      Alert.alert(
        "Directions unavailable",
        "This trail does not have valid destination coordinates.",
      );
      return;
    }
    if (trail.status !== "open" || !trail.publicAccess) {
      Alert.alert(
        "Trail unavailable",
        "This trail cannot be started while it is closed or restricted.",
      );
      return;
    }
    setIsStarting(true);
    try {
      // Save the destination before Maps backgrounds this app. Mission step
      // credit can then remain paused until the user reaches the trailhead.
      await startTrailActivity(trail, origin ?? undefined);
      await Linking.openURL(getTrailNavigationUrl(trail));
    } catch (navigationError) {
      if (__DEV__)
        console.warn(
          "[Trail details] Maps navigation could not open.",
          navigationError,
        );
      Alert.alert(
        "Navigation unavailable",
        "A maps app could not be opened. Please use the trail address shown above.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  // Records a join request and updates the button so it cannot be sent repeatedly.
  // Purpose: Implements the request join operation.
  async function requestJoin(meetup: TrailMeetup) {
    await requestToJoinMeetup(meetup.id);
    setRequestedMeetupIds((current) => [...new Set([...current, meetup.id])]);
    Alert.alert(
      "Request sent",
      `The host of ${meetup.title} can now review your request.`,
    );
  }

  // Confirms a safety report before calling the future moderation service placeholder.
  // Purpose: Implements the report host operation.
  function reportHost(meetup: TrailMeetup) {
    Alert.alert(
      "Report unsafe behavior?",
      "A future moderated backend will securely review this report.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          // Purpose: Implements the on press operation.
          onPress: () =>
            void reportMeetupHost(meetup.id).then(() =>
              Alert.alert(
                "Report recorded",
                "Thank you for helping keep public meetups safe.",
              ),
            ),
        },
      ],
    );
  }

  // Confirms a block and immediately hides that host's meetup from this screen.
  // Purpose: Implements the block host operation.
  function blockHost(meetup: TrailMeetup) {
    Alert.alert(
      `Block ${meetup.hostName}?`,
      "Their meetup will be hidden from this screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          // Purpose: Implements the on press operation.
          onPress: () =>
            void blockMeetupHost(meetup.id).then(() =>
              setMeetups((current) =>
                current.filter((item) => item.id !== meetup.id),
              ),
            ),
        },
      ],
    );
  }

  // Adds the newly created local meetup to the visible meetup section.
  // Purpose: Creates meetup.
  async function createMeetup(input: CreateMeetupInput) {
    const meetup = await createTrailMeetup(input);
    setMeetups((current) => [meetup, ...current]);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: safeArea.top + 8 }]}>
        <Pressable
          accessibilityLabel="Back to Explore Trails"
          onPress={returnToTrails}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          Trail Details
        </Text>
        <View style={styles.iconButton} />
      </View>

      {isLoading ? (
        <View style={styles.fullState}>
          <ActivityIndicator size="large" color={C.cyan} />
        </View>
      ) : error || !trail ? (
        <View style={styles.fullState}>
          <Ionicons name="warning-outline" size={30} color={C.warning} />
          <Text style={styles.error}>{error ?? "Trail not found."}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: safeArea.bottom + 112 },
            ]}
          >
            <View style={styles.mapWrap}>
              {Platform.OS === "web" ? (
                <View style={styles.mapState}>
                  <Text style={styles.muted}>
                    Route preview maps are available on iOS and Android.
                  </Text>
                </View>
              ) : (
                <MapView
                  ref={mapRef}
                  provider={
                    Platform.OS === "android" ? PROVIDER_GOOGLE : undefined
                  }
                  style={StyleSheet.absoluteFill}
                  userInterfaceStyle="dark"
                  initialRegion={{
                    latitude: trail.latitude,
                    longitude: trail.longitude,
                    latitudeDelta: 0.08,
                    longitudeDelta: 0.08,
                  }}
                >
                  {origin ? (
                    <Marker
                      coordinate={origin}
                      title="Your approximate location"
                      pinColor={C.cyan}
                    />
                  ) : null}
                  <Marker
                    coordinate={{
                      latitude: trail.latitude,
                      longitude: trail.longitude,
                    }}
                    title={trail.startLocation}
                    pinColor={C.magenta}
                  />
                  {routeCoordinates.length > 1 ? (
                    <Polyline
                      coordinates={routeCoordinates}
                      strokeColor={C.cyan}
                      strokeWidth={5}
                    />
                  ) : null}
                </MapView>
              )}
              <View style={styles.routeBadge}>
                <Ionicons name="navigate-outline" size={14} color={C.cyan} />
                <Text style={styles.routeBadgeText}>ROUTE PREVIEW</Text>
              </View>
            </View>

            <View style={styles.mainContent}>
              <Text style={styles.eyebrow}>
                {trail.activityType.toUpperCase()} •{" "}
                {trail.status.toUpperCase()}
              </Text>
              <Text style={styles.title}>{trail.name}</Text>
              <Text style={styles.address}>
                {trail.startLocation} ·{" "}
                {trail.address ?? "Address not provided"}
              </Text>
              <Text style={styles.description}>
                {trail.description ?? "Not provided."}
              </Text>

              <View style={styles.statsRow}>
                <Stat
                  label="Length"
                  value={
                    trailLengthMiles !== null
                      ? `${trailLengthMiles.toFixed(1)} mi`
                      : "Unavailable"
                  }
                />

                <Stat
                  label="Est. time"
                  value={
                    trailEstimatedMinutes !== null
                      ? formatTrailDuration(trailEstimatedMinutes)
                      : "Unavailable"
                  }
                />

                <Stat
                  label="Elevation"
                  value={
                    isElevationLoading
                      ? "Calculating…"
                      : calculatedElevationFeet !== null
                        ? `${Math.round(calculatedElevationFeet)} ft`
                        : "Unavailable"
                  }
                />
              </View>

              {isRouteLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={C.cyan} />
                  <Text style={styles.muted}>Calculating hike directions…</Text>
                </View>
              ) : null}
              {route ? (
                <Text style={styles.routeInfo}>
                  Directions to start: {route.distanceMiles.toFixed(1)} mi ·{" "}
                  {Math.round(route.durationMinutes)} min
                </Text>
              ) : null}
              {routeMessage ? (
                <Text style={styles.warning}>{routeMessage}</Text>
              ) : null}

              <Section title="Trail Intel">
                <Detail
                  icon="speedometer-outline"
                  label="Difficulty"
                  value={capitalize(trail.difficulty)}
                />
                <Detail
                  icon="layers-outline"
                  label="Terrain / surface"
                  value={trail.terrain}
                />
                <Detail
                  icon="accessibility-outline"
                  label="Accessibility"
                  value={trail.accessibility || "Not provided."}
                />
                <Detail
                  icon="paw-outline"
                  label="Pet rules"
                  value={trail.petRules || "Not provided."}
                />
                <Detail
                  icon="people-outline"
                  label="Public access"
                  value={
                    trail.publicAccess
                      ? "Public access is listed."
                      : "Access is restricted."
                  }
                />
              </Section>

              <Section title="Amenities">
                <View style={styles.amenities}>
                  {(
                    [
                      "parking",
                      "restrooms",
                      "water",
                      "pet_friendly",
                    ] as TrailAmenity[]
                  ).map((amenity) => (
                    <Amenity
                      key={amenity}
                      amenity={amenity}
                      available={trail.amenities.includes(amenity)}
                    />
                  ))}
                </View>
              </Section>

              <Section title="Weather & Safety">
                <DailyForecast
                  forecast={forecast}
                  isLoading={isForecastLoading}
                  error={forecastError}
                />
                {trail.safetyNotes.map((note) => (
                  <View key={note} style={styles.safetyLine}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={16}
                      color={C.green}
                    />
                    <Text style={styles.safetyText}>{note}</Text>
                  </View>
                ))}
              </Section>

              <View
                onLayout={(event) =>
                  setMeetupSectionY(event.nativeEvent.layout.y)
                }
              >
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Public Meetups</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create a trail meetup"
                    onPress={() => setShowCreateMeetup(true)}
                    style={styles.createButton}
                  >
                    <Ionicons name="add" size={18} color={C.text} />
                    <Text style={styles.createText}>Create</Text>
                  </Pressable>
                </View>
                <View style={styles.privacyNotice}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={C.cyan}
                  />
                  <Text style={styles.privacyText}>
                    Meet in public, tell someone where you are going, and avoid
                    sharing private information. Other users never see your live
                    location—only the public trail meeting point.
                  </Text>
                </View>
                {meetups.length ? (
                  meetups.map((meetup) => (
                    <TrailMeetupCard
                      key={meetup.id}
                      meetup={meetup}
                      requested={requestedMeetupIds.includes(meetup.id)}
                      onJoin={() => void requestJoin(meetup)}
                      onReport={() => reportHost(meetup)}
                      onBlock={() => blockHost(meetup)}
                    />
                  ))
                ) : (
                  <Text style={styles.emptyMeetups}>
                    No public meetups are scheduled. You can create the first
                    one.
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>

          <View
            style={[styles.footer, { paddingBottom: safeArea.bottom + 12 }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start GPS navigation for this trail"
              disabled={trail.status !== "open" || isStarting}
              onPress={() => void startNavigation()}
              style={[
                styles.startButton,
                (trail.status !== "open" || isStarting) && styles.disabled,
              ]}
            >
              <Ionicons name="navigate" size={19} color={C.text} />
              <Text style={styles.startText}>
                {isStarting
                  ? "Opening Maps…"
                  : trail.status === "closed"
                    ? "Trail Closed"
                    : "Start Navigation"}
              </Text>
            </Pressable>
            <Text style={styles.verificationText}>
              Opens walking directions. Mission steps count once you are within
              0.31 mi of the trailhead.
            </Text>
          </View>

          <CreateMeetupModal
            visible={showCreateMeetup}
            trail={trail}
            onClose={() => setShowCreateMeetup(false)}
            onCreate={createMeetup}
          />
        </>
      )}
    </View>
  );
}

// Gives related detail rows a consistent heading and spacing.
// Purpose: Renders the section interface.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// Displays one quick trail measurement such as length, time, or elevation.
// Purpose: Renders the stat interface.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Displays one labeled trail fact with an icon for easier scanning.
// Purpose: Renders the detail interface.
function Detail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={18} color={C.cyan} />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

// Converts an amenity code into a readable availability badge.
// Purpose: Renders the amenity interface.
function Amenity({
  amenity,
  available,
}: {
  amenity: TrailAmenity;
  available: boolean;
}) {
  const label = (
    {
      parking: "Parking",
      restrooms: "Restrooms",
      water: "Water",
      pet_friendly: "Pet friendly",
    } as const
  )[amenity];
  return (
    <View style={[styles.amenity, !available && styles.unavailableAmenity]}>
      <Ionicons
        name={available ? "checkmark-circle" : "remove-circle-outline"}
        size={16}
        color={available ? C.green : C.textMuted}
      />
      <Text style={styles.amenityText}>
        {label}: {available ? "Yes" : "Not provided"}
      </Text>
    </View>
  );
}

// Purpose: Renders the daily forecast interface.
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
          <Text style={styles.noticeText}>
            {error ?? "Check an official forecast before leaving."}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.weather}>
      <Ionicons
        name={weatherIcon(forecast.weatherCode)}
        size={24}
        color={C.warning}
      />
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>
          {forecast.summary} · {Math.round(forecast.temperatureMaxF)}° /{" "}
          {Math.round(forecast.temperatureMinF)}°
        </Text>
        <Text style={styles.noticeText}>
          Rain {Math.round(forecast.precipitationProbabilityPercent)}% · Wind up
          to {Math.round(forecast.windSpeedMaxMph)} mph · UV{" "}
          {Math.round(forecast.uvIndexMax)}
        </Text>
        <Text style={styles.forecastSource}>
          Today, {formatForecastDate(forecast.date)} · Forecast by Open-Meteo
        </Text>
      </View>
    </View>
  );
}

// Purpose: Implements the weather icon operation.
function weatherIcon(code: number): keyof typeof Ionicons.glyphMap {
  if (code === 0 || code === 1) return "sunny-outline";
  if (code === 2) return "partly-sunny-outline";
  if (code === 3 || code === 45 || code === 48) return "cloudy-outline";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
    return "snow-outline";
  if (code >= 95) return "thunderstorm-outline";
  return "rainy-outline";
}

// Purpose: Formats forecast date.
function formatForecastDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

// Capitalizes stored lowercase labels before showing them to the user.
// Purpose: Implements the capitalize operation.
function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
// Purpose: Calculates trail distance miles.
function calculateTrailDistanceMiles(
  coordinates?: ReadonlyArray<ReadonlyArray<number>>,
): number | null {
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  let totalMiles = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const previous = coordinates[i - 1];
    const current = coordinates[i];

    if (previous.length < 2 || current.length < 2) continue;

    const longitude1 = previous[0];
    const latitude1 = previous[1];
    const longitude2 = current[0];
    const latitude2 = current[1];

    if (
      !Number.isFinite(longitude1) ||
      !Number.isFinite(latitude1) ||
      !Number.isFinite(longitude2) ||
      !Number.isFinite(latitude2)
    ) {
      continue;
    }

    totalMiles += calculateDistanceBetweenPoints(
      latitude1,
      longitude1,
      latitude2,
      longitude2,
    );
  }

  return totalMiles > 0 ? totalMiles : null;
}

// Purpose: Calculates distance between points.
function calculateDistanceBetweenPoints(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
) {
  const earthRadiusMiles = 3958.8;
  // Purpose: Implements the to radians operation.
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDifference = toRadians(latitude2 - latitude1);
  const longitudeDifference = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

// Purpose: Formats trail duration.
function formatTrailDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}
// Purpose: Calculates trail elevation gain.
async function calculateTrailElevationGain(
  coordinates: [number, number][],
): Promise<number | null> {
  if (coordinates.length < 2) {
    return null;
  }

  const maximumPoints = 50;

  let sampledCoordinates: [number, number][];

  if (coordinates.length <= maximumPoints) {
    sampledCoordinates = coordinates;
  } else {
    sampledCoordinates = [];

    const step = (coordinates.length - 1) / (maximumPoints - 1);

    for (let i = 0; i < maximumPoints; i++) {
      const index = Math.round(i * step);
      const coordinate = coordinates[index];

      if (coordinate) {
        sampledCoordinates.push(coordinate);
      }
    }
  }

  const latitudes = sampledCoordinates
    .map(([, latitude]) => latitude)
    .join(",");

  const longitudes = sampledCoordinates
    .map(([longitude]) => longitude)
    .join(",");

  const url =
    "https://api.open-meteo.com/v1/elevation" +
    `?latitude=${encodeURIComponent(latitudes)}` +
    `&longitude=${encodeURIComponent(longitudes)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Elevation request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    elevation?: number[];
  };

  if (!Array.isArray(data.elevation) || data.elevation.length < 2) {
    return null;
  }

  let elevationGainMeters = 0;

  for (let i = 1; i < data.elevation.length; i++) {
    const previousElevation = data.elevation[i - 1];
    const currentElevation = data.elevation[i];

    if (
      typeof previousElevation !== "number" ||
      typeof currentElevation !== "number"
    ) {
      continue;
    }

    const gain = currentElevation - previousElevation;

    if (gain > 0) {
      elevationGainMeters += gain;
    }
  }

  return elevationGainMeters * 3.28084;
}
// Uses native Apple Maps on iOS and Google Maps directions everywhere else.
// Purpose: Returns trail navigation url.
function getTrailNavigationUrl(trail: Trail) {
  const destination = `${trail.latitude},${trail.longitude}`;
  if (Platform.OS === "ios") {
    return `http://maps.apple.com/?daddr=${destination}&q=${encodeURIComponent(trail.name)}&dirflg=w`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking&dir_action=navigate`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  header: {
    minHeight: 94,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0E0618",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: "900" },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fullState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 30,
  },
  content: { backgroundColor: C.background },
  mapWrap: { height: 300, backgroundColor: "#10162B" },
  mapState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  routeBadge: {
    position: "absolute",
    left: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.cyan,
    backgroundColor: "rgba(5,0,12,0.88)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  routeBadgeText: {
    color: C.text,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  mainContent: { padding: 20 },
  eyebrow: {
    color: C.magenta,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: { color: C.text, fontSize: 28, fontWeight: "900", marginTop: 5 },
  address: { color: C.cyan, fontSize: 11, lineHeight: 17, marginTop: 7 },
  description: {
    color: "#EEE5F5",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 15,
  },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 20 },
  stat: {
    flex: 1,
    minHeight: 78,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 7,
  },
  statValue: {
    color: C.cyan,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    marginTop: 14,
  },
  muted: { color: C.textMuted, fontSize: 12, textAlign: "center" },
  routeInfo: { color: C.green, fontSize: 11, fontWeight: "800", marginTop: 12 },
  warning: { color: C.warning, fontSize: 11, lineHeight: 17, marginTop: 12 },
  error: {
    color: C.warning,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  section: { marginTop: 26 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
  detail: {
    flexDirection: "row",
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#281736",
    paddingVertical: 12,
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailValue: { color: C.text, fontSize: 13, lineHeight: 19, marginTop: 4 },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#295C47",
    backgroundColor: "#0D241B",
    paddingHorizontal: 10,
  },
  unavailableAmenity: { borderColor: C.border, backgroundColor: C.surface },
  amenityText: { color: C.text, fontSize: 10, fontWeight: "700" },
  weather: {
    flexDirection: "row",
    gap: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#594421",
    backgroundColor: "#251B0C",
    padding: 13,
    marginBottom: 10,
  },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: "#FFE2A9", fontSize: 12, fontWeight: "900" },
  noticeText: { color: "#D9C7A4", fontSize: 11, lineHeight: 17, marginTop: 3 },
  forecastSource: {
    color: "#A99B7E",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 5,
  },
  safetyLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 7,
  },
  safetyText: { flex: 1, color: C.textMuted, fontSize: 12, lineHeight: 18 },
  createButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#702288",
    paddingHorizontal: 14,
  },
  createText: { color: C.text, fontSize: 11, fontWeight: "900" },
  privacyNotice: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#24556B",
    backgroundColor: "#0C202A",
    padding: 13,
    marginBottom: 12,
  },
  privacyText: { flex: 1, color: "#BEE9F3", fontSize: 11, lineHeight: 17 },
  emptyMeetups: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 20,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: "rgba(5,0,12,0.97)",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  startButton: {
    minHeight: 50,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#73258C",
    borderWidth: 1,
    borderColor: C.magenta,
  },
  disabled: { opacity: 0.42 },
  startText: { color: C.text, fontSize: 14, fontWeight: "900" },
  verificationText: {
    color: C.textMuted,
    fontSize: 9,
    textAlign: "center",
    marginTop: 6,
  },
});
