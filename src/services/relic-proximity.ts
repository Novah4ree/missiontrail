import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';

import { supabase } from '../../lib/supabase';
import type {
  CollectionResult,
  MysteryZone,
  ProximityLocationSample,
  RelicProximityStatus,
  RevealedRelic,
} from '@/types/relic-proximity';

const INSTALLATION_ID_KEY = 'mission-trail:installation-id:v1';
const CHALLENGE_PREFIX = 'mission-trail:relic-challenge:v1:';

type FieldResponse = {
  zones?: {
    assignment_id: string;
    mystery_latitude: number;
    mystery_longitude: number;
    mystery_radius_meters: number;
    clue_distance_band_meters: number;
    status: string;
    availability_status?: 'available' | 'locked';
    expires_at: string;
    grace_ends_at: string;
  }[];
  limitation?: string;
  refreshAfterSeconds?: number;
};

type DevelopmentPlacementResponse = {
  status: 'placed';
  assignmentId: string;
  message: string;
};

type ProximityResponse = {
  status: RelicProximityStatus;
  message: string;
  assignmentId?: string;
  distanceFeet?: number;
  bearingDegrees?: number;
  direction?: string;
  clueStrength?: 0 | 1 | 2 | 3;
  challenge?: { token: string; expiresAt: string };
  relic?: RevealedRelic;
  collection?: CollectionResult;
};

export class RelicProximityError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'RelicProximityError';
  }
}

function randomInstallationId() {
  return `install-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = randomInstallationId();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, created);
  return created;
}

export function locationsToProximitySamples(locations: LocationObject[]): ProximityLocationSample[] {
  return locations.slice(-3).map((location) => ({
    // Keep coordinates out of identifiers so request metadata and error tools do
    // not accidentally turn an opaque ID into another copy of a location.
    sampleId: `location-${Math.round(location.timestamp)}`,
    capturedAt: new Date(location.timestamp).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? Number.POSITIVE_INFINITY,
    speedMetersPerSecond: location.coords.speed ?? null,
    provider: 'gps',
    mocked: location.mocked ?? false,
  }));
}

function asError(error: unknown, fallback: string) {
  const context = (error as { context?: { body?: { error?: string; message?: string } } })?.context;
  return new RelicProximityError(
    context?.body?.error ?? 'NETWORK_RETRY',
    context?.body?.message ?? fallback,
  );
}

export async function getMysteryZones(samples: ProximityLocationSample[]) {
  const { data, error } = await supabase.functions.invoke<FieldResponse>('relic-field', {
    body: { provider: 'gps', locationReadings: samples },
  });
  if (error || !data) throw asError(error, 'Hidden Relic Areas could not load. Tap Try Again.');
  return {
    limitation: data.limitation,
    refreshAfterSeconds: Math.max(1, data.refreshAfterSeconds ?? 30 * 60),
    zones: (data.zones ?? []).map((zone): MysteryZone => ({
      assignmentId: zone.assignment_id,
      latitude: zone.mystery_latitude,
      longitude: zone.mystery_longitude,
      radiusMeters: zone.mystery_radius_meters,
      clueBandMeters: zone.clue_distance_band_meters,
      status: zone.status,
      availability: zone.availability_status ?? 'available',
      expiresAt: zone.expires_at,
      graceEndsAt: zone.grace_ends_at,
    })),
  };
}

export async function placeDevelopmentTestRelic(samples: ProximityLocationSample[]) {
  if (!__DEV__) {
    throw new RelicProximityError('DEVELOPMENT_TEST_DISABLED', 'Test relic setup is unavailable.');
  }
  const { data, error } = await supabase.functions.invoke<DevelopmentPlacementResponse>('relic-field', {
    body: { action: 'place_test_relic', provider: 'gps', locationReadings: samples },
  });
  if (error || !data) throw asError(error, 'The test relic could not be placed. Tap Try Again.');
  return data;
}

async function invokeProximity(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<ProximityResponse>('relic-proximity', { body });
  if (error || !data) throw asError(error, 'We couldn’t check your location. Please try again.');
  return data;
}

export async function verifyRelicProximity(
  assignmentId: string,
  samples: ProximityLocationSample[],
) {
  const deviceInstallationId = await getInstallationId();
  const result = await invokeProximity({
    action: 'verify', assignmentId, samples, deviceInstallationId,
  });
  if (result.challenge) {
    await AsyncStorage.setItem(
      `${CHALLENGE_PREFIX}${assignmentId}`,
      JSON.stringify(result.challenge),
    );
  }
  return result;
}

export async function findNearestRelic(samples: ProximityLocationSample[]) {
  const result = await invokeProximity({
    action: 'find',
    samples,
    deviceInstallationId: await getInstallationId(),
  });
  if (result.challenge && result.assignmentId) {
    await AsyncStorage.setItem(
      `${CHALLENGE_PREFIX}${result.assignmentId}`,
      JSON.stringify(result.challenge),
    );
  }
  return result;
}

export async function collectRevealedRelic(
  assignmentId: string,
  samples: ProximityLocationSample[],
) {
  const stored = await AsyncStorage.getItem(`${CHALLENGE_PREFIX}${assignmentId}`);
  const challenge = stored ? JSON.parse(stored) as { token: string; expiresAt: string } : null;
  if (!challenge) throw new RelicProximityError('CHALLENGE_REQUIRED', 'Tap Find Hidden Relic before collecting.');
  const result = await invokeProximity({
    action: 'collect', assignmentId, samples,
    deviceInstallationId: await getInstallationId(), challengeToken: challenge.token,
  });
  if (result.status === 'collected' || result.status === 'already_collected') {
    await AsyncStorage.removeItem(`${CHALLENGE_PREFIX}${assignmentId}`);
  }
  return result;
}
