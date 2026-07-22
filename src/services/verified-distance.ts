import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';

import { supabase } from '../../lib/supabase';
import { getPlatformHealthProvider } from '@/services/health-provider';
import { loadServerMissionProgress, saveServerMissionProgress } from '@/services/mission-cache-core';
import type {
  DistanceSource,
  HealthActivityRecord,
  QueuedGpsSample,
  VerifiedDailyProgress,
} from '@/types/daily-progress';

const GPS_QUEUE_KEY = 'mission-trail:verified-gps-queue:v1';
const HEALTH_CURSOR_KEY = 'mission-trail:health-sync-cursor:v1';
const VERIFIED_PROGRESS_KEY = 'mission-trail:verified-daily-progress:v1';
const MINIMUM_SYNC_SAMPLES = 6;
const MAXIMUM_QUEUE_SAMPLES = 500;
let queueOperation: Promise<unknown> = Promise.resolve();

type ProgressResponse = { progress: VerifiedDailyProgress; replayed?: boolean };

export class VerifiedProgressError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'VerifiedProgressError';
  }
}

async function invokeProgress(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<ProgressResponse>('daily-progress', { body });
  if (error || !data?.progress) {
    const context = (error as { context?: { body?: { error?: string; message?: string } } })?.context;
    const code = context?.body?.error ?? 'SYNC_FAILED';
    throw new VerifiedProgressError(
      code,
      context?.body?.message ?? 'We couldn’t update today’s walk. We’ll try again soon.',
    );
  }
  await saveServerMissionProgress(AsyncStorage, VERIFIED_PROGRESS_KEY, data.progress);
  return data;
}

export function getCachedVerifiedDailyProgress() {
  return loadServerMissionProgress<VerifiedDailyProgress>(AsyncStorage, VERIFIED_PROGRESS_KEY);
}

export async function getVerifiedDailyProgress() {
  return (await invokeProgress({ action: 'get' })).progress;
}

// Sends only the mission ID. Supabase checks verified progress and performs the
// one-time XP transaction; the phone never sends a completion or reward value.
export async function claimMissionReward(missionId: string) {
  return (await invokeProgress({ action: 'claim-reward', missionId })).progress;
}

export async function syncUserTimezone() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return (await invokeProgress({ action: 'set-timezone', timezone })).progress;
}

async function readGpsQueue(): Promise<QueuedGpsSample[]> {
  const value = await AsyncStorage.getItem(GPS_QUEUE_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.slice(-MAXIMUM_QUEUE_SAMPLES) : [];
  } catch {
    return [];
  }
}

function locationToSample(location: LocationObject): QueuedGpsSample {
  return {
    sampleId: `location-${Math.round(location.timestamp)}`,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? Number.POSITIVE_INFINITY,
    capturedAt: new Date(location.timestamp).toISOString(),
    reportedSpeedMetersPerSecond: location.coords.speed ?? null,
    mocked: location.mocked ?? false,
    movementKind: 'unknown',
  };
}

export function queueGpsLocation(location: LocationObject) {
  const operation = queueOperation.then(async () => {
    const queued = [...(await readGpsQueue()), locationToSample(location)].slice(-MAXIMUM_QUEUE_SAMPLES);
    await AsyncStorage.setItem(GPS_QUEUE_KEY, JSON.stringify(queued));
    if (queued.length >= MINIMUM_SYNC_SAMPLES) await flushGpsQueue();
  });
  queueOperation = operation.catch(() => undefined);
  return operation;
}

export async function flushGpsQueue() {
  const queued = await readGpsQueue();
  if (queued.length < 2) return null;
  const batchId = `gps-${queued[0].sampleId}-${queued.at(-1)?.sampleId}`;
  const result = await invokeProgress({
    action: 'sync-distance', provider: 'gps', batchId, gpsSamples: queued,
  });
  // Keep the final point so the next batch can form one continuous segment.
  await AsyncStorage.setItem(GPS_QUEUE_KEY, JSON.stringify(queued.slice(-1)));
  return result.progress;
}

export async function syncHealthActivities(
  provider: Extract<DistanceSource, 'healthkit' | 'health_connect'>,
  activities: HealthActivityRecord[],
) {
  if (!activities.length) return getVerifiedDailyProgress();
  const batchId = `${provider}-${activities[0].recordId}-${activities.at(-1)?.recordId}`;
  return (await invokeProgress({
    action: 'sync-distance', provider, batchId, healthActivities: activities,
  })).progress;
}

export async function requestAndSyncPlatformHealth() {
  const provider = getPlatformHealthProvider();
  if (!provider?.isAvailable()) {
    throw new VerifiedProgressError('HEALTH_UNAVAILABLE', 'Health app walks are not available on this version yet.');
  }
  const permission = await provider.requestPermissions();
  if (permission !== 'granted') {
    throw new VerifiedProgressError('HEALTH_PERMISSION_DENIED', 'Health access is off. You can still explore with location turned on.');
  }
  const cursor = await AsyncStorage.getItem(HEALTH_CURSOR_KEY);
  const since = cursor ? new Date(cursor) : new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const activities = await provider.readActivities(since);
  const progress = await syncHealthActivities(provider.source, activities);
  await AsyncStorage.setItem(HEALTH_CURSOR_KEY, new Date().toISOString());
  return progress;
}
