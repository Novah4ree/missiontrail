// =======================
// IMPORTS
// =======================

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Chatbot popup component
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

// =======================
// MAP SETUP
// =======================

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

  map: require('../../assets/images/tabIcons/map.png'),

  mission: require('../../assets/images/tabIcons/mission.png'),

  trails: require('../../assets/images/tabIcons/trails.png'),

  vault: require('../../assets/images/tabIcons/vault.png'),

  profile: require('../../assets/images/tabIcons/profile.png'),

  companion: require('../../assets/images/tabIcons/companion.png'),
};

const currentLocationFootprint =
  require('../../assets/images/glowing-footprint.png');

// =======================
// BOTTOM TABS
// =======================

const bottomTabs = [
  {
    key: 'home',
    label: 'Home',
    image: tabImages.home,
  },

  {
    key: 'map',
    label: 'Map',
    image: tabImages.map,
  },

  {
    key: 'mission',
    label: 'Mission',
    image: tabImages.mission,
  },

  {
    key: 'trails',
    label: 'Trails',
    image: tabImages.trails,
  },

  {
    key: 'vault',
    label: 'Vault',
    image: tabImages.vault,
  },

  {
    key: 'profile',
    label: 'Profile',
    image: tabImages.profile,
  },

  {
    key: 'companion',
    label: 'Compan...',
    image: tabImages.companion,
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

// =======================
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
            'Location permission is needed to track missions.',
          );

          return;
        }

        const firstLocation =
          await getFirstLocation();

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
          'Mission Trail could not start GPS tracking.',
        );
      }
    }

    startGpsTracking();

    return () => {
      locationWatcher?.remove();
    };
  }, []);

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

  function zoomMap(
    zoomAmount: number,
  ) {
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
  // SAVE GPS POINT
  // =====================

  function saveGoodGpsPoint(
    point:
      Location.LocationObject,
  ) {
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
        {renderWalkedPath(
          mapCoordinates,
        )}

        {renderFootprintMarkers(
          mapCoordinates,
        )}

        {renderUserGlow(
          latestGpsPoint,
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
          {renderHeader()}

          {renderTopStatsCard(
            liveStats,
          )}

          {renderWarningCard(
            isMovingTooFast,

            locationError,
          )}
        </View>

        {/* GPS BADGE */}

        {renderGpsStatusBadge(
          isTracking,

          currentSpeedMph,

          safeArea.bottom,
        )}

        {/* SIDE BUTTONS */}

        {renderSideMapButtons(
          zoomMap,

          centerMapOnUser,

          openMissionTrailBot,
        )}

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
          .Balanced,
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

      distanceInterval: 6,

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
          style={
            styles.mapFootprintGlow
          }
        >
          <Image
            source={
              currentLocationFootprint
            }
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
) {
  if (!location) {
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
        style={
          styles.currentFootprintGlow
        }
      >
        <Image
          source={
            currentLocationFootprint
          }
          style={
            styles.currentFootprintImage
          }
          resizeMode="contain"
        />
      </View>
    </Marker>
  );
}

// =======================
// HEADER
// =======================

function renderHeader() {
  return (
    <View style={styles.headerBar}>
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
            ? 'Location blocked'
            : 'Movement too fast'}
        </Text>

        <Text
          style={
            styles.warningText
          }
        >
          {locationError ??
            'Driving is not allowed. Slow down to continue tracking.'}
        </Text>
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

function renderSideMapButtons(
  zoomMap: (
    zoomAmount: number,
  ) => void,

  centerMapOnUser: () => void,

  openMissionTrailBot: () => void,
) {
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
                openMissionTrailBot();
              }

              if (
                button.action ===
                'zoom-out'
              ) {
                zoomMap(1.45);
              }

              if (
                button.action ===
                'current-location'
              ) {
                centerMapOnUser();
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
  router: any,
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
            onPress={() => {
              if (
                tab.key ===
                'profile'
              ) {
                router.push(
                  '/profile',
                );
              }

              if (
                tab.key ===
                'home'
              ) {
                router.push(
                  '/home',
                );
              }

              if (
                tab.key ===
                'map'
              ) {
                router.push(
                  '/home-backup',
                );
              }
            }}
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

// =======================
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
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(18, 10, 46, 0.18)',
    },

    fixedOverlay: {
      ...StyleSheet.absoluteFillObject,

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

    pressed: {
      opacity: 0.72,

      transform: [
        {
          scale: 0.97,
        },
      ],
    },

    mapFootprintGlow: {
      width: 28,
      height: 28,

      borderRadius: 14,

      alignItems: 'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(255, 99, 247, 0.06)',
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

      justifyContent:
        'center',

      backgroundColor:
        'rgba(255, 99, 247, 0.05)',
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