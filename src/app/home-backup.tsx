// =======================
// IMPORTS
// =======================
// These are the tools this screen needs.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type LatLng,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NeonIconName = React.ComponentProps<typeof Ionicons>['name'];
type AppRouter = ReturnType<typeof useRouter>;

const screen = Dimensions.get('window');
const isSmallPhone = screen.height < 740 || screen.width < 380;
const sidePadding = isSmallPhone ? 9 : 12;
const tabBarHeight = isSmallPhone ? 72 : 82;

// =======================
// IMAGES
// =======================
// These are my bottom tab icons.
const tabImages = {
  home: require('../../assets/images/tabIcons/homemain.png'),
  mission: require('../../assets/images/tabIcons/mission.png'),
  trails: require('../../assets/images/tabIcons/trails.png'),
  vault: require('../../assets/images/tabIcons/vault.png'),
  profile: require('../../assets/images/tabIcons/profile.png'),
  companion: require('../../assets/images/tabIcons/companion.png'),
};

const auraOptions = [
  { name: 'Cosmic Rose', emoji: '💗', color: '#FF4FD8' },
  { name: 'Cosmic Sapphire', emoji: '💙', color: '#3B82F6' },
  { name: 'Cosmic Nebula', emoji: '💜', color: '#A855F7' },
  { name: 'Emerald Star', emoji: '💚', color: '#22C55E' },
  { name: 'Solar Gold', emoji: '💛', color: '#FACC15' },
  { name: 'Lunar Cyan', emoji: '🩵', color: '#22D3EE' },
] as const;

const footprintOptions = [
  { name: 'Aries', source: require('../../assets/images/tabIcons/footprints/aries.png') },
  { name: 'Cancer', source: require('../../assets/images/tabIcons/footprints/cancer.png') },
  { name: 'Capricorn', source: require('../../assets/images/tabIcons/footprints/capricorn.png') },
  { name: 'Gemini', source: require('../../assets/images/tabIcons/footprints/gemini.png') },
  { name: 'Leo', source: require('../../assets/images/tabIcons/footprints/leo.png') },
  { name: 'Pisces', source: require('../../assets/images/tabIcons/footprints/pisces.png') },
  { name: 'Sagittarius', source: require('../../assets/images/tabIcons/footprints/sagittarius.png') },
  { name: 'Scorpion', source: require('../../assets/images/tabIcons/footprints/scorpion.png') },
  { name: 'Taurus', source: require('../../assets/images/tabIcons/footprints/taraus.png') },
] as const;

const bottomTabs = [
  { key: 'home', label: 'Home', image: tabImages.home },
  { key: 'mission', label: 'Mission', image: tabImages.mission },
  { key: 'trails', label: 'Trails', image: tabImages.trails },
  { key: 'vault', label: 'Vault', image: tabImages.vault },
  { key: 'profile', label: 'Profile', image: tabImages.profile },
  { key: 'companion', label: 'Compan...', image: tabImages.companion },
] as const;

const mapButtons = [
  { icon: 'add' as NeonIconName, label: 'Zoom in' },
  { icon: 'remove' as NeonIconName, label: 'Zoom out' },
  { icon: 'locate' as NeonIconName, label: 'Current location' },
] as const;

// 20 MPH limit. If they move faster, tracking pauses.
const WARNING_SPEED_MPH = 15;

const WARNING_SPEED_MPS = WARNING_SPEED_MPH * 0.44704;

// This is the first map spot before GPS loads.
const startingMapRegion: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

// This makes the map dark and neon.
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#050518' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#c9d7ff' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#050518' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1b1b3f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#4c2a91' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#20204f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#06143f' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0b3b36' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// =======================+
// HOME SCREEN
// =======================+
// This is the main screen for the map.
export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const safeArea = useSafeAreaInsets();

  const [mapRegion, setMapRegion] = useState<Region>(startingMapRegion);
  const [gpsPoints, setGpsPoints] = useState<Location.LocationObject[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isMovingTooFast, setIsMovingTooFast] = useState(false);
  const [, setIsTracking] = useState(true);
  const [selectedAura, setSelectedAura] = useState<(typeof auraOptions)[number]>(auraOptions[2]);
  const [isAuraModalOpen, setIsAuraModalOpen] = useState(false);
  const [selectedFootprint, setSelectedFootprint] = useState<(typeof footprintOptions)[number]>(footprintOptions[0]);
  const [isFootprintModalOpen, setIsFootprintModalOpen] = useState(false);

  const latestGpsPoint = getLatestGpsPoint(gpsPoints);
  const walkedMiles = useMemo(() => getTotalMiles(gpsPoints), [gpsPoints]);
  const liveStats = getLiveStats(walkedMiles);
  const currentSpeedMph = getSpeedMph(latestGpsPoint);
  const mapCoordinates = gpsPoints.map(makeMapCoordinate);
  // This saves a good walking point.
  function saveGoodGpsPoint(point: Location.LocationObject) {
    setMapRegion(makeMapRegion(point));
    setGpsPoints((oldPoints) => [...oldPoints.slice(-59), point]);
  }

  // This starts the GPS when the screen opens.
  useEffect(() => {
    let locationWatcher: Location.LocationSubscription | undefined;

    async function startGpsTracking() {
      const canUseLocation = await askForLocationPermission();

      if (!canUseLocation) {
        setLocationError('Location permission is needed to track missions.');
        return;
      }

      const firstLocation = await getFirstLocation();
      saveGoodGpsPoint(firstLocation);

      locationWatcher = await watchLiveLocation((newLocation) => {
        const tooFast = isOverSpeedLimit(newLocation);

        setIsMovingTooFast(tooFast);
        setIsTracking(!tooFast);
        setMapRegion(makeMapRegion(newLocation));

        if (!tooFast) {
          saveGoodGpsPoint(newLocation);
        }
      });
    }

    startGpsTracking();

    return () => {
      locationWatcher?.remove();
    };
  }, []);

  // This brings the map back to my location.
  function centerMapOnUser() {
    if (!latestGpsPoint) return;
    mapRef.current?.animateToRegion(makeMapRegion(latestGpsPoint), 500);
  }

  // This zooms the map in or out.
  function zoomMap(zoomAmount: number) {
    const nextRegion = {
      ...mapRegion,
      latitudeDelta: Math.max(0.002, Math.min(0.08, mapRegion.latitudeDelta * zoomAmount)),
      longitudeDelta: Math.max(0.002, Math.min(0.08, mapRegion.longitudeDelta * zoomAmount)),
    };

    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 250);
  }

  // This opens the leaderboard screen when the user taps the trophy button.
  function openLeaderboard() {
    router.push('/leaderboard');
  }

  // This opens the aura picker popup.
  function openAuraModal() {
    setIsAuraModalOpen(true);
  }

  // This saves the selected aura color and closes the popup.
  function selectAura(aura: (typeof auraOptions)[number]) {
    setSelectedAura(aura);
    setIsAuraModalOpen(false);
  }

  // This opens the footprint picker popup.
  function openFootprintModal() {
    setIsFootprintModalOpen(true);
  }

  // This saves the selected footprint image and closes the popup.
  function selectFootprint(footprint: (typeof footprintOptions)[number]) {
    setSelectedFootprint(footprint);
    setIsFootprintModalOpen(false);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={darkMapStyle}
        region={mapRegion}
        userInterfaceStyle="dark"
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        rotateEnabled
        pitchEnabled
        onRegionChangeComplete={(region: Region) => setMapRegion(region)}
      >
        {renderWalkedPath(mapCoordinates)}
        {renderFootprintMarkers(mapCoordinates, selectedAura.color, selectedFootprint)}
        {renderUserGlow(latestGpsPoint, selectedAura.color, selectedFootprint)}
      </MapView>

      <View style={styles.cosmicOverlay} pointerEvents="none" />

      <View
        style={[
          styles.fixedOverlay,
          {
            paddingTop: safeArea.top,
            paddingBottom: safeArea.bottom,
          },
        ]}
      >
        <View style={[styles.topOverlay, { top: safeArea.top + 4 }]}>
          {renderHeader(openLeaderboard)}
          {renderTopStatsCard(liveStats)}
          {renderWarningCard(isMovingTooFast, locationError)}
        </View>

        {/* This keeps the speed widget above the navigation bar. */}
        <View style={[styles.bottomMapWidgets, { bottom: safeArea.bottom + tabBarHeight + 28 }]}>
          {/* This moves the speed widget to the bottom left corner of the map. */}
          {renderSpeedWidget(currentSpeedMph, isMovingTooFast)}
          {renderCurrentMissionCard()}
        </View>

        <View style={styles.floatingButtons}>
          {mapButtons.map((button) => (
            <Pressable
              key={button.label}
              accessibilityLabel={button.label}
              style={({ pressed }) => [styles.floatingButton, pressed && styles.pressed]}
              onPress={() => {
                if (button.label === 'Zoom in') zoomMap(0.65);
                if (button.label === 'Zoom out') zoomMap(1.45);
                if (button.label === 'Current location') centerMapOnUser();
              }}
            >
              <Ionicons name={button.icon} size={isSmallPhone ? 19 : 21} color="#d9f7ff" />
            </Pressable>
          ))}
        </View>

        <View style={styles.mapStyleButtons}>
          {renderAuraButton(openAuraModal, selectedAura.color)}
          {renderFootprintButton(openFootprintModal, selectedAura.color)}
        </View>
        {renderAuraModal(isAuraModalOpen, selectedAura, selectAura, () => setIsAuraModalOpen(false))}
        {renderFootprintModal(
          isFootprintModalOpen,
          selectedFootprint,
          selectFootprint,
          () => setIsFootprintModalOpen(false),
          selectedAura.color
        )}

        <View style={[styles.bottomOverlay, { bottom: safeArea.bottom + 10 }]}>
          {renderBottomTabBar(router)}
        </View>
      </View>
    </View>
  );
}

// This asks the user for GPS permission.
async function askForLocationPermission() {
  const permission = await Location.requestForegroundPermissionsAsync();
  return permission.status === Location.PermissionStatus.GRANTED;
}

// This gets my first GPS location.
async function getFirstLocation() {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}

// This watches my location while I move.
function watchLiveLocation(onLocationChange: (location: Location.LocationObject) => void) {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 6,
      timeInterval: 2500,
    },
    onLocationChange
  );
}

// This checks if someone is moving too fast.
function isOverSpeedLimit(location: Location.LocationObject) {
  const speed = location.coords.speed ?? 0;
  return speed > WARNING_SPEED_MPS;
}

// This changes GPS speed into MPH.
function getSpeedMph(location?: Location.LocationObject) {
  if (!location?.coords.speed || location.coords.speed < 0) return 0;
  return location.coords.speed * 2.23694;
}

// This makes the top numbers.
function getLiveStats(walkedMiles: number) {
  return {
    distance: walkedMiles.toFixed(2),
    steps: Math.max(0, Math.round(walkedMiles * 2200)).toLocaleString(),
    items: '2/5',
  };
}

// This gets the newest GPS point.
function getLatestGpsPoint(points: Location.LocationObject[]) {
  return points[points.length - 1];
}

// This adds up my walked miles.
function getTotalMiles(points: Location.LocationObject[]) {
  let totalMeters = 0;

  for (let index = 1; index < points.length; index += 1) {
    totalMeters += getMetersBetweenPoints(points[index - 1], points[index]);
  }

  return totalMeters / 1609.344;
}

// This finds distance between two GPS points.
function getMetersBetweenPoints(start: Location.LocationObject, end: Location.LocationObject) {
  const earthRadiusMeters = 6371000;
  const startLat = toRadians(start.coords.latitude);
  const endLat = toRadians(end.coords.latitude);
  const latChange = toRadians(end.coords.latitude - start.coords.latitude);
  const longChange = toRadians(end.coords.longitude - start.coords.longitude);

  const halfChordLength =
    Math.sin(latChange / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(longChange / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(halfChordLength), Math.sqrt(1 - halfChordLength));
}

// This helps the GPS math work.
function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

// This makes the map camera follow me.
function makeMapRegion(location: Location.LocationObject): Region {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };
}

// This turns GPS data into map coordinates.
function makeMapCoordinate(location: Location.LocationObject): LatLng {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

// This draws the pink trail line.
function renderWalkedPath(coordinates: ReturnType<typeof makeMapCoordinate>[]) {
  if (coordinates.length <= 1) return null;

  return (
    <>
      <Polyline coordinates={coordinates} strokeColor="rgba(168, 85, 247, 0.35)" strokeWidth={8} />
      <Polyline coordinates={coordinates} strokeColor="#ff63f7" strokeWidth={3} />
    </>
  );
}

// This drops small footprint markers with the selected aura glow.
function renderFootprintMarkers(
  coordinates: ReturnType<typeof makeMapCoordinate>[],
  auraColor: string,
  selectedFootprint: (typeof footprintOptions)[number]
) {
  return coordinates.map((coordinate, index) => (
    <Marker
      key={`${coordinate.latitude}-${coordinate.longitude}-${index}`}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View
        style={[
          styles.mapFootprintGlow,
          {
            backgroundColor: getAuraGlowBackground(auraColor),
            shadowColor: auraColor,
          },
        ]}
      >
        <Image source={selectedFootprint.source} style={styles.mapFootprintImage} resizeMode="contain" />
      </View>
    </Marker>
  ));
}

// This shows my current location with the selected aura glow and footprint image.
function renderUserGlow(
  location: Location.LocationObject | undefined,
  auraColor: string,
  selectedFootprint: (typeof footprintOptions)[number]
) {
  if (!location) return null;

  return (
    <Marker coordinate={makeMapCoordinate(location)} anchor={{ x: 0.5, y: 0.5 }}>
      <View
        style={[
          styles.currentFootprintGlow,
          {
            backgroundColor: getAuraGlowBackground(auraColor),
            shadowColor: auraColor,
          },
        ]}
      >
        <Image source={selectedFootprint.source} style={styles.currentFootprintImage} resizeMode="contain" />
      </View>
    </Marker>
  );
}

// This makes a soft transparent background from the selected aura color.
// Increase for stronger glow, decrease for subtler effect.
function getAuraGlowBackground(auraColor: string) {
  return `${auraColor}55`;
}

// This shows the small floating aura button on the map.
function renderAuraButton(openAuraModal: () => void, auraColor: string) {
  return (
    <Pressable
      accessibilityLabel="Open aura color picker"
      style={({ pressed }) => [
        styles.auraButton,
        {
          borderColor: auraColor,
          shadowColor: auraColor,
        },
        pressed && styles.pressed,
      ]}
      onPress={openAuraModal}
    >
      <Ionicons name="color-palette" size={isSmallPhone ? 19 : 21} color={auraColor} />
    </Pressable>
  );
}

// This shows the small floating footprint button on the map.
function renderFootprintButton(openFootprintModal: () => void, auraColor: string) {
  return (
    <Pressable
      accessibilityLabel="Open footprint style picker"
      style={({ pressed }) => [
        styles.auraButton,
        {
          borderColor: auraColor,
          shadowColor: auraColor,
        },
        pressed && styles.pressed,
      ]}
      onPress={openFootprintModal}
    >
      <Ionicons name="footsteps" size={isSmallPhone ? 19 : 21} color={auraColor} />
    </Pressable>
  );
}

// This shows the popup where the user chooses an aura color.
function renderAuraModal(
  isAuraModalOpen: boolean,
  selectedAura: (typeof auraOptions)[number],
  selectAura: (aura: (typeof auraOptions)[number]) => void,
  closeAuraModal: () => void
) {
  return (
    <Modal visible={isAuraModalOpen} transparent animationType="fade" onRequestClose={closeAuraModal}>
      <View style={styles.auraModalBackdrop}>
        <View style={styles.auraModalCard}>
          <Text style={styles.auraModalTitle}>Choose Your Cosmic Aura</Text>

          <View style={styles.auraOptionGrid}>
            {auraOptions.map((aura) => renderAuraOption(aura, selectedAura, selectAura))}
          </View>

          <Pressable style={({ pressed }) => [styles.auraCloseButton, pressed && styles.pressed]} onPress={closeAuraModal}>
            <Text style={styles.auraCloseText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// This shows the popup where the user chooses a zodiac footprint image.
function renderFootprintModal(
  isFootprintModalOpen: boolean,
  selectedFootprint: (typeof footprintOptions)[number],
  selectFootprint: (footprint: (typeof footprintOptions)[number]) => void,
  closeFootprintModal: () => void,
  auraColor: string
) {
  return (
    <Modal visible={isFootprintModalOpen} transparent animationType="fade" onRequestClose={closeFootprintModal}>
      <View style={styles.auraModalBackdrop}>
        <View style={styles.auraModalCard}>
          <Text style={styles.auraModalTitle}>Choose Your Footprint</Text>

          <View style={styles.auraOptionGrid}>
            {footprintOptions.map((footprint) => renderFootprintOption(footprint, selectedFootprint, selectFootprint, auraColor))}
          </View>

          <Pressable style={({ pressed }) => [styles.auraCloseButton, pressed && styles.pressed]} onPress={closeFootprintModal}>
            <Text style={styles.auraCloseText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// This shows one zodiac footprint choice inside the popup.
function renderFootprintOption(
  footprint: (typeof footprintOptions)[number],
  selectedFootprint: (typeof footprintOptions)[number],
  selectFootprint: (footprint: (typeof footprintOptions)[number]) => void,
  auraColor: string
) {
  const isSelected = footprint.name === selectedFootprint.name;

  return (
    <Pressable
      key={footprint.name}
      style={({ pressed }) => [
        styles.auraOptionCard,
        {
          borderColor: isSelected ? auraColor : 'rgba(168, 85, 247, 0.35)',
          shadowColor: auraColor,
        },
        pressed && styles.pressed,
      ]}
      onPress={() => selectFootprint(footprint)}
    >
      <Image source={footprint.source} style={styles.footprintOptionImage} resizeMode="contain" />
      <Text style={styles.auraName}>{footprint.name}</Text>
    </Pressable>
  );
}

// This shows one aura color choice inside the popup.
function renderAuraOption(
  aura: (typeof auraOptions)[number],
  selectedAura: (typeof auraOptions)[number],
  selectAura: (aura: (typeof auraOptions)[number]) => void
) {
  const isSelected = aura.name === selectedAura.name;

  return (
    <Pressable
      key={aura.name}
      style={({ pressed }) => [
        styles.auraOptionCard,
        {
          borderColor: isSelected ? aura.color : 'rgba(168, 85, 247, 0.35)',
          shadowColor: aura.color,
        },
        pressed && styles.pressed,
      ]}
      onPress={() => selectAura(aura)}
    >
      <Text style={styles.auraEmoji}>{aura.emoji}</Text>
      <Text style={styles.auraName}>{aura.name}</Text>
    </Pressable>
  );
}

// This shows the top title and the leaderboard trophy button.
function renderHeader(openLeaderboard: () => void) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        accessibilityLabel="Open leaderboard"
        style={({ pressed }) => [styles.leaderboardButton, pressed && styles.pressed]}
        onPress={openLeaderboard}
      >
        <Ionicons name="trophy" size={isSmallPhone ? 17 : 19} color="#facc15" />
      </Pressable>

      <View style={styles.logoOrbit}>
        <Ionicons name="planet-outline" size={isSmallPhone ? 21 : 24} color="#ff68f4" />
      </View>

      <Text style={styles.headerTitle}>MISSION TRAIL</Text>

      <View style={styles.bellWrap}>
        <Ionicons name="notifications-outline" size={isSmallPhone ? 18 : 20} color="#ffffff" />
        <View style={styles.notificationDot}>
          <Text style={styles.notificationText}>3</Text>
        </View>
      </View>
    </View>
  );
}

// This shows the simple stats card.
function renderTopStatsCard(liveStats: ReturnType<typeof getLiveStats>) {
  const stats = [
    {
      label: 'Distance',
      value: liveStats.distance,
      unit: 'mi',
      icon: 'location-outline' as NeonIconName,
      color: '#00e5ff',
    },
    {
      label: 'Steps',
      value: liveStats.steps,
      unit: 'steps',
      icon: 'footsteps-outline' as NeonIconName,
      color: '#ff63f7',
    },
    {
      label: 'Items',
      value: liveStats.items,
      unit: 'found',
      icon: 'gift-outline' as NeonIconName,
      color: '#a855f7',
    },
  ];

  return (
    <View style={styles.statsCard}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.statItem}>
          <View style={styles.statLabelRow}>
            <Ionicons name={stat.icon} size={13} color={stat.color} />
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>

          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statUnit}>{stat.unit}</Text>
        </View>
      ))}
    </View>
  );
}

// This shows a warning if GPS is blocked or moving too fast.
function renderWarningCard(isMovingTooFast: boolean, locationError: string | null) {
  if (!isMovingTooFast && !locationError) return null;

  return (
    <View style={styles.warningCard}>
      <Ionicons name="warning-outline" size={21} color="#ffffff" />

      <View style={styles.warningCopy}>
        <Text style={styles.warningTitle}>
          {locationError ? 'Location blocked' : 'Movement too fast'}
        </Text>

        <Text style={styles.warningText}>
          {locationError ?? 'Driving is not allowed. Slow down to continue tracking.'}
        </Text>
      </View>
    </View>
  );
}

// This makes the widget stay fixed while the map moves underneath.
function renderSpeedWidget(currentSpeedMph: number, isMovingTooFast: boolean) {
  return (
    <View style={styles.speedWidget}>
      <Text style={styles.speedWidgetLabel}>Current MPH</Text>
      <Text style={styles.speedWidgetValue}>{currentSpeedMph.toFixed(1)}</Text>
      <Text style={styles.speedWidgetStatus}>{isMovingTooFast ? 'Driving speed' : 'Walking speed'}</Text>
    </View>
  );
}
// This shows the user's current mission.
function renderCurrentMissionCard() {
  const missionProgress = 47;

  return (
    <View style={styles.currentMissionCard}>
      <Text style={styles.missionTitle}>
        CURRENT MISSION
      </Text>

      <Text style={styles.missionName}>
        Urban Explorer
      </Text>

      <Text style={styles.missionProgress}>
        2.35 km of 5 km • {missionProgress}%
      </Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${missionProgress}%` },
          ]}
        />
      </View>
    </View>
  );
}

// This shows the bottom navigation bar.
function renderBottomTabBar(router: AppRouter) {
  return (
    <View style={styles.tabBar}>
      {bottomTabs.map((tab) => {

        const isActiveTab = tab.key === 'home';

        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tabButton,
              pressed && styles.pressed
            ]}

            onPress={() => {
              if (tab.key === 'home') router.push('/home-backup');
              if (tab.key === 'mission') router.push('/mission');
              if (tab.key === 'trails') router.push('/trails');
              if (tab.key === 'vault') router.push('/vault');
              if (tab.key === 'profile') router.push('/profile');
              if (tab.key === 'companion') router.push('/companion');
            }}
          >
            <View
              style={[
                styles.tabIconWrap,
                isActiveTab && styles.activeTabIconWrap
              ]}
            >
              <Image
                source={tab.image}
                style={styles.tabIcon}
                resizeMode="contain"
              />
            </View>

            <Text
              style={[
                styles.tabLabel,
                isActiveTab && styles.activeTabLabel
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>

          </Pressable>
        );
      })}
    </View>
  );
}

// =======================+
// STYLES
// =======================+
// This controls how everything looks.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },

  cosmicOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(18, 10, 46, 0.18)',
  },

  fixedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: sidePadding,
  },

  topOverlay: {
    position: 'absolute',
    left: sidePadding,
    right: sidePadding,
    gap: 6,
  },

  bottomOverlay: {
    position: 'absolute',
    left: sidePadding,
    right: sidePadding,
  },

  headerBar: {
    height: isSmallPhone ? 30 : 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  logoOrbit: {
    width: isSmallPhone ? 25 : 28,
    height: isSmallPhone ? 25 : 28,
    borderRadius: isSmallPhone ? 13 : 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.6)',
    backgroundColor: 'rgba(86, 19, 216, 0.18)',
  },

  // This keeps the trophy button small so it does not cover the map.
  leaderboardButton: {
    position: 'absolute',
    left: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.7)',
    backgroundColor: 'rgba(15, 7, 39, 0.9)',
    shadowColor: '#facc15',
    shadowOpacity: 0.42,
    shadowRadius: 8,
    elevation: 8,
  },

  headerTitle: {
    color: '#ffffff',
    fontSize: isSmallPhone ? 14 : 16,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1.2,
    textShadowColor: '#a855f7',
    textShadowRadius: 7,
  },

  bellWrap: {
    position: 'absolute',
    right: 4,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationDot: {
    position: 'absolute',
    right: 5,
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff2d75',
  },

  notificationText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },

  statsCard: {
    minHeight: isSmallPhone ? 50 : 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a855f7',
    backgroundColor: 'rgba(8, 5, 28, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    shadowColor: '#a855f7',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderRightColor: 'rgba(168, 85, 247, 0.18)',
  },

  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  statLabel: {
    color: '#ffffff',
    fontSize: isSmallPhone ? 7 : 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  statValue: {
    color: '#ffffff',
    fontSize: isSmallPhone ? 14 : 16,
    fontWeight: '900',
  },

  statUnit: {
    color: '#d9ddff',
    fontSize: isSmallPhone ? 7 : 8,
    fontWeight: '700',
  },

  warningCard: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ff2d75',
    backgroundColor: 'rgba(65, 6, 26, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },

  warningCopy: {
    flex: 1,
    gap: 2,
  },

  warningTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },

  warningText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },

  mapCenterBadge: {
    flex: 1,
    minHeight: isSmallPhone ? 42 : 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.5)',
    backgroundColor: 'rgba(3, 2, 18, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00e5ff',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  currentMissionCard: {
  flex: 1,
  minHeight: 62,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: 'rgba(168, 85, 247, 0.6)',
  backgroundColor: 'rgba(6, 4, 26, 0.95)',
  paddingHorizontal: 14,
  paddingVertical: 10,
  justifyContent: 'center',
  shadowColor: '#a855f7',
  shadowOpacity: 0.45,
  shadowRadius: 10,
  elevation: 8,
},

missionTitle: {
  color: '#74eaff',
  fontSize: 9,
  fontWeight: '900',
  letterSpacing: 1,
},

missionName: {
  color: '#ffffff',
  fontSize: 15,
  fontWeight: '900',
},

missionProgress: {
  color: '#d9ddff',
  fontSize: 10,
  fontWeight: '700',
  marginTop: 2,
},

progressTrack: {
  height: 6,
  borderRadius: 999,
  backgroundColor: 'rgba(255,255,255,0.12)',
  marginTop: 8,
  overflow: 'hidden',
},

progressFill: {
  height: '100%',
  borderRadius: 999,
  backgroundColor: '#a855f7',
},

  mapCenterTitle: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  mapCenterText: {
    color: '#74eaff',
    fontSize: 9,
    fontWeight: '700',
  },

  // This holds the speed widget and GPS pill in one fixed bottom row.
  bottomMapWidgets: {
    position: 'absolute',
    left: sidePadding,
    right: sidePadding,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: isSmallPhone ? 7 : 9,
  },

  // This keeps the speed widget compact like the reference screenshot.
  speedWidget: {
    minWidth: isSmallPhone ? 104 : 116,
    maxWidth: isSmallPhone ? 112 : 128,
    minHeight: isSmallPhone ? 52 : 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.72)',
    backgroundColor: 'rgba(10, 4, 32, 0.9)',
    paddingHorizontal: isSmallPhone ? 10 : 12,
    paddingVertical: isSmallPhone ? 7 : 8,
    justifyContent: 'center',
    shadowColor: '#d946ef',
    shadowOpacity: 0.48,
    shadowRadius: 9,
    elevation: 8,
  },

  // This makes the speed label small so the MPH number stays readable.
  speedWidgetLabel: {
    color: '#d9ddff',
    fontSize: isSmallPhone ? 7 : 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  // This keeps the live MPH number bold and easy to scan.
  speedWidgetValue: {
    color: '#ffffff',
    fontSize: isSmallPhone ? 19 : 22,
    fontWeight: '900',
    lineHeight: isSmallPhone ? 22 : 25,
    textShadowColor: '#d946ef',
    textShadowRadius: 7,
  },

  // This shows whether the current pace is walking or driving speed.
  speedWidgetStatus: {
    color: '#ff63f7',
    fontSize: isSmallPhone ? 8 : 9,
    fontWeight: '800',
  },

  floatingButtons: {
    position: 'absolute',
    right: sidePadding,
    top: '39%',
    gap: 15,
  },

  floatingButton: {
    width: isSmallPhone ? 40 : 44,
    height: isSmallPhone ? 40 : 44,
    borderRadius: isSmallPhone ? 20 : 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d946ef',
    backgroundColor: 'rgba(15, 7, 39, 0.92)',
    shadowColor: '#d946ef',
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 8,
  },

  mapStyleButtons: {
    position: 'absolute',
    right: sidePadding,
    top: '62%',
    gap: 10,
  },

  auraButton: {
    width: isSmallPhone ? 40 : 44,
    height: isSmallPhone ? 40 : 44,
    borderRadius: isSmallPhone ? 20 : 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(15, 7, 39, 0.92)',
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 8,
  },

  auraModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(3, 2, 18, 0.72)',
  },

  auraModalCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.65)',
    backgroundColor: 'rgba(6, 4, 26, 0.97)',
    padding: 16,
    shadowColor: '#a855f7',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },

  auraModalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: '#a855f7',
    textShadowRadius: 8,
  },

  auraOptionGrid: {
    marginTop: 14,
    gap: 10,
  },

  auraOptionCard: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: 'rgba(10, 4, 32, 0.9)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  auraEmoji: {
    fontSize: 22,
  },

  auraName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  footprintOptionImage: {
    width: 32,
    height: 32,
  },

  auraCloseButton: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(116, 234, 255, 0.4)',
    backgroundColor: 'rgba(3, 2, 18, 0.82)',
  },

  auraCloseText: {
    color: '#74eaff',
    fontSize: 13,
    fontWeight: '900',
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },

  mapFootprintGlow: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 99, 247, 0.12)',
    shadowColor: '#ff63f7',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 7,
  },

  mapFootprintImage: {
    width: 92,
    height: 92,
  },

  currentFootprintGlow: {
    width: 102,
    height: 102,
    borderRadius: 51,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 99, 247, 0.16)',
    shadowColor: '#ff63f7',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 9,
  },

  currentFootprintImage: {
    width: 118,
    height: 118,
  },

  tabBar: {
    minHeight: tabBarHeight,
    maxHeight: tabBarHeight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6d28d9',
    backgroundColor: 'rgba(6, 4, 26, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#a855f7',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 9,
  },

  tabButton: {
    flex: 1,
    minWidth: 0,
    height: tabBarHeight - 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  tabIconWrap: {
    width: isSmallPhone ? 38 : 44,
    height: isSmallPhone ? 38 : 44,
    borderRadius: isSmallPhone ? 19 : 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeTabIconWrap: {
    borderWidth: 1,
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(86, 19, 216, 0.32)',
  },

  tabIcon: {
    width: isSmallPhone ? 61 : 56,
    height: isSmallPhone ? 61 : 56,
  },

  tabLabel: {
    color: '#ffffff',
    fontSize: isSmallPhone ? 9 : 10,
    fontWeight: '800',
  },

  activeTabLabel: {
    color: '#00e5ff',
  },
});
