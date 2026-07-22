// =======================
// IMPORTS
// =======================

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Chatbot popup component
import { RelicAwakening } from '@/components/relic-awakening';
import { SecureRelicCard } from '@/components/secure-relic-card';
import { RELICS, type Relic } from '@/constants/relics';
import { useSecureRelicField } from '@/hooks/use-secure-relic-field';
import { queueGpsLocation } from '@/services/verified-distance';
import { loadActiveTrailActivity } from '@/services/trail-activity-service';
import type { ActiveTrailActivity } from '@/types/trails';
import type { MysteryZone } from '@/types/relic-proximity';
import {
  calculateDistanceMeters,
  feetToMeters,
  formatDistanceFeetAndInches,
  getCoordinateOffsetByFeet,
  type Coordinate,
} from '@/utils/distance';
import { collectRelic, getPlayerProgress } from '@/utils/player-progress';
import MissionTrailBot from './MissionTrailBot';

// =======================
// TYPES
// =======================

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type PlacedRelic = {
  relic: Relic;
  coordinate: Coordinate;
};

// =======================
// MAP SETUP
// =======================

let MapView: any = View;
let Marker: any = View;
let Polyline: any = View;
let Circle: any = View;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Maps = require('react-native-maps');

  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
  Circle = Maps.Circle;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

type NeonIconName =
  React.ComponentProps<typeof Ionicons>['name'];

const screen = Dimensions.get('window');

const isSmallPhone =
  screen.height < 740 ||
  screen.width < 380;

const sidePadding =
  isSmallPhone ? 9 : 12;

const tabBarHeight =
  isSmallPhone ? 72 : 82;

// =======================
// IMAGES
// =======================

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

// =======================
// BOTTOM TABS
// =======================

const bottomTabs = [
  {
    key: 'home',
    label: 'Home',
    image: tabImages.home,
    route: '/home-backup',
  },

  {
    key: 'mission',
    label: 'Mission',
    image: tabImages.mission,
    route: '/mission',
  },

  {
    key: 'trails',
    label: 'Trails',
    image: tabImages.trails,
    route: '/trails',
  },

  {
    key: 'vault',
    label: 'Vault',
    image: tabImages.vault,
    route: '/vault',
  },

  {
    key: 'profile',
    label: 'Profile',
    image: tabImages.profile,
    route: '/profile',
  },

  {
    key: 'companion',
    label: 'Compan...',
    image: tabImages.companion,
    route: '/companion',
  },
] as const;

// =======================
// MAP SIDE BUTTONS
// =======================

// The plus button now opens Mission Trail Bot.

const mapButtons = [
  {
    icon: 'add',
    action: 'chatbot',
    label: 'Open Mission Trail Bot',
  },

  {
    icon: 'remove',
    action: 'zoom-out',
    label: 'Zoom out',
  },

  {
    icon: 'locate',
    action: 'current-location',
    label: 'Current location',
  },
] as const;

// =======================
// GPS SETTINGS
// =======================

const speedLimitMetersPerSecond =
  20 * 0.44704;

const startingMapRegion: Region = {
  latitude: 37.7749,
  longitude: -122.4194,

  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

const RELIC_COLLECTION_RADIUS_FEET = 10;

// Both checks must pass. __DEV__ is false in production bundles, so this UI is removed there.
const ENABLE_RELIC_TEST_MODE =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_RELIC_TEST_MODE === 'true';

// =======================
// DARK MAP STYLE
// =======================

const darkMapStyle = [
  {
    elementType: 'geometry',

    stylers: [
      {
        color: '#050518',
      },
    ],
  },

  {
    elementType: 'labels.text.fill',

    stylers: [
      {
        color: '#c9d7ff',
      },
    ],
  },

  {
    elementType: 'labels.text.stroke',

    stylers: [
      {
        color: '#050518',
      },
    ],
  },

  {
    featureType: 'road',

    elementType: 'geometry',

    stylers: [
      {
        color: '#1b1b3f',
      },
    ],
  },

  {
    featureType: 'road',

    elementType: 'geometry.stroke',

    stylers: [
      {
        color: '#4c2a91',
      },
    ],
  },

  {
    featureType: 'road.highway',

    elementType: 'geometry',

    stylers: [
      {
        color: '#20204f',
      },
    ],
  },

  {
    featureType: 'water',

    elementType: 'geometry',

    stylers: [
      {
        color: '#06143f',
      },
    ],
  },

  {
    featureType: 'poi.park',

    elementType: 'geometry',

    stylers: [
      {
        color: '#0b3b36',
      },
    ],
  },

  {
    featureType: 'poi',

    elementType: 'labels',

    stylers: [
      {
        visibility: 'off',
      },
    ],
  },

  {
    featureType: 'transit',

    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
];

// =======================+
// HOME SCREEN
// =======================

export default function HomeScreen() {
  const router = useRouter();

  const mapRef =
    useRef<any>(null);

  const safeArea =
    useSafeAreaInsets();

  // =====================
  // CHATBOT STATE
  // =====================

  const [botOpen, setBotOpen] =
    useState(false);

  const [selectedAura, setSelectedAura] =
    useState<(typeof auraOptions)[number]>(auraOptions[2]);
  const [isAuraModalOpen, setIsAuraModalOpen] = useState(false);
  const [selectedFootprint, setSelectedFootprint] =
    useState<(typeof footprintOptions)[number]>(footprintOptions[0]);
  const [isFootprintModalOpen, setIsFootprintModalOpen] = useState(false);

  const [collectedRelicIds, setCollectedRelicIds] = useState<string[]>([]);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [collectingRelicId, setCollectingRelicId] = useState<string | null>(null);
  const [awakeningRelic, setAwakeningRelic] = useState<Relic | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [activeTrailActivity, setActiveTrailActivity] = useState<ActiveTrailActivity | null>(null);

  // =====================
  // MAP/GPS STATE
  // =====================

  const [mapRegion, setMapRegion] =
    useState<Region>(
      startingMapRegion,
    );

  const [gpsPoints, setGpsPoints] =
    useState<
      Location.LocationObject[]
    >([]);

  const handleSecureCollection = useCallback((relic: Relic, serverTotalXp: number) => {
    setCollectedRelicIds((current) => current.includes(relic.id) ? current : [...current, relic.id]);
    setTotalXp(serverTotalXp);
    setAwakeningRelic(relic);
  }, []);

  const secureRelicField = useSecureRelicField({
    enabled: !ENABLE_RELIC_TEST_MODE,
    gpsPoints,
    onCollected: handleSecureCollection,
  });

  const [relicFieldOrigin, setRelicFieldOrigin] = useState<Coordinate | null>(null);

  const [
    locationError,
    setLocationError,
  ] = useState<string | null>(
    null,
  );

  const [
    isMovingTooFast,
    setIsMovingTooFast,
  ] = useState(false);

  const [
    isTracking,
    setIsTracking,
  ] = useState(true);

  const [trackingRestartKey, setTrackingRestartKey] = useState(0);

  // =====================
  // LIVE INFORMATION
  // =====================

  const latestGpsPoint =
    getLatestGpsPoint(gpsPoints);

  const walkedMiles =
    useMemo(
      () =>
        getTotalMiles(gpsPoints),

      [gpsPoints],
    );

  const liveStats =
    getLiveStats(walkedMiles);

  const currentSpeedMph =
    getSpeedMph(latestGpsPoint);

  const mapCoordinates =
    gpsPoints.map(
      makeMapCoordinate,
    );

  const playerCoordinate = latestGpsPoint ? makeMapCoordinate(latestGpsPoint) : null;

  const placedRelics = useMemo<PlacedRelic[]>(
    () =>
      relicFieldOrigin
        ? RELICS.map((relic) => ({
            relic,
            coordinate: getCoordinateOffsetByFeet(
              relicFieldOrigin,
              relic.mapPlacement.distanceFeet,
              relic.mapPlacement.bearingDegrees,
            ),
          }))
        : [],
    [relicFieldOrigin],
  );

  const nearestRelic = useMemo(
    () =>
      playerCoordinate
        ? findNearestUncollectedRelic(playerCoordinate, placedRelics, collectedRelicIds)
        : null,
    [collectedRelicIds, placedRelics, playerCoordinate],
  );

  const distanceToRelic =
    playerCoordinate && nearestRelic
      ? calculateDistanceMeters(playerCoordinate, nearestRelic.coordinate)
      : null;

  const canCollectRelic =
    distanceToRelic !== null &&
    distanceToRelic <= feetToMeters(RELIC_COLLECTION_RADIUS_FEET);

  const relicBearing = playerCoordinate && nearestRelic
    ? getBearingDegrees(playerCoordinate, nearestRelic.coordinate)
    : null;

  const relicDirection =
    relicBearing === null ? null : getCardinalDirection(relicBearing);

  const compassBearing = ENABLE_RELIC_TEST_MODE
    ? relicBearing
    : secureRelicField.bearingDegrees;
  const compassDirection = compassBearing === null
    ? null
    : getCardinalDirection(compassBearing);
  const compassDistanceFeet = ENABLE_RELIC_TEST_MODE
    ? distanceToRelic === null ? null : Math.round(distanceToRelic / 0.3048)
    : secureRelicField.distanceFeet;

  // Step 1: Load saved progress once so a collected relic stays collected after a restart.
  useEffect(() => {
    let isMounted = true;

    async function loadProgress() {
      try {
        const progress = await getPlayerProgress();

        if (isMounted) {
          setCollectedRelicIds(progress.collectedRelicIds);
          setTotalXp(progress.totalXp);
        }
      } catch (error) {
        console.error('Could not load player progress:', error);
      } finally {
        if (isMounted) {
          setIsProgressLoaded(true);
        }
      }
    }

    loadProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  // A selected discovery trail adds map context only. Verified GPS points below
  // still control every mission and relic update.
  useEffect(() => {
    void loadActiveTrailActivity().then(setActiveTrailActivity);
  }, []);

  // Step 2: Save the relic only when GPS says the player is close enough.
  async function handleCollectRelic(ignoreDistanceForTesting = false) {
    const isAllowedByDistance = canCollectRelic || ignoreDistanceForTesting;
    const relic = nearestRelic?.relic;

    if (!isAllowedByDistance || !isProgressLoaded || !relic || collectingRelicId) {
      return;
    }

    setCollectingRelicId(relic.id);

    try {
      const result = await collectRelic(relic);

      setCollectedRelicIds(result.progress.collectedRelicIds);
      setTotalXp(result.progress.totalXp);

      if (result.collected) {
        setAwakeningRelic(relic);
      }
    } catch (error) {
      console.error('Could not collect relic:', error);
    } finally {
      setCollectingRelicId(null);
    }
  }

  function saveGoodGpsPoint(
    point: Location.LocationObject,
  ) {
    void queueGpsLocation(point).catch(() => {
      // Offline and transient failures stay in the local queue for the next sync.
    });
    if (ENABLE_RELIC_TEST_MODE) {
      setRelicFieldOrigin((currentOrigin) => currentOrigin ?? makeMapCoordinate(point));
    }

    setMapRegion(
      makeMapRegion(point),
    );

    setGpsPoints(
      (oldPoints) => [
        ...oldPoints.slice(-59),
        point,
      ],
    );
  }

  // =====================
  // GPS TRACKING
  // =====================

  useEffect(() => {
    let locationWatcher:
      | Location.LocationSubscription
      | undefined;

    async function startGpsTracking() {
      try {
        const canUseLocation =
          await askForLocationPermission();

        if (!canUseLocation) {
          setLocationError(
            'Location is off. Turn it on to explore and find relics.',
          );

          return;
        }

        const firstLocation =
          await getFirstLocation();

        setLocationError(null);
        saveGoodGpsPoint(
          firstLocation,
        );

        locationWatcher =
          await watchLiveLocation(
            (newLocation) => {
              const tooFast =
                isOverSpeedLimit(
                  newLocation,
                );

              setIsMovingTooFast(
                tooFast,
              );

              setIsTracking(
                !tooFast,
              );

              setMapRegion(
                makeMapRegion(
                  newLocation,
                ),
              );

              if (!tooFast) {
                saveGoodGpsPoint(
                  newLocation,
                );
              }
            },
          );
      } catch (error) {
        console.error(
          'GPS tracking error:',
          error,
        );

        setLocationError(
          'We couldn’t find your location. Move to an open area and try again.',
        );
      }
    }

    startGpsTracking();

    return () => {
      locationWatcher?.remove();
    };
  }, [trackingRestartKey]);

  // =====================
  // CENTER MAP
  // =====================

  function centerMapOnUser() {
    if (!latestGpsPoint) {
      return;
    }

    mapRef.current?.animateToRegion(
      makeMapRegion(
        latestGpsPoint,
      ),

      500,
    );
  }

  // =====================
  // ZOOM MAP
  // =====================

  function zoomOutMap() {
    const zoomAmount = 1.45;
    const nextRegion = {
      ...mapRegion,

      latitudeDelta:
        Math.max(
          0.002,

          Math.min(
            0.08,

            mapRegion.latitudeDelta *
              zoomAmount,
          ),
        ),

      longitudeDelta:
        Math.max(
          0.002,

          Math.min(
            0.08,

            mapRegion.longitudeDelta *
              zoomAmount,
          ),
        ),
    };

    setMapRegion(nextRegion);

    mapRef.current?.animateToRegion(
      nextRegion,

      250,
    );
  }

  // =====================
  // OPEN CHATBOT
  // =====================

  function openMissionTrailBot() {
    setBotOpen(true);
  }

  // =====================
  // CLOSE CHATBOT
  // =====================

  function closeMissionTrailBot() {
    setBotOpen(false);
  }

  function openLeaderboard() {
    router.push('/leaderboard');
  }

  function selectAura(aura: (typeof auraOptions)[number]) {
    setSelectedAura(aura);
    setIsAuraModalOpen(false);
  }

  function selectFootprint(footprint: (typeof footprintOptions)[number]) {
    setSelectedFootprint(footprint);
    setIsFootprintModalOpen(false);
  }

  // =====================
  // SCREEN
  // =====================

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* ===================
          MAP
      =================== */}

      <MapView
        ref={mapRef}
        style={
          StyleSheet.absoluteFill
        }
        provider={
          Platform.OS ===
          'android'
            ? PROVIDER_GOOGLE
            : undefined
        }
        customMapStyle={
          darkMapStyle
        }
        region={mapRegion}
        userInterfaceStyle="dark"
        showsUserLocation={
          false
        }
        showsMyLocationButton={
          false
        }
        showsCompass={false}
        showsScale={false}
        rotateEnabled
        pitchEnabled
        onRegionChangeComplete={
          setMapRegion
        }
      >
        {activeTrailActivity?.trail.geometry ? (
          <Polyline
            coordinates={activeTrailActivity.trail.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }))}
            strokeColor="#19D8FF"
            strokeWidth={5}
          />
        ) : null}

        {activeTrailActivity ? (
          <Marker
            coordinate={{
              latitude: activeTrailActivity.trail.latitude,
              longitude: activeTrailActivity.trail.longitude,
            }}
            title={activeTrailActivity.trail.name}
            description="Active trail destination"
            pinColor="#FF2DF7"
          />
        ) : null}

        {renderWalkedPath(
          mapCoordinates,
        )}

        {renderFootprintMarkers(
          mapCoordinates,
          selectedAura.color,
          selectedFootprint,
        )}

        {renderUserGlow(
          latestGpsPoint,
          selectedAura.color,
          selectedFootprint,
        )}

        {ENABLE_RELIC_TEST_MODE
          ? renderRelicMarkers(placedRelics, collectedRelicIds)
          : renderMysteryZoneMarkers(
              secureRelicField.zones,
              secureRelicField.selectedAssignmentId,
              secureRelicField.setSelectedAssignmentId,
              secureRelicField.clueStrength,
            )}
      </MapView>

      {/* ===================
          COSMIC OVERLAY
      =================== */}

      <View
        style={
          styles.cosmicOverlay
        }
        pointerEvents="none"
      />

      {/* ===================
          FIXED UI
      =================== */}

      <View
        style={[
          styles.fixedOverlay,

          {
            paddingTop:
              safeArea.top,

            paddingBottom:
              safeArea.bottom,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* TOP UI */}

        <View
          style={[
            styles.topOverlay,

            {
              top:
                safeArea.top + 4,
            },
          ]}
        >
          {renderHeader(openLeaderboard)}

          {renderTopStatsCard(
            liveStats,
          )}

          {activeTrailActivity ? <ActiveTrailCard activity={activeTrailActivity} /> : null}

          {renderWarningCard(
            isMovingTooFast,

            locationError,

            () => setTrackingRestartKey((current) => current + 1),
          )}

          {ENABLE_RELIC_TEST_MODE ? (
            <RelicDistanceCard
              relic={nearestRelic?.relic ?? null}
              distanceMeters={distanceToRelic}
              direction={relicDirection}
              canCollect={canCollectRelic}
              isProgressLoaded={isProgressLoaded}
              isCollecting={collectingRelicId !== null}
              testModeEnabled
              onCollect={() => handleCollectRelic(false)}
              onTestCollect={() => handleCollectRelic(true)}
            />
          ) : (
            <SecureRelicCard field={secureRelicField} />
          )}
        </View>

        {/* GPS BADGE */}

        {renderGpsStatusBadge(
          isTracking,

          currentSpeedMph,

          safeArea.bottom,
        )}

        {/* SIDE BUTTONS */}

        <SideMapButtons
          onZoomOut={zoomOutMap}
          onCenterMap={centerMapOnUser}
          onOpenBot={openMissionTrailBot}
        />

        <RelicCompass
          relicBearing={compassBearing}
          direction={compassDirection}
          distanceFeet={compassDistanceFeet}
        />

        <View style={styles.mapStyleButtons}>
          <AuraButton
            auraColor={selectedAura.color}
            onPress={() => setIsAuraModalOpen(true)}
          />
          <FootprintButton
            auraColor={selectedAura.color}
            onPress={() => setIsFootprintModalOpen(true)}
          />
        </View>

        <AuraPickerModal
          visible={isAuraModalOpen}
          selectedAura={selectedAura}
          onSelect={selectAura}
          onClose={() => setIsAuraModalOpen(false)}
        />

        <FootprintPickerModal
          visible={isFootprintModalOpen}
          selectedFootprint={selectedFootprint}
          auraColor={selectedAura.color}
          onSelect={selectFootprint}
          onClose={() => setIsFootprintModalOpen(false)}
        />

        {/* BOTTOM TABS */}

        <View
          style={[
            styles.bottomOverlay,

            {
              bottom:
                safeArea.bottom +
                10,
            },
          ]}
        >
          {renderBottomTabBar(
            router,
          )}
        </View>
      </View>

      <RelicAwakening
        relic={awakeningRelic}
        totalXp={totalXp}
        onClose={() => setAwakeningRelic(null)}
      />

      {/* ===================
          CHATBOT POPUP
      =================== */}

      <MissionTrailBot
        visible={botOpen}
        onClose={
          closeMissionTrailBot
        }
      />
    </View>
  );
}

// =======================
// LOCATION PERMISSION
// =======================

async function askForLocationPermission() {
  if (!(await Location.hasServicesEnabledAsync())) return false;

  const permission =
    await Location.requestForegroundPermissionsAsync();

  return (
    permission.status ===
    Location.PermissionStatus
      .GRANTED
  );
}

// =======================
// FIRST LOCATION
// =======================

async function getFirstLocation() {
  return Location.getCurrentPositionAsync(
    {
      accuracy:
        Location.Accuracy
          .High,
    },
  );
}

// =======================
// WATCH LOCATION
// =======================

function watchLiveLocation(
  onLocationChange: (
    location:
      Location.LocationObject,
  ) => void,
) {
  return Location.watchPositionAsync(
    {
      accuracy:
        Location.Accuracy.High,

      // A player may stand still after finding a relic. Time-based updates let
      // the server receive three new readings without asking them to wander off.
      distanceInterval: 0,

      timeInterval: 2500,
    },

    onLocationChange,
  );
}

// =======================
// SPEED LIMIT
// =======================

function isOverSpeedLimit(
  location:
    Location.LocationObject,
) {
  return (
    (location.coords.speed ??
      0) >
    speedLimitMetersPerSecond
  );
}

// =======================
// SPEED IN MPH
// =======================

function getSpeedMph(
  location?:
    Location.LocationObject,
) {
  if (
    !location?.coords.speed ||
    location.coords.speed < 0
  ) {
    return 0;
  }

  return (
    location.coords.speed *
    2.23694
  );
}

// =======================
// LIVE STATS
// =======================

function getLiveStats(
  walkedMiles: number,
) {
  return {
    distance:
      walkedMiles.toFixed(2),

    steps: Math.max(
      0,

      Math.round(
        walkedMiles * 2200,
      ),
    ).toLocaleString(),

    items: '2/5',
  };
}

// =======================
// LATEST GPS POINT
// =======================

function getLatestGpsPoint(
  points:
    Location.LocationObject[],
) {
  return points[
    points.length - 1
  ];
}

// =======================
// TOTAL WALKED MILES
// =======================

function getTotalMiles(
  points:
    Location.LocationObject[],
) {
  let totalMeters = 0;

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    totalMeters +=
      getMetersBetweenPoints(
        points[index - 1],

        points[index],
      );
  }

  return (
    totalMeters / 1609.344
  );
}

// =======================
// DISTANCE BETWEEN POINTS
// =======================

function getMetersBetweenPoints(
  start:
    Location.LocationObject,

  end:
    Location.LocationObject,
) {
  const earthRadiusMeters =
    6371000;

  const startLat =
    (start.coords.latitude *
      Math.PI) /
    180;

  const endLat =
    (end.coords.latitude *
      Math.PI) /
    180;

  const latChange =
    ((end.coords.latitude -
      start.coords.latitude) *
      Math.PI) /
    180;

  const longChange =
    ((end.coords.longitude -
      start.coords.longitude) *
      Math.PI) /
    180;

  const halfChordLength =
    Math.sin(
      latChange / 2,
    ) **
      2 +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(
        longChange / 2,
      ) **
        2;

  return (
    earthRadiusMeters *
    2 *
    Math.atan2(
      Math.sqrt(
        halfChordLength,
      ),

      Math.sqrt(
        1 -
          halfChordLength,
      ),
    )
  );
}

// =======================
// MAKE MAP REGION
// =======================

function makeMapRegion(
  location:
    Location.LocationObject,
): Region {
  return {
    latitude:
      location.coords.latitude,

    longitude:
      location.coords.longitude,

    latitudeDelta: 0.012,

    longitudeDelta: 0.012,
  };
}

// =======================
// MAKE COORDINATE
// =======================

function makeMapCoordinate(
  location:
    Location.LocationObject,
) {
  return {
    latitude:
      location.coords.latitude,

    longitude:
      location.coords.longitude,
  };
}

function findNearestUncollectedRelic(
  playerCoordinate: Coordinate,
  placedRelics: PlacedRelic[],
  collectedRelicIds: string[],
) {
  let nearestRelic: PlacedRelic | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const placedRelic of placedRelics) {
    if (collectedRelicIds.includes(placedRelic.relic.id)) {
      continue;
    }

    const distance = calculateDistanceMeters(playerCoordinate, placedRelic.coordinate);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestRelic = placedRelic;
    }
  }

  return nearestRelic;
}

function getBearingDegrees(from: Coordinate, to: Coordinate) {
  const startLatitude = (from.latitude * Math.PI) / 180;
  const endLatitude = (to.latitude * Math.PI) / 180;
  const longitudeChange = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(longitudeChange) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeChange);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getCardinalDirection(bearing: number) {
  const directions = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
  ] as const;

  return directions[Math.round(bearing / 45) % directions.length];
}

// =======================
// WALKED PATH
// =======================

function renderWalkedPath(
  coordinates:
    ReturnType<
      typeof makeMapCoordinate
    >[],
) {
  if (
    coordinates.length <= 1
  ) {
    return null;
  }

  return (
    <>
      <Polyline
        coordinates={
          coordinates
        }
        strokeColor="rgba(168, 85, 247, 0.35)"
        strokeWidth={8}
      />

      <Polyline
        coordinates={
          coordinates
        }
        strokeColor="#ff63f7"
        strokeWidth={3}
      />
    </>
  );
}

// =======================
// FOOTPRINT MARKERS
// =======================

function renderFootprintMarkers(
  coordinates:
    ReturnType<
      typeof makeMapCoordinate
    >[],
  auraColor: string,
  selectedFootprint: (typeof footprintOptions)[number],
) {
  return coordinates.map(
    (coordinate, index) => (
      <Marker
        key={`${coordinate.latitude}-${coordinate.longitude}-${index}`}
        coordinate={
          coordinate
        }
        anchor={{
          x: 0.5,
          y: 0.5,
        }}
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
          <Image
            source={selectedFootprint.source}
            style={
              styles.mapFootprintImage
            }
            resizeMode="contain"
          />
        </View>
      </Marker>
    ),
  );
}

// =======================
// USER LOCATION GLOW
// =======================

function renderUserGlow(
  location?:
    Location.LocationObject,
  auraColor?: string,
  selectedFootprint?: (typeof footprintOptions)[number],
) {
  if (!location || !auraColor || !selectedFootprint) {
    return null;
  }

  return (
    <Marker
      coordinate={makeMapCoordinate(
        location,
      )}
      anchor={{
        x: 0.5,
        y: 0.5,
      }}
    >
      <View
        style={[
          styles.currentFootprintGlow,
          {
            backgroundColor: getAuraGlowBackground(auraColor),
            shadowColor: auraColor,
          },
        ]}
      >
        <Image
          source={selectedFootprint.source}
          style={
            styles.currentFootprintImage
          }
          resizeMode="contain"
        />
      </View>
    </Marker>
  );
}

function renderRelicMarkers(placedRelics: PlacedRelic[], collectedRelicIds: string[]) {
  return placedRelics.map(({ relic, coordinate }) => {
    const isCollected = collectedRelicIds.includes(relic.id);

    return (
      <Marker
        key={relic.id}
        coordinate={coordinate}
        title={relic.name}
        description={`${relic.rarity} relic · ${relic.mapPlacement.distanceFeet.toLocaleString()} ft from the starting point`}
      >
        <View
          style={[
            styles.relicMarker,
            { borderColor: relic.primaryColor, shadowColor: relic.primaryColor },
            isCollected && styles.relicMarkerCollected,
          ]}
        >
          <Image source={relic.icon} resizeMode="contain" style={styles.relicMarkerImage} />
          {isCollected ? (
            <View style={styles.relicMarkerCheck}>
              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </Marker>
    );
  });
}

function renderMysteryZoneMarkers(
  zones: MysteryZone[],
  selectedAssignmentId: string | null,
  onSelect: (assignmentId: string) => void,
  clueStrength: 0 | 1 | 2 | 3,
) {
  return zones.flatMap((zone) => {
    const selected = zone.assignmentId === selectedAssignmentId;
    const color = zone.availability === 'locked' ? '#72667D' : selected ? '#E879F9' : '#8B5CF6';
    const intensity = selected ? clueStrength : 0;
    return [
      <Circle
        key={`${zone.assignmentId}-zone`}
        center={{ latitude: zone.latitude, longitude: zone.longitude }}
        radius={zone.radiusMeters}
        strokeColor={`${color}A8`}
        fillColor={`${color}${selected ? '30' : '18'}`}
        strokeWidth={selected ? 2 : 1}
      />,
      <Marker
        key={zone.assignmentId}
        coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
        title="Hidden Relic Area"
        description={zone.availability === 'locked' ? 'Keep exploring to unlock this area' : 'Follow the clues here'}
        onPress={() => onSelect(zone.assignmentId)}
      >
        <HiddenRelicMarker
          color={color}
          intensity={intensity}
          locked={zone.availability === 'locked'}
          selected={selected}
        />
      </Marker>,
    ];
  });
}

function HiddenRelicMarker({
  color,
  intensity,
  locked,
  selected,
}: {
  color: string;
  intensity: number;
  locked: boolean;
  selected: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || locked) {
      pulse.value = 0;
      return;
    }

    const duration = Math.max(520, 1_300 - intensity * 210);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [intensity, locked, pulse, reduceMotion]);

  const markerStyle = useAnimatedStyle(() => ({
    opacity: 0.88 + pulse.value * 0.12,
    transform: [{ scale: 1 + intensity * 0.08 + pulse.value * (0.03 + intensity * 0.025) }],
  }));

  return (
    <Animated.View
      accessibilityLabel={locked ? 'Locked Hidden Relic Area' : `Hidden Relic Area. Clue level ${intensity + 1} of 4`}
      style={[
        styles.anomalyMarker,
        { borderColor: color, shadowColor: color },
        selected && styles.anomalyMarkerSelected,
        markerStyle,
      ]}
    >
      <View style={[styles.anomalyPulseCore, { backgroundColor: `${color}55` }]} />
      <Ionicons
        name={locked ? 'lock-closed' : 'help'}
        size={21}
        color="#FFFFFF"
      />
    </Animated.View>
  );
}

function RelicDistanceCard({
  relic,
  distanceMeters,
  direction,
  canCollect,
  isProgressLoaded,
  isCollecting,
  testModeEnabled,
  onCollect,
  onTestCollect,
}: {
  relic: Relic | null;
  distanceMeters: number | null;
  direction: string | null;
  canCollect: boolean;
  isProgressLoaded: boolean;
  isCollecting: boolean;
  testModeEnabled: boolean;
  onCollect: () => void;
  onTestCollect: () => void;
}) {
  // Step 3: The button is enabled only after progress loads, GPS is in range,
  // and there is another uncollected relic.
  const isButtonDisabled =
    !isProgressLoaded || !canCollect || !relic || isCollecting;

  return (
    <View style={[styles.relicDistanceCard, canCollect && styles.relicDistanceCardReady]}>
      <Text style={styles.relicDistanceText}>
        {!relic && isProgressLoaded
          ? 'All relics collected. Your vault is complete!'
          : distanceMeters === null
          ? 'Finding the relics around you...'
          : direction
            ? `${relic?.name} is ${formatDistanceFeetAndInches(distanceMeters)} ${direction} of you.`
            : `${relic?.name} is ${formatDistanceFeetAndInches(distanceMeters)} away.`}
      </Text>
      {canCollect && relic && (
        <Text style={styles.relicReadyText}>
          You are within {RELIC_COLLECTION_RADIUS_FEET} ft. Collect {relic.name}!
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={relic ? `Collect ${relic.name}` : 'No relic available'}
        accessibilityState={{ disabled: isButtonDisabled }}
        disabled={isButtonDisabled}
        onPress={onCollect}
        style={({ pressed }) => [
          styles.collectRelicButton,
          isButtonDisabled && styles.collectRelicButtonDisabled,
          pressed && !isButtonDisabled && styles.pressed,
        ]}
      >
        <Text style={styles.collectRelicButtonText}>
          {isCollecting ? 'Saving...' : relic ? `Collect ${relic.name}` : 'All Collected'}
        </Text>
      </Pressable>

      {testModeEnabled && relic && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Collect ${relic.name} for testing`}
          disabled={!isProgressLoaded || isCollecting}
          onPress={onTestCollect}
          style={({ pressed }) => [
            styles.testCollectButton,
            (!isProgressLoaded || isCollecting) && styles.collectRelicButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.testCollectButtonText}>Collect For Testing</Text>
        </Pressable>
      )}

    </View>
  );
}

function RelicCompass({
  relicBearing,
  direction,
  distanceFeet,
}: {
  relicBearing: number | null;
  direction: string | null;
  distanceFeet?: number | null;
}) {
  const hasGuidance = relicBearing !== null && direction !== null;

  return (
    <View
      accessible
      accessibilityLabel={hasGuidance
        ? `Relic compass. Closest relic is ${distanceFeet === null || distanceFeet === undefined ? '' : `about ${distanceFeet} feet `}${direction} of you.`
        : 'Relic compass. Tap Find Hidden Relic to get a direction.'}
      pointerEvents="none"
      style={[styles.relicCompass, !hasGuidance && styles.relicCompassWaiting]}
    >
      <Text style={styles.compassTitle}>RELIC</Text>

      <View style={styles.compassDial}>
        <Text style={[styles.compassPoint, styles.compassNorth]}>N</Text>
        <Text style={[styles.compassPoint, styles.compassEast]}>E</Text>
        <Text style={[styles.compassPoint, styles.compassSouth]}>S</Text>
        <Text style={[styles.compassPoint, styles.compassWest]}>W</Text>

        {hasGuidance ? (
          <View
            style={[
              styles.compassNeedleLayer,
              { transform: [{ rotate: `${relicBearing}deg` }] },
            ]}
          >
            <Ionicons name="arrow-up" size={23} color="#facc15" />
          </View>
        ) : (
          <Ionicons name="navigate-outline" size={24} color="#a78bfa" />
        )}

        <View style={styles.compassCenterDot} />
      </View>

      <Text style={styles.compassDirection}>
        {direction?.toUpperCase() ?? 'TAP FIND'}
      </Text>
      {distanceFeet !== null && distanceFeet !== undefined ? (
        <Text style={styles.compassDistance}>{distanceFeet.toLocaleString()} FT</Text>
      ) : null}
      <Text style={styles.compassHint}>Gold: relic</Text>
    </View>
  );
}

function getAuraGlowBackground(auraColor: string) {
  return `${auraColor}24`;
}

function AuraButton({
  auraColor,
  onPress,
}: {
  auraColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Choose footprint aura color"
      onPress={onPress}
      style={({ pressed }) => [
        styles.auraButton,
        { borderColor: auraColor, shadowColor: auraColor },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="color-palette" size={isSmallPhone ? 19 : 21} color={auraColor} />
    </Pressable>
  );
}

function FootprintButton({
  auraColor,
  onPress,
}: {
  auraColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Choose zodiac footprint"
      onPress={onPress}
      style={({ pressed }) => [
        styles.auraButton,
        { borderColor: auraColor, shadowColor: auraColor },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="footsteps" size={isSmallPhone ? 19 : 21} color={auraColor} />
    </Pressable>
  );
}

function AuraPickerModal({
  visible,
  selectedAura,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedAura: (typeof auraOptions)[number];
  onSelect: (aura: (typeof auraOptions)[number]) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.auraModalBackdrop}>
        <View style={styles.auraModalCard}>
          <Text style={styles.auraModalTitle}>Choose Your Cosmic Aura</Text>

          <View style={styles.auraOptionGrid}>
            {auraOptions.map((aura) => {
              const isSelected = aura.name === selectedAura.name;

              return (
                <Pressable
                  key={aura.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelect(aura)}
                  style={({ pressed }) => [
                    styles.auraOptionCard,
                    {
                      borderColor: isSelected ? aura.color : 'rgba(168, 85, 247, 0.35)',
                      shadowColor: aura.color,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.auraEmoji}>{aura.emoji}</Text>
                  <Text style={styles.auraName}>{aura.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.auraCloseButton, pressed && styles.pressed]}
          >
            <Text style={styles.auraCloseText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function FootprintPickerModal({
  visible,
  selectedFootprint,
  auraColor,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedFootprint: (typeof footprintOptions)[number];
  auraColor: string;
  onSelect: (footprint: (typeof footprintOptions)[number]) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.auraModalBackdrop}>
        <View style={styles.auraModalCard}>
          <Text style={styles.auraModalTitle}>Choose Your Zodiac Footprint</Text>

          <View style={styles.auraOptionGrid}>
            {footprintOptions.map((footprint) => {
              const isSelected = footprint.name === selectedFootprint.name;

              return (
                <Pressable
                  key={footprint.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelect(footprint)}
                  style={({ pressed }) => [
                    styles.auraOptionCard,
                    {
                      borderColor: isSelected ? auraColor : 'rgba(168, 85, 247, 0.35)',
                      shadowColor: auraColor,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Image
                    source={footprint.source}
                    style={styles.footprintOptionImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.auraName}>{footprint.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.auraCloseButton, pressed && styles.pressed]}
          >
            <Text style={styles.auraCloseText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// =======================
// HEADER
// =======================

function renderHeader(openLeaderboard: () => void) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open leaderboard"
        onPress={openLeaderboard}
        style={({ pressed }) => [styles.leaderboardButton, pressed && styles.pressed]}
      >
        <Ionicons name="trophy" size={isSmallPhone ? 17 : 19} color="#facc15" />
      </Pressable>

      <View
        style={styles.logoOrbit}
      >
        <Ionicons
          name="planet-outline"
          size={
            isSmallPhone
              ? 21
              : 24
          }
          color="#ff68f4"
        />
      </View>

      <Text
        style={styles.headerTitle}
      >
        MISSION TRAIL
      </Text>

      <View
        style={styles.bellWrap}
      >
        <Ionicons
          name="notifications-outline"
          size={
            isSmallPhone
              ? 18
              : 20
          }
          color="#ffffff"
        />

        <View
          style={
            styles.notificationDot
          }
        >
          <Text
            style={
              styles.notificationText
            }
          >
            3
          </Text>
        </View>
      </View>
    </View>
  );
}

// =======================
// TOP STATS
// =======================

function renderTopStatsCard(
  liveStats:
    ReturnType<
      typeof getLiveStats
    >,
) {
  const stats = [
    {
      label: 'Distance',

      value:
        liveStats.distance,

      unit: 'mi',

      icon:
        'location-outline' as NeonIconName,

      color: '#00e5ff',
    },

    {
      label: 'Steps',

      value:
        liveStats.steps,

      unit: 'steps',

      icon:
        'footsteps-outline' as NeonIconName,

      color: '#ff63f7',
    },

    {
      label: 'Items',

      value:
        liveStats.items,

      unit: 'found',

      icon:
        'gift-outline' as NeonIconName,

      color: '#a855f7',
    },
  ];

  return (
    <View style={styles.statsCard}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={styles.statItem}
        >
          <View
            style={
              styles.statLabelRow
            }
          >
            <Ionicons
              name={stat.icon}
              size={13}
              color={
                stat.color
              }
            />

            <Text
              style={
                styles.statLabel
              }
            >
              {stat.label}
            </Text>
          </View>

          <Text
            style={
              styles.statValue
            }
          >
            {stat.value}
          </Text>

          <Text
            style={
              styles.statUnit
            }
          >
            {stat.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

// =======================
// WARNING CARD
// =======================

function renderWarningCard(
  isMovingTooFast: boolean,

  locationError:
    string | null,

  onTryAgain: () => void,
) {
  if (
    !isMovingTooFast &&
    !locationError
  ) {
    return null;
  }

  return (
    <View
      style={styles.warningCard}
    >
      <Ionicons
        name="warning-outline"
        size={21}
        color="#ffffff"
      />

      <View
        style={styles.warningCopy}
      >
        <Text
          style={
            styles.warningTitle
          }
        >
          {locationError
            ? 'Location needed'
            : 'Let’s slow down'}
        </Text>

        <Text
          style={
            styles.warningText
          }
        >
          {locationError ??
            'Tracking pauses at higher speeds. Walk or run to continue.'}
        </Text>
        {locationError ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try location again"
            onPress={onTryAgain}
            style={styles.warningRetryButton}
          >
            <Text style={styles.warningRetryText}>Try Again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ActiveTrailCard({ activity }: { activity: ActiveTrailActivity }) {
  return (
    <View style={styles.activeTrailCard}>
      <Ionicons name="trail-sign" size={18} color="#6FE7FF" />
      <View style={styles.activeTrailCopy}>
        <Text numberOfLines={1} style={styles.activeTrailTitle}>{activity.trail.name}</Text>
        <Text style={styles.activeTrailText}>Active trail · verified GPS tracking is on</Text>
      </View>
    </View>
  );
}

// =======================
// GPS STATUS BADGE
// =======================

function renderGpsStatusBadge(
  isTracking: boolean,

  currentSpeedMph: number,

  safeBottom: number,
) {
  return (
    <View
      style={[
        styles.mapCenterBadge,

        {
          bottom:
            safeBottom +
            tabBarHeight +
            28,
        },
      ]}
      pointerEvents="none"
    >
      <Text
        style={
          styles.mapCenterTitle
        }
      >
        GPS ACTIVE
      </Text>

      <Text
        style={
          styles.mapCenterText
        }
      >
        {isTracking
          ? 'Tracking footsteps'
          : 'Tracking paused'}{' '}
        |{' '}
        {currentSpeedMph.toFixed(
          1,
        )}{' '}
        MPH
      </Text>
    </View>
  );
}
// =======================
// SIDE MAP BUTTONS
// =======================

function SideMapButtons({
  onZoomOut,
  onCenterMap,
  onOpenBot,
}: {
  onZoomOut: () => void;
  onCenterMap: () => void;
  onOpenBot: () => void;
}) {
  return (
    <View
      style={
        styles.floatingButtons
      }
    >
      {mapButtons.map(
        (button) => (
          <Pressable
            key={button.label}
            accessibilityRole="button"
            accessibilityLabel={
              button.label
            }
            style={({ pressed }) => [
              styles.floatingButton,

              pressed &&
                styles.pressed,
            ]}
            onPress={() => {
              if (
                button.action ===
                'chatbot'
              ) {
                onOpenBot();
              }

              if (
                button.action ===
                'zoom-out'
              ) {
                onZoomOut();
              }

              if (
                button.action ===
                'current-location'
              ) {
                onCenterMap();
              }
            }}
          >
            <Ionicons
              name={
                button.icon as any
              }
              size={
                isSmallPhone
                  ? 19
                  : 21
              }
              color="#d9f7ff"
            />
          </Pressable>
        ),
      )}
    </View>
  );
}

// =======================
// BOTTOM TAB BAR
// =======================

function renderBottomTabBar(
  router: ReturnType<typeof useRouter>,
) {
  return (
    <View style={styles.tabBar}>
      {bottomTabs.map((tab) => {
        const isActiveTab =
          tab.key === 'home';

        return (
          <Pressable
            key={tab.key}
            style={({
              pressed,
            }) => [
              styles.tabButton,

              pressed &&
                styles.pressed,
            ]}
            onPress={() => router.push(tab.route)}
          >
            <View
              style={[
                styles.tabIconWrap,

                isActiveTab &&
                  styles.activeTabIconWrap,
              ]}
            >
              <Image
                source={tab.image}
                style={
                  styles.tabIcon
                }
                resizeMode="contain"
              />
            </View>

            <Text
              style={[
                styles.tabLabel,

                isActiveTab &&
                  styles.activeTabLabel,
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
// =======================

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,

      backgroundColor:
        '#0a0a1a',
    },

    cosmicOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,

      backgroundColor:
        'rgba(18, 10, 46, 0.18)',
    },

    fixedOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,

      paddingHorizontal:
        sidePadding,
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

    relicDistanceCard: {
      borderWidth: 1,
      borderColor: 'rgba(168, 85, 247, 0.7)',
      borderRadius: 12,
      backgroundColor: 'rgba(6, 4, 26, 0.92)',
      paddingHorizontal: 12,
      paddingVertical: 9,
      alignItems: 'center',
    },

    relicDistanceCardReady: {
      borderColor: '#ffd700',
      backgroundColor: 'rgba(66, 47, 0, 0.92)',
    },

    relicDistanceText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },

    relicReadyText: {
      color: '#ffd700',
      fontSize: 12,
      fontWeight: '900',
      marginTop: 3,
    },

    collectRelicButton: {
      marginTop: 9,
      minWidth: 150,
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: '#7c3aed',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },

    collectRelicButtonDisabled: {
      backgroundColor: '#353047',
      opacity: 0.65,
    },

    collectRelicButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '900',
    },

    testCollectButton: {
      marginTop: 7,
      minWidth: 150,
      minHeight: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#ff9f0a',
      backgroundColor: 'rgba(255, 159, 10, 0.16)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },

    testCollectButtonText: {
      color: '#ffb340',
      fontSize: 12,
      fontWeight: '900',
    },

    relicMarker: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: '#ffd700',
      backgroundColor: 'rgba(66, 20, 90, 0.92)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#ffd700',
      shadowOpacity: 0.8,
      shadowRadius: 8,
      elevation: 8,
      overflow: 'visible',
    },

    relicMarkerImage: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },

    relicMarkerCheck: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 19,
      height: 19,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      backgroundColor: '#16A34A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    relicMarkerCollected: {
      opacity: 0.55,
      backgroundColor: 'rgba(18, 54, 45, 0.92)',
    },

    anomalyMarker: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 2,
      backgroundColor: 'rgba(32, 12, 58, 0.94)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowOpacity: 0.75,
      shadowRadius: 10,
      elevation: 8,
    },

    anomalyMarkerSelected: {
      borderWidth: 3,
      backgroundColor: 'rgba(85, 22, 112, 0.96)',
    },

    anomalyPulseCore: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderRadius: 15,
    },

    headerBar: {
      height:
        isSmallPhone
          ? 30
          : 34,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'center',

      gap: 9,
    },

    leaderboardButton: {
      position: 'absolute',
      left: 4,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(250, 204, 21, 0.58)',
      backgroundColor: 'rgba(65, 46, 5, 0.62)',
    },

    logoOrbit: {
      width:
        isSmallPhone
          ? 25
          : 28,

      height:
        isSmallPhone
          ? 25
          : 28,

      borderRadius: 14,

      alignItems: 'center',

      justifyContent:
        'center',

      borderWidth: 1,

      borderColor:
        'rgba(168, 85, 247, 0.6)',

      backgroundColor:
        'rgba(86, 19, 216, 0.18)',
    },

    headerTitle: {
      color: '#ffffff',

      fontSize:
        isSmallPhone
          ? 14
          : 16,

      fontWeight: '900',

      fontStyle: 'italic',

      letterSpacing: 1.2,

      textShadowColor:
        '#a855f7',

      textShadowRadius: 7,
    },

    bellWrap: {
      position: 'absolute',

      right: 4,

      width: 30,
      height: 30,

      alignItems: 'center',

      justifyContent:
        'center',
    },

    notificationDot: {
      position: 'absolute',

      right: 5,
      top: 4,

      width: 16,
      height: 16,

      borderRadius: 8,

      alignItems: 'center',

      justifyContent:
        'center',

      backgroundColor:
        '#ff2d75',
    },

    notificationText: {
      color: '#ffffff',

      fontSize: 10,

      fontWeight: '900',
    },

    statsCard: {
      minHeight:
        isSmallPhone
          ? 50
          : 54,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#a855f7',

      backgroundColor:
        'rgba(8, 5, 28, 0.88)',

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      paddingHorizontal: 8,

      elevation: 8,
    },

    statItem: {
      flex: 1,

      alignItems: 'center',

      gap: 1,

      paddingHorizontal: 2,

      borderRightWidth: 1,

      borderRightColor:
        'rgba(168, 85, 247, 0.18)',
    },

    statLabelRow: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 2,
    },

    statLabel: {
      color: '#ffffff',

      fontSize:
        isSmallPhone
          ? 7
          : 8,

      fontWeight: '900',

      textTransform:
        'uppercase',
    },

    statValue: {
      color: '#ffffff',

      fontSize:
        isSmallPhone
          ? 14
          : 16,

      fontWeight: '900',
    },

    statUnit: {
      color: '#d9ddff',

      fontSize:
        isSmallPhone
          ? 7
          : 8,

      fontWeight: '700',
    },

    warningCard: {
      minHeight: 48,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#ff2d75',

      backgroundColor:
        'rgba(65, 6, 26, 0.9)',

      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,

      paddingHorizontal: 10,
    },

    activeTrailCard: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#19D8FF',
      backgroundColor: 'rgba(5, 38, 57, 0.9)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
    },

    activeTrailCopy: { flex: 1 },
    activeTrailTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
    activeTrailText: { color: '#9DDFEF', fontSize: 9, marginTop: 2 },

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

    warningRetryButton: {
      minHeight: 36,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#ffffff',
      paddingHorizontal: 12,
      marginTop: 4,
    },

    warningRetryText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
    },

    mapCenterBadge: {
      position: 'absolute',

      alignSelf: 'center',

      borderRadius: 999,

      borderWidth: 1,

      borderColor:
        'rgba(0, 229, 255, 0.5)',

      backgroundColor:
        'rgba(3, 2, 18, 0.82)',

      paddingHorizontal: 12,

      paddingVertical: 6,

      alignItems: 'center',
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

    relicCompass: {
      position: 'absolute',
      left: sidePadding,
      top: '56%',
      zIndex: 60,
      width: 96,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(250, 204, 21, 0.55)',
      backgroundColor: 'rgba(3, 2, 18, 0.84)',
      paddingHorizontal: 8,
      paddingVertical: 7,
      alignItems: 'center',
      elevation: 8,
    },

    relicCompassWaiting: {
      borderColor: 'rgba(167, 139, 250, 0.7)',
    },

    compassTitle: {
      color: '#facc15',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    compassDial: {
      width: 72,
      height: 72,
      marginTop: 3,
      borderRadius: 36,
      borderWidth: 1,
      borderColor: 'rgba(116, 234, 255, 0.42)',
      backgroundColor: 'rgba(8, 5, 28, 0.82)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    compassPoint: {
      position: 'absolute',
      color: '#d9ddff',
      fontSize: 8,
      fontWeight: '900',
    },

    compassNorth: {
      top: 3,
      color: '#ff647c',
    },

    compassEast: {
      right: 5,
      top: 30,
    },

    compassSouth: {
      bottom: 3,
    },

    compassWest: {
      left: 4,
      top: 30,
    },

    compassNeedleLayer: {
      position: 'absolute',
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
      alignItems: 'center',
    },

    compassCenterDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#ffffff',
      backgroundColor: '#7c3aed',
    },

    compassDirection: {
      color: '#ffffff',
      fontSize: 9,
      fontWeight: '900',
      marginTop: 4,
      textAlign: 'center',
    },

    compassDistance: {
      color: '#facc15',
      fontSize: 11,
      fontWeight: '900',
      marginTop: 2,
      textAlign: 'center',
    },

    compassHint: {
      color: '#c4b5fd',
      fontSize: 7,
      fontWeight: '700',
      marginTop: 1,
    },

    floatingButton: {
      width:
        isSmallPhone
          ? 40
          : 44,

      height:
        isSmallPhone
          ? 40
          : 44,

      borderRadius: 22,

      alignItems: 'center',

      justifyContent:
        'center',

      borderWidth: 1,

      borderColor:
        '#d946ef',

      backgroundColor:
        'rgba(15, 7, 39, 0.92)',

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
      backgroundColor: 'rgba(3, 2, 18, 0.78)',
    },

    auraModalCard: {
      width: '100%',
      maxWidth: 390,
      maxHeight: '92%',
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
      gap: 8,
    },

    auraOptionCard: {
      minHeight: 44,
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
      width: 34,
      height: 34,
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

      transform: [
        {
          scale: 0.97,
        },
      ],
    },

    mapFootprintGlow: {
      width: 52,
      height: 52,

      borderRadius: 26,

      alignItems: 'center',

      justifyContent:
        'center',

      backgroundColor: 'rgba(255, 99, 247, 0.07)',
      shadowColor: '#ff63f7',
      shadowOpacity: 0.14,
      shadowRadius: 7,
      elevation: 5,
    },

    mapFootprintImage: {
      width: 60,
      height: 60,
    },

    currentFootprintGlow: {
      width: 68,
      height: 68,

      borderRadius: 34,

      alignItems: 'center',

      justifyContent:
        'center',

      backgroundColor: 'rgba(255, 99, 247, 0.09)',
      shadowColor: '#ff63f7',
      shadowOpacity: 0.16,
      shadowRadius: 9,
      elevation: 6,
    },

    currentFootprintImage: {
      width: 78,
      height: 78,
    },

    tabBar: {
      minHeight: tabBarHeight,

      maxHeight: tabBarHeight,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#6d28d9',

      backgroundColor:
        'rgba(6, 4, 26, 0.95)',

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-around',

      paddingHorizontal: 4,

      paddingVertical: 4,

      elevation: 9,
    },

    tabButton: {
      flex: 1,

      height:
        tabBarHeight - 6,

      alignItems: 'center',

      justifyContent:
        'center',

      gap: 4,
    },

    tabIconWrap: {
      width:
        isSmallPhone
          ? 38
          : 44,

      height:
        isSmallPhone
          ? 38
          : 44,

      borderRadius: 22,

      alignItems: 'center',

      justifyContent:
        'center',
    },

    activeTabIconWrap: {
      borderWidth: 1,

      borderColor:
        '#00e5ff',

      backgroundColor:
        'rgba(86, 19, 216, 0.32)',
    },

    tabIcon: {
      width:
        isSmallPhone
          ? 61
          : 56,

      height:
        isSmallPhone
          ? 61
          : 56,
    },

    tabLabel: {
      color: '#ffffff',

      fontSize:
        isSmallPhone
          ? 9
          : 10,

      fontWeight: '800',
    },

    activeTabLabel: {
      color: '#00e5ff',
    },
  });
