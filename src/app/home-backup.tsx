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
import {
    Circle,
    MapView,
    Marker,
    Polyline,
    PROVIDER_GOOGLE,
} from '@/components/maps/map-components';
import { MeetupMapMarker } from '@/components/meetups/MeetupMapMarker';
import { MeetupMapPreview } from '@/components/meetups/MeetupMapPreview';
import { MeetupsTodaySection } from '@/components/meetups/MeetupsTodaySection';
import { TrailSessionConfirmModal } from '@/components/trails/trail-session-confirm-modal';
import { RelicAwakening } from '@/components/relic-awakening';
import { SecureRelicCard } from '@/components/secure-relic-card';
import { RELICS, type Relic } from '@/constants/relics';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useSecureRelicField } from '@/hooks/use-secure-relic-field';
import { useDailyActivity } from '@/providers/activity-progress-provider';
import { useLocationState } from '@/providers/location-provider';
import {
  cancelActiveTrail,
  loadActiveTrailActivity,
  subscribeToActiveTrailActivity,
} from '@/services/trail-activity-service';
import { queueGpsLocation } from '@/services/verified-distance';
import type { Meetup } from '@/types/meetups';
import type { MysteryZone } from '@/types/relic-proximity';
import type { ActiveTrailActivity } from '@/types/trails';
import {
    calculateDistanceMeters,
    feetToMeters,
    formatDistanceFeetAndInches,
    getCoordinateOffsetByFeet,
    type Coordinate,
} from '@/utils/distance';
import {
    calculateFriendsAttending,
    filterMeetupsForMap,
    MEETUP_RADIUS_OPTIONS,
    type MeetupRadiusMiles,
} from '@/utils/meetup-discovery';
import { collectRelic, getPlayerProgress } from '@/utils/player-progress';
import {
    validateActiveGpsLocation,
    validateGpsPosition,
} from '@/utils/location-validation';
import { useAuth } from '../../context/auth';
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

type HomeGpsStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'error';

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
  { name: 'Virgo', source: require('../../assets/images/tabIcons/footprints/virgo.png') },
  { name: 'Libra', source: require('../../assets/images/tabIcons/footprints/libra.png') },
  { name: 'Aquarius', source: require('../../assets/images/tabIcons/footprints/aquarius.png') },
  { name: 'Footprint', source: require('../../assets/images/tabIcons/footprints/footprints.png') },

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

  {
    icon: 'people',
    action: 'meetups-list',
    label: 'Open meetups list',
  },
] as const;

// =======================
// GPS SETTINGS
// =======================

const speedLimitMetersPerSecond =
  20 * 0.44704;

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

// Important note: Builds and controls the home screen.
export default function HomeScreen() {
  const {
    location,
    requestCurrentLocation,
    setGpsLocation,
    updateGpsAddress,
  } = useLocationState();
  const router = useRouter();
  const { session } = useAuth();
  const dailyActivity = useDailyActivity();
  const { progress: sharedProgress, refresh: refreshSharedProgress } = useDailyProgress();

  const mapRef =
    useRef<any>(null);
  const homeLocationRequestRef = useRef(0);
  const homeRecenterRequestRef = useRef(0);
  const hasCenteredOnGpsRef = useRef(false);
  const latestHomeGpsTimestampRef = useRef(
    validateActiveGpsLocation(location.currentGpsLocation)?.timestamp ?? 0,
  );

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
  const [cachedTotalXp, setCachedTotalXp] = useState(0);
  const totalXp = ENABLE_RELIC_TEST_MODE
    ? cachedTotalXp
    : sharedProgress?.totalXp ?? 0;
  const [activeTrailActivity, setActiveTrailActivity] = useState<ActiveTrailActivity | null>(null);
  const [isCancelTrailOpen, setIsCancelTrailOpen] = useState(false);
  const [isCancelingTrail, setIsCancelingTrail] = useState(false);
  const [showTrailCanceledPrompt, setShowTrailCanceledPrompt] = useState(false);
  const [selectedMeetupId, setSelectedMeetupId] = useState<string | null>(null);
  const [, setJoinedMeetupIds] = useState<string[]>([]);
  const [joiningMeetupId, setJoiningMeetupId] = useState<string | null>(null);
  const [isMeetupListOpen, setIsMeetupListOpen] = useState(false);
  const [meetupRadiusMiles, setMeetupRadiusMiles] = useState<MeetupRadiusMiles>(10);

  // =====================
  // MAP/GPS STATE
  // =====================

  const [mapRegion, setMapRegion] =
    useState<Region | null>(() => {
      const initialGpsLocation = validateActiveGpsLocation(location.currentGpsLocation);
      if (!initialGpsLocation) return null;
      hasCenteredOnGpsRef.current = true;
      return makeMapRegion(initialGpsLocation);
    });

  const [currentGpsPoint, setCurrentGpsPoint] =
    useState<Location.LocationObject | null>(null);

  const [gpsPoints, setGpsPoints] =
    useState<
      Location.LocationObject[]
    >([]);
  const [locationContentRefreshKey, setLocationContentRefreshKey] = useState(0);

  const [gpsStatus, setGpsStatus] = useState<HomeGpsStatus>(() => (
    validateActiveGpsLocation(location.currentGpsLocation) ? 'ready' : 'idle'
  ));

  // Important note: Handles the secure collection action.
  const handleSecureCollection = useCallback((relic: Relic, serverTotalXp: number) => {
    setCollectedRelicIds((current) => current.includes(relic.id) ? current : [...current, relic.id]);
    setCachedTotalXp(serverTotalXp);
    setAwakeningRelic(relic);
    void refreshSharedProgress();
  }, [refreshSharedProgress]);

  const secureRelicField = useSecureRelicField({
    enabled: !ENABLE_RELIC_TEST_MODE,
    hasValidGps: gpsStatus === 'ready',
    gpsPoints,
    locationActionKey: locationContentRefreshKey,
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
  ] = useState(() => Boolean(validateActiveGpsLocation(location.currentGpsLocation)));

  const [trackingRestartKey, setTrackingRestartKey] = useState(0);

  // =====================
  // LIVE INFORMATION
  // =====================

  const latestGpsPoint = currentGpsPoint ?? getLatestGpsPoint(gpsPoints);

  // Always derive this from live centralized GPS state; it is not a debug-log snapshot.
  const centralGpsLocation = useMemo(
    () => validateActiveGpsLocation(location.currentGpsLocation),
    [location.currentGpsLocation],
  );

  useEffect(() => {
    const timestamp = centralGpsLocation?.timestamp;
    if (typeof timestamp === 'number' && timestamp > latestHomeGpsTimestampRef.current) {
      latestHomeGpsTimestampRef.current = timestamp;
    }
  }, [centralGpsLocation?.timestamp]);

  const liveStats =
    getLiveStats(
      dailyActivity.todayDistanceMiles,
      dailyActivity.todaySteps,
      collectedRelicIds.length,
      RELICS.length,
    );

  const currentSpeedMph =
    getSpeedMph(latestGpsPoint);

  const mapCoordinates =
    gpsPoints.map(
      makeMapCoordinate,
    );

  const playerCoordinate = useMemo(() => centralGpsLocation
    ? { latitude: centralGpsLocation.latitude, longitude: centralGpsLocation.longitude }
    : latestGpsPoint
      ? makeMapCoordinate(latestGpsPoint)
      : null, [centralGpsLocation, latestGpsPoint]);

  // No hardcoded development meetup coordinates are placed on the live map.
  // Real meetup data can populate this collection through its production service.
  const meetupViewerId = session?.user.id ?? null;
  const meetupFriendIds = useMemo<string[]>(() => [], []);
  const mapMeetups = useMemo<Meetup[]>(() => [], []);
  const visibleMapMeetups = useMemo(
    () => filterMeetupsForMap(mapMeetups, {
      currentUserId: meetupViewerId,
      friendUserIds: meetupFriendIds,
      maxMarkers: 40,
      radiusMiles: meetupRadiusMiles,
      userLocation: playerCoordinate,
    }),
    [mapMeetups, meetupFriendIds, meetupRadiusMiles, meetupViewerId, playerCoordinate],
  );
  const selectedMeetup = useMemo(
    () => visibleMapMeetups.find((meetup) => meetup.id === selectedMeetupId) ?? null,
    [selectedMeetupId, visibleMapMeetups],
  );

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

    // Important note: Loads progress.
    async function loadProgress() {
      try {
        const progress = await getPlayerProgress();

        if (isMounted) {
          setCollectedRelicIds(progress.collectedRelicIds);
          setCachedTotalXp(progress.totalXp);
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
    let active = true;
    let activityRevision = 0;
    const unsubscribe = subscribeToActiveTrailActivity((activity) => {
      activityRevision += 1;
      setActiveTrailActivity(activity);
      if (activity) setShowTrailCanceledPrompt(false);
    });
    const loadRevision = activityRevision;
    void loadActiveTrailActivity().then((activity) => {
      if (active && loadRevision === activityRevision) setActiveTrailActivity(activity);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const confirmCancelActiveTrail = useCallback(async () => {
    const trailId = activeTrailActivity?.trail.id;
    if (!trailId || isCancelingTrail) return;
    setIsCancelingTrail(true);
    try {
      const canceled = await cancelActiveTrail(trailId);
      setIsCancelTrailOpen(false);
      if (canceled) {
        setActiveTrailActivity(null);
        setShowTrailCanceledPrompt(true);
      }
    } catch (cancelError) {
      if (__DEV__) console.warn('[Home] Active trail could not be canceled.', cancelError);
    } finally {
      setIsCancelingTrail(false);
    }
  }, [activeTrailActivity?.trail.id, isCancelingTrail]);

  // Step 2: Save the relic only when GPS says the player is close enough.
  // Important note: Handles the collect relic action.
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
      setCachedTotalXp(result.progress.totalXp);

      if (result.collected) {
        setAwakeningRelic(relic);
      }
    } catch (error) {
      console.error('Could not collect relic:', error);
    } finally {
      setCollectingRelicId(null);
    }
  }

  // Commits one validated device reading. The physical location is updated even
  // when the player is signed out; account persistence is an optional side effect.
  const saveGoodGpsPoint = useCallback((
    point: Location.LocationObject,
    options: { forceCenter?: boolean; recordVerifiedSample?: boolean } = {},
  ) => {
    const validated = validateGpsPosition(point);
    if (!validated) {
      setGpsLocation(point);
      setGpsStatus('unavailable');
      return false;
    }

    // A delayed watcher callback must not move the marker or proximity origin
    // behind a newer explicit GPS fix.
    if (validated.timestamp < latestHomeGpsTimestampRef.current) return true;
    latestHomeGpsTimestampRef.current = validated.timestamp;

    if (!setGpsLocation(point)) return false;

    setCurrentGpsPoint(point);
    setGpsStatus('ready');
    setLocationError(null);
    if (options.forceCenter || !hasCenteredOnGpsRef.current) {
      const nextRegion = makeMapRegion(validated);
      hasCenteredOnGpsRef.current = true;
      setMapRegion(nextRegion);
    }

    if (ENABLE_RELIC_TEST_MODE) {
      setRelicFieldOrigin((currentOrigin) => currentOrigin ?? makeMapCoordinate(point));
    }

    if (options.recordVerifiedSample !== false) {
      setGpsPoints((oldPoints) => [...oldPoints.slice(-59), point]);
      if (session?.user.id) {
        void queueGpsLocation(point, session.user.id).catch(() => {
          // Offline and transient failures stay in the local queue for the next sync.
        });
      }
    }
    return true;
  }, [session?.user.id, setGpsLocation]);

  // =====================
  // GPS TRACKING
  // =====================

  useEffect(() => {
    const requestId = ++homeLocationRequestRef.current;
    let active = true;
    let locationWatcher:
      | Location.LocationSubscription
      | undefined;

    // Important note: Starts GPS tracking.
    async function startGpsTracking() {
      try {
        setGpsStatus('requesting');
        const permission =
          await askForLocationPermission();

        if (!active || homeLocationRequestRef.current !== requestId) return;
        if (!permission.granted) {
          setGpsStatus(permission.reason === 'denied' ? 'denied' : 'unavailable');
          setIsTracking(false);
          setLocationError(permission.reason === 'denied'
            ? 'Location permission is required to explore and find relics.'
            : 'Location Services are off. Turn them on to explore and find relics.');

          return;
        }

        const firstLocation =
          await getFirstLocation();

        if (!active || homeLocationRequestRef.current !== requestId) return;
        const acceptedFirstLocation = saveGoodGpsPoint(firstLocation, { forceCenter: true });
        setIsTracking(acceptedFirstLocation);
        if (!acceptedFirstLocation) {
          setGpsStatus('unavailable');
          setLocationError('We couldn’t validate your GPS location. Move to an open area and try again.');
        }

        const watcher = await watchLiveLocation(
            (newLocation) => {
              if (!active || homeLocationRequestRef.current !== requestId) return;
              const tooFast =
                isOverSpeedLimit(
                  newLocation,
                );

              setIsMovingTooFast(
                tooFast,
              );

              const accepted = saveGoodGpsPoint(newLocation, {
                recordVerifiedSample: !tooFast,
              });
              setIsTracking(accepted && !tooFast);
              if (!accepted) {
                setGpsStatus('unavailable');
                setLocationError('The latest GPS reading was invalid or stale.');
              }
            },
          );
        if (!active || homeLocationRequestRef.current !== requestId) {
          watcher.remove();
          return;
        }
        locationWatcher = watcher;
      } catch (error) {
        if (!active || homeLocationRequestRef.current !== requestId) return;
        console.error(
          'GPS tracking error:',
          error,
        );

        setGpsStatus('error');
        setIsTracking(false);
        setLocationError(
          'We couldn’t find your location. Move to an open area and try again.',
        );
      }
    }

    startGpsTracking();

    return () => {
      active = false;
      locationWatcher?.remove();
    };
  }, [saveGoodGpsPoint, trackingRestartKey]);

  // =====================
  // CENTER MAP
  // =====================

  // Important note: Moves the map back to the user's location.
  async function centerMapOnUser() {
    const requestId = ++homeRecenterRequestRef.current;
    setGpsStatus('requesting');
    setLocationError(null);

    const result = await requestCurrentLocation();
    if (requestId !== homeRecenterRequestRef.current) return;
    if (result.kind !== 'located') {
      if (result.kind !== 'superseded') {
        setGpsStatus(result.kind === 'denied' ? 'denied' : 'unavailable');
        setLocationError(result.error);
      }
      return;
    }

    // Use the same native sample accepted by the centralized provider for the
    // Home marker, verified path, meetup origin, and relic proximity pipeline.
    if (!saveGoodGpsPoint(result.position)) {
      setGpsStatus('unavailable');
      setLocationError('We couldn’t validate your GPS location. Move to an open area and try again.');
      return;
    }

    const nextRegion = makeMapRegion(result.coordinate);
    hasCenteredOnGpsRef.current = true;
    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 500);
    setGpsStatus('ready');
    setIsTracking(true);
    setLocationContentRefreshKey((current) => current + 1);

    try {
      const [place] = await Location.reverseGeocodeAsync(result.coordinate);
      if (requestId !== homeRecenterRequestRef.current || !place) return;
      const city = [place.city, place.subregion, place.district]
        .map((value) => value?.trim())
        .find(Boolean);
      updateGpsAddress(result.coordinate, {
        city,
        state: place.region?.trim() || undefined,
        zipCode: place.postalCode?.trim() || undefined,
      });
    } catch (geocodeError) {
      // The fresh coordinate remains authoritative. Screens that show a label
      // use their existing neutral "Current location" copy until geocoding works.
      if (__DEV__ && requestId === homeRecenterRequestRef.current) {
        console.warn('[LOCATION ERROR]', {
          operation: 'home_reverse_geocode',
          message: geocodeError instanceof Error ? geocodeError.message : 'Unknown reverse-geocode error',
        });
      }
    }
  }

  // =====================
  // ZOOM MAP
  // =====================

  // Important note: Zooms the map out to show a larger area.
  function zoomOutMap() {
    if (!mapRegion) return;
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

  // Important note: Opens mission trail bot.
  function openMissionTrailBot() {
    setBotOpen(true);
  }

  // =====================
  // CLOSE CHATBOT
  // =====================

  // Important note: Closes mission trail bot.
  function closeMissionTrailBot() {
    setBotOpen(false);
  }

  // Important note: Opens leaderboard.
  function openLeaderboard() {
    router.push('/leaderboard');
  }

  // Important note: Selects aura.
  function selectAura(aura: (typeof auraOptions)[number]) {
    setSelectedAura(aura);
    setIsAuraModalOpen(false);
  }

  // Important note: Selects footprint.
  function selectFootprint(footprint: (typeof footprintOptions)[number]) {
    setSelectedFootprint(footprint);
    setIsFootprintModalOpen(false);
  }

  // Opens one compact card while keeping the Live Map mounted.
  // Important note: Selects meetup marker.
  const selectMeetupMarker = useCallback((meetupId: string) => {
    setSelectedMeetupId(meetupId);
  }, []);

  // Development joins are local previews only; production will require a server mutation.
  // Important note: Joins the selected meetup.
  const joinMeetup = useCallback((meetup: Meetup) => {
    if (!__DEV__) return;
    setJoiningMeetupId(meetup.id);
    setJoinedMeetupIds((current) => current.includes(meetup.id) ? current : [...current, meetup.id]);
    setJoiningMeetupId(null);
  }, []);

  // Stage 4 uses the accessible meetup list as the fuller detail alternative.
  // Important note: Opens the selected meetup's details.
  const viewMeetupDetails = useCallback((meetup: Meetup) => {
    setSelectedMeetupId(meetup.id);
    setIsMeetupListOpen(true);
  }, []);

  const handleMapCameraChange = useCallback((nextRegion: Region) => {
    setMapRegion(nextRegion);
  }, []);

  // =====================
  // SCREEN
  // =====================

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* ===================
          MAP
      =================== */}

      {mapRegion ? (
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
        onRegionChangeComplete={handleMapCameraChange}
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
          playerCoordinate,
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

        {visibleMapMeetups.map((meetup) => (
          <MeetupMapMarker
            key={meetup.id}
            meetup={meetup}
            friendsAttending={calculateFriendsAttending(meetup, meetupFriendIds)}
            onPress={selectMeetupMarker}
          />
        ))}
      </MapView>
      ) : (
        <View style={styles.locationUnavailable}>
          <Text style={styles.locationUnavailableText}>Location unavailable</Text>
        </View>
      )}

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

          {activeTrailActivity ? (
            <ActiveTrailCard activity={activeTrailActivity} onCancel={() => setIsCancelTrailOpen(true)} />
          ) : showTrailCanceledPrompt ? (
            <TrailCanceledCard onFindAnother={() => router.push('/trails')} />
          ) : null}

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
          gpsStatus,
          isTracking,

          currentSpeedMph,

          safeArea.bottom,

          activeTrailActivity?.trail.name ?? null,
        )}

        {/* SIDE BUTTONS */}

        <SideMapButtons
          onZoomOut={zoomOutMap}
          onCenterMap={() => void centerMapOnUser()}
          onOpenBot={openMissionTrailBot}
          onOpenMeetups={() => setIsMeetupListOpen(true)}
        />

        {selectedMeetup ? (
          <View
            pointerEvents="box-none"
            style={[styles.meetupPreviewOverlay, { bottom: safeArea.bottom + tabBarHeight + 18 }]}
          >
            <MeetupMapPreview
              meetup={selectedMeetup}
              userLocation={playerCoordinate}
              friendUserIds={meetupFriendIds}
              currentUserId={meetupViewerId}
              joining={joiningMeetupId === selectedMeetup.id}
              onClose={() => setSelectedMeetupId(null)}
              onJoin={joinMeetup}
              onViewDetails={viewMeetupDetails}
            />
          </View>
        ) : null}

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

      <MeetupListModal
        visible={isMeetupListOpen}
        meetups={mapMeetups}
        radiusMiles={meetupRadiusMiles}
        userLocation={playerCoordinate}
        currentUserId={meetupViewerId}
        friendUserIds={meetupFriendIds}
        joiningMeetupId={joiningMeetupId}
        onChangeRadius={setMeetupRadiusMiles}
        onClose={() => setIsMeetupListOpen(false)}
        onJoin={joinMeetup}
        onViewDetails={(meetup) => {
          setSelectedMeetupId(meetup.id);
          setIsMeetupListOpen(false);
        }}
      />

      <TrailSessionConfirmModal
        visible={isCancelTrailOpen && Boolean(activeTrailActivity)}
        title="Cancel Active Trail?"
        message={`You're currently exploring ${activeTrailActivity?.trail.name ?? 'this trail'}.\n\nYour current trail session will end and you'll be able to choose another trail.`}
        cancelLabel="Keep Exploring"
        confirmLabel="Cancel Trail"
        busy={isCancelingTrail}
        onCancel={() => setIsCancelTrailOpen(false)}
        onConfirm={() => void confirmCancelActiveTrail()}
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

// Important note: Asks the user for location permission.
async function askForLocationPermission() {
  if (!(await Location.hasServicesEnabledAsync())) {
    return { granted: false as const, reason: 'services_off' as const };
  }

  const permission =
    await Location.requestForegroundPermissionsAsync();

  return permission.status === Location.PermissionStatus.GRANTED
    ? { granted: true as const, reason: 'granted' as const, status: permission.status }
    : { granted: false as const, reason: 'denied' as const, status: permission.status };
}

// =======================
// FIRST LOCATION
// =======================

// Important note: Gets first location.
async function getFirstLocation() {
  return Location.getCurrentPositionAsync(
    {
      accuracy:
        Location.Accuracy
          .Highest,
    },
  );
}

// =======================
// WATCH LOCATION
// =======================

// Important note: Watches live location for changes.
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

// Important note: Checks whether over speed limit.
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

// Important note: Gets speed MPH.
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

// Important note: Gets live stats.
function getLiveStats(
  walkedMiles: number,
  todaySteps: number,
  collectedItems: number,
  totalItems: number,
) {
  return {
    distance:
      walkedMiles.toFixed(2),

    steps: Math.max(0, todaySteps).toLocaleString(),

    items: `${Math.max(0, collectedItems)}/${Math.max(0, totalItems)}`,
  };
}

// =======================
// LATEST GPS POINT
// =======================

// Important note: Gets latest GPS point.
function getLatestGpsPoint(
  points:
    Location.LocationObject[],
) {
  return points[
    points.length - 1
  ];
}

// =======================
// MAKE MAP REGION
// =======================

// Important note: Creates map region.
function makeMapRegion(
  location: Location.LocationObject | Coordinate,
): Region {
  const coordinate = 'coords' in location ? location.coords : location;
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,

    latitudeDelta: 0.012,

    longitudeDelta: 0.012,
  };
}

// =======================
// MAKE COORDINATE
// =======================

// Important note: Creates map coordinate.
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

// Important note: Finds nearest uncollected relic.
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

// Important note: Gets bearing degrees.
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

// Important note: Gets cardinal direction.
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

// Important note: Builds the walked path UI.
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

// Important note: Builds the footprint markers UI.
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

// Important note: Builds the user glow UI.
function renderUserGlow(
  coordinate?: Coordinate | null,
  auraColor?: string,
  selectedFootprint?: (typeof footprintOptions)[number],
) {
  if (!coordinate || !auraColor || !selectedFootprint) {
    return null;
  }

  return (
    <Marker
      coordinate={coordinate}
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

// Important note: Builds the relic markers UI.
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

// Important note: Builds the mystery zone markers UI.
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

// Important note: Displays the hidden relic marker on a map.
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

// Important note: Displays the relic distance card.
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

// Important note: Displays the relic compass UI.
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

// Important note: Gets aura glow background.
function getAuraGlowBackground(auraColor: string) {
  return `${auraColor}24`;
}

// Important note: Displays the aura button.
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

// Important note: Displays the footprint button.
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

// Important note: Displays the aura picker popup.
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

// Important note: Displays the footprint picker popup.
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

// Important note: Builds the header UI.
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
      </View>
    </View>
  );
}

// =======================
// TOP STATS
// =======================

// Important note: Builds the top stats card UI.
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

// Important note: Builds the warning card UI.
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

// Important note: Displays the active trail card.
function ActiveTrailCard({ activity, onCancel }: {
  activity: ActiveTrailActivity;
  onCancel: () => void;
}) {
  return (
    <View style={styles.activeTrailCard}>
      <Ionicons name="trail-sign" size={18} color="#6FE7FF" />
      <View style={styles.activeTrailCopy}>
        <Text numberOfLines={1} style={styles.activeTrailTitle}>{activity.trail.name}</Text>
        <Text style={styles.activeTrailText}>Active trail · verified GPS tracking is on</Text>
      </View>
      <Pressable
        accessibilityLabel={`Cancel active trail ${activity.trail.name}`}
        accessibilityRole="button"
        onPress={onCancel}
        style={({ pressed }) => [styles.cancelTrailButton, pressed && styles.buttonPressed]}
      >
        <Ionicons name="stop-circle-outline" size={15} color="#FFD4E2" />
        <Text style={styles.cancelTrailText}>Cancel Trail</Text>
      </Pressable>
    </View>
  );
}

function TrailCanceledCard({ onFindAnother }: { onFindAnother: () => void }) {
  return (
    <View style={styles.trailCanceledCard}>
      <Ionicons name="checkmark-circle-outline" size={19} color="#74F0B0" />
      <View style={styles.activeTrailCopy}>
        <Text style={styles.trailCanceledTitle}>Trail canceled</Text>
        <Text style={styles.trailCanceledText}>You can choose another trail whenever you&apos;re ready.</Text>
      </View>
      <Pressable
        accessibilityLabel="Find another trail"
        accessibilityRole="button"
        onPress={onFindAnother}
        style={({ pressed }) => [styles.findTrailButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.findTrailText}>Find Another Trail</Text>
      </Pressable>
    </View>
  );
}

// =======================
// GPS STATUS BADGE
// =======================

// Important note: Builds the GPS status badge UI.
function renderGpsStatusBadge(
  gpsStatus: HomeGpsStatus,
  isTracking: boolean,

  currentSpeedMph: number,

  safeBottom: number,

  activeTrailName: string | null,
) {
  const title = gpsStatus === 'ready'
    ? 'GPS ACTIVE'
    : gpsStatus === 'requesting'
      ? 'GPS REQUESTING'
      : gpsStatus === 'denied'
        ? 'GPS DENIED'
        : 'GPS UNAVAILABLE';
  const statusText = gpsStatus === 'ready'
    ? isTracking
      ? activeTrailName ? `Tracking ${activeTrailName}` : 'Location ready'
      : activeTrailName ? 'Trail tracking paused' : 'Location paused'
    : gpsStatus === 'requesting'
      ? 'Finding your location'
      : gpsStatus === 'denied'
        ? 'Location permission required'
        : 'Location unavailable';

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
        {title}
      </Text>

      <Text
        style={
          styles.mapCenterText
        }
      >
        {statusText}
        {gpsStatus === 'ready' ? ` | ${currentSpeedMph.toFixed(1)} MPH` : ''}
      </Text>
    </View>
  );
}
// =======================
// SIDE MAP BUTTONS
// =======================

// Important note: Displays the side map buttons UI.
function SideMapButtons({
  onZoomOut,
  onCenterMap,
  onOpenBot,
  onOpenMeetups,
}: {
  onZoomOut: () => void;
  onCenterMap: () => void;
  onOpenBot: () => void;
  onOpenMeetups: () => void;
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

              if (
                button.action ===
                'meetups-list'
              ) {
                onOpenMeetups();
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

// This modal keeps meetup markers accessible through a readable card list.
// Important note: Displays the meetup list popup.
function MeetupListModal({
  visible,
  meetups,
  radiusMiles,
  userLocation,
  currentUserId,
  friendUserIds,
  joiningMeetupId,
  onChangeRadius,
  onClose,
  onJoin,
  onViewDetails,
}: {
  visible: boolean;
  meetups: readonly Meetup[];
  radiusMiles: MeetupRadiusMiles;
  userLocation: Coordinate | null;
  currentUserId: string | null;
  friendUserIds: readonly string[];
  joiningMeetupId: string | null;
  onChangeRadius: (radius: MeetupRadiusMiles) => void;
  onClose: () => void;
  onJoin: (meetup: Meetup) => void | Promise<void>;
  onViewDetails: (meetup: Meetup) => void;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.meetupModalBackdrop}>
        <View style={styles.meetupModalCard}>
          <View style={styles.meetupModalHeader}>
            <View style={styles.meetupModalHeadingCopy}>
              <Text style={styles.meetupModalTitle}>Meetups Today</Text>
              <Text style={styles.meetupModalSubtitle}>Public landmark locations only</Text>
            </View>
            <Pressable accessibilityLabel="Close meetups list" accessibilityRole="button" onPress={onClose} style={styles.meetupModalClose}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <View accessibilityLabel="Meetup search radius" style={styles.meetupRadiusRow}>
            {MEETUP_RADIUS_OPTIONS.map((radius) => {
              const selected = radius === radiusMiles;
              return (
                <Pressable
                  key={radius}
                  accessibilityLabel={`Show meetups within ${radius} miles`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onChangeRadius(radius)}
                  style={[styles.meetupRadiusChip, selected && styles.meetupRadiusChipSelected]}
                >
                  <Text style={[styles.meetupRadiusText, selected && styles.meetupRadiusTextSelected]}>{radius} mi</Text>
                </Pressable>
              );
            })}
          </View>

          <MeetupsTodaySection
            meetups={meetups}
            userLocation={userLocation}
            radiusMiles={radiusMiles}
            currentUserId={currentUserId}
            friendUserIds={friendUserIds}
            joiningMeetupId={joiningMeetupId}
            onJoinMeetup={onJoin}
            onViewDetails={onViewDetails}
          />
        </View>
      </View>
    </Modal>
  );
}

// =======================
// BOTTOM TAB BAR
// =======================

// Important note: Builds the bottom tab bar UI.
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

    locationUnavailable: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },

    locationUnavailableText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
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

    meetupPreviewOverlay: {
      position: 'absolute',
      left: sidePadding,
      right: sidePadding,
    },

    meetupModalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(3, 2, 18, 0.72)',
    },

    meetupModalCard: {
      maxHeight: '76%',
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      borderColor: 'rgba(155, 92, 255, 0.75)',
      backgroundColor: 'rgba(6, 4, 26, 0.99)',
      paddingTop: 14,
      paddingBottom: 24,
      shadowColor: '#9B5CFF',
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 16,
    },

    meetupModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 10,
    },

    meetupModalHeadingCopy: {
      flex: 1,
    },

    meetupModalTitle: {
      color: '#FFFFFF',
      fontSize: 21,
      fontWeight: '900',
    },

    meetupModalSubtitle: {
      color: '#B7A7C5',
      fontSize: 11,
      marginTop: 2,
    },

    meetupModalClose: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: '#4B2A63',
      backgroundColor: '#140A22',
    },

    meetupRadiusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      paddingHorizontal: 16,
      marginTop: 12,
    },

    meetupRadiusChip: {
      minWidth: 58,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#4B2A63',
      backgroundColor: '#140A22',
      paddingHorizontal: 10,
    },

    meetupRadiusChipSelected: {
      borderColor: '#19D8FF',
      backgroundColor: '#0D2732',
    },

    meetupRadiusText: {
      color: '#B7A7C5',
      fontSize: 11,
      fontWeight: '900',
    },

    meetupRadiusTextSelected: {
      color: '#19D8FF',
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
    cancelTrailButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, borderWidth: 1, borderColor: '#FF477E', backgroundColor: 'rgba(143, 23, 67, 0.32)', paddingHorizontal: 9 },
    cancelTrailText: { color: '#FFD4E2', fontSize: 9, fontWeight: '900' },
    buttonPressed: { opacity: 0.72 },
    trailCanceledCard: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#42CF8B', backgroundColor: 'rgba(7, 48, 39, 0.92)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
    trailCanceledTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
    trailCanceledText: { color: '#B7EFD2', fontSize: 8, marginTop: 2 },
    findTrailButton: { minHeight: 34, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#74F0B0', paddingHorizontal: 9 },
    findTrailText: { color: '#D6FFE9', fontSize: 8, fontWeight: '900' },

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
