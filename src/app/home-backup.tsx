// =======================
// IMPORTS
// =======================
// These are the tools this screen needs.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    Dimensions,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

let MapView: any = View;
let Marker: any = View;
let Polyline: any = View;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');

  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NeonIconName = React.ComponentProps<typeof Ionicons>['name'];
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
  map: require('../../assets/images/tabIcons/map.png'),
  mission: require('../../assets/images/tabIcons/mission.png'),
  trails: require('../../assets/images/tabIcons/trails.png'),
  vault: require('../../assets/images/tabIcons/vault.png'),
  profile: require('../../assets/images/tabIcons/profile.png'),
  companion: require('../../assets/images/tabIcons/companion.png'),
};

// This is my glowing footprint image.
const currentLocationFootprint = require('../../assets/images/glowing-footprint.png');

const bottomTabs = [
  { key: 'home', label: 'Home', image: tabImages.home },
  { key: 'map', label: 'Map', image: tabImages.map },
  { key: 'mission', label: 'Mission', image: tabImages.mission },
  { key: 'trails', label: 'Trails', image: tabImages.trails },
  { key: 'vault', label: 'Vault', image: tabImages.vault },
  { key: 'profile', label: 'Profile', image: tabImages.profile },
  { key: 'companion', label: 'Compan...', image: tabImages.companion },
] as const;

const mapButtons = [
  { icon: 'add', label: 'Zoom in' },
  { icon: 'remove', label: 'Zoom out' },
  { icon: 'locate', label: 'Current location' },
] as const;

// 20 MPH limit. If they move faster, tracking pauses.
const speedLimitMetersPerSecond = 20 * 0.44704;

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

// =======================
// HOME SCREEN
// =======================
// This is the main screen for the map.
export default function HomeScreen() {
  const mapRef = useRef<MapView>(null);
  const safeArea = useSafeAreaInsets();

  const [mapRegion, setMapRegion] = useState<Region>(startingMapRegion);
  const [gpsPoints, setGpsPoints] = useState<Location.LocationObject[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isMovingTooFast, setIsMovingTooFast] = useState(false);
  const [isTracking, setIsTracking] = useState(true);

  const latestGpsPoint = getLatestGpsPoint(gpsPoints);
  const walkedMiles = useMemo(() => getTotalMiles(gpsPoints), [gpsPoints]);
  const liveStats = getLiveStats(walkedMiles);
  const currentSpeedMph = getSpeedMph(latestGpsPoint);
  const mapCoordinates = gpsPoints.map(makeMapCoordinate);

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

  // This saves a good walking point.
  function saveGoodGpsPoint(point: Location.LocationObject) {
    setMapRegion(makeMapRegion(point));
    setGpsPoints((oldPoints) => [...oldPoints.slice(-59), point]);
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
        onRegionChangeComplete={setMapRegion}
      >
        {renderWalkedPath(mapCoordinates)}
        {renderFootprintMarkers(mapCoordinates)}
        {renderUserGlow(latestGpsPoint)}
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
          {renderHeader()}
          {renderTopStatsCard(liveStats)}
          {renderWarningCard(isMovingTooFast, locationError)}
        </View>

        {renderGpsStatusBadge(isTracking, currentSpeedMph, safeArea.bottom)}
        {renderSideMapButtons(zoomMap, centerMapOnUser)}

        <View style={[styles.bottomOverlay, { bottom: safeArea.bottom + 10 }]}>
          {renderBottomTabBar()}
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
  return speed > speedLimitMetersPerSecond;
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
function makeMapCoordinate(location: Location.LocationObject) {
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

// This drops small footprint markers on the trail.
function renderFootprintMarkers(coordinates: ReturnType<typeof makeMapCoordinate>[]) {
  return coordinates.map((coordinate, index) => (
    <Marker
      key={`${coordinate.latitude}-${coordinate.longitude}-${index}`}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.mapFootprintGlow}>
        <Image source={currentLocationFootprint} style={styles.mapFootprintImage} resizeMode="contain" />
      </View>
    </Marker>
  ));
}

// This shows my current location as a big footprint.
function renderUserGlow(location?: Location.LocationObject) {
  if (!location) return null;

  return (
    <Marker coordinate={makeMapCoordinate(location)} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={styles.currentFootprintGlow}>
        <Image source={currentLocationFootprint} style={styles.currentFootprintImage} resizeMode="contain" />
      </View>
    </Marker>
  );
}

// This shows the top title.
function renderHeader() {
  return (
    <View style={styles.headerBar}>
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

// This shows the GPS active pill.
function renderGpsStatusBadge(isTracking: boolean, currentSpeedMph: number, safeBottom: number) {
  return (
    <View style={[styles.mapCenterBadge, { bottom: safeBottom + tabBarHeight + 28 }]} pointerEvents="none">
      <Text style={styles.mapCenterTitle}>GPS ACTIVE</Text>

      <Text style={styles.mapCenterText}>
        {isTracking ? 'Tracking footsteps' : 'Tracking paused'} | {currentSpeedMph.toFixed(1)} MPH
      </Text>
    </View>
  );
}

// This shows the simple map buttons on the right side.
function renderSideMapButtons(zoomMap: (zoomAmount: number) => void, centerMapOnUser: () => void) {
  return (
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
  );
}

// This shows the bottom navigation bar.
function renderBottomTabBar() {
  return (
    <View style={styles.tabBar}>
      {bottomTabs.map((tab) => {
        const isActiveTab = tab.key === 'home';

        return (
          <Pressable key={tab.key} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
            <View style={[styles.tabIconWrap, isActiveTab && styles.activeTabIconWrap]}>
              <Image source={tab.image} style={styles.tabIcon} resizeMode="contain" />
            </View>

            <Text style={[styles.tabLabel, isActiveTab && styles.activeTabLabel]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// =======================
// STYLES
// =======================
// This controls how everything looks.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },

  cosmicOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 10, 46, 0.18)',
  },

  fixedOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.5)',
    backgroundColor: 'rgba(3, 2, 18, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    shadowColor: '#00e5ff',
    shadowOpacity: 0.35,
    shadowRadius: 8,
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

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },

  mapFootprintGlow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 99, 247, 0.06)',
    shadowColor: '#ff63f7',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 3,
  },

  mapFootprintImage: {
    width: 64,
    height: 64,
  },

  currentFootprintGlow: {
    width: 44,
    height: 44,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 99, 247, 0.05)',
    shadowColor: '#ff63f7',
    shadowOpacity: 0.28,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 4,
  },

  currentFootprintImage: {
    width: 64,
    height: 64,
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
