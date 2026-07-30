import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';

import { supabase } from '../../lib/supabase';
import {
  getUserDailyStorageKey,
  loadServerMissionProgress,
  saveServerMissionProgress,
} from '@/services/mission-cache-core';
import type {
  MissionRewardTransaction,
  QueuedGpsSample,
  VerifiedDailyProgress,
} from '@/types/daily-progress';
import { getLocalDateKey } from '@/utils/daily-activity-core';

const GPS_QUEUE_KEY_PREFIX = 'mission-trail:verified-gps-queue:v2';
const VERIFIED_PROGRESS_KEY_PREFIX = 'mission-trail:verified-daily-progress:v2';
const MINIMUM_SYNC_SAMPLES = 6;
const MAXIMUM_QUEUE_SAMPLES = 500;
let queueOperation: Promise<unknown> = Promise.resolve();
const progressListeners = new Set<(progress: VerifiedDailyProgress) => void>();

type ProgressResponse = {
  progress: VerifiedDailyProgress;
  replayed?: boolean;
  rewardTransaction?: MissionRewardTransaction;
};

export class VerifiedProgressError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'VerifiedProgressError';
  }
}

function verifiedProgressKey(userId: string) {
  return `${VERIFIED_PROGRESS_KEY_PREFIX}:${userId}`;
}

type FunctionErrorPayload = {
  error?: string;
  message?: string;
  requestId?: string;
};

/**
 * Supabase stores an Edge Function's JSON error body on a Response object.
 * Reading it here preserves useful server codes instead of replacing every
 * failure with the same generic walking message.
 */
async function readFunctionError(error: unknown): Promise<FunctionErrorPayload | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof context !== 'object') return null;

  const legacyBody = (context as { body?: FunctionErrorPayload }).body;
  if (legacyBody && typeof legacyBody === 'object') return legacyBody;

  const response = context as { clone?: () => Response; json?: () => Promise<unknown> };
  try {
    const body = response.clone
      ? await response.clone().json()
      : response.json
        ? await response.json()
        : null;
    return body && typeof body === 'object' ? body as FunctionErrorPayload : null;
  } catch {
    return null;
  }
}

async function invokeProgress(body: Record<string, unknown>, userId: string) {
  const { data, error } = await supabase.functions.invoke<ProgressResponse>('daily-progress', { body });
  if (error || !data?.progress) {
    const errorBody = await readFunctionError(error);
    const code = errorBody?.error
      ?? (error as { name?: string } | null)?.name
      ?? 'SYNC_FAILED';
    throw new VerifiedProgressError(
      code,
      errorBody?.message ?? 'We couldn’t update today’s walk. We’ll try again soon.',
    );
  }
  await saveServerMissionProgress(AsyncStorage, verifiedProgressKey(userId), data.progress);
  progressListeners.forEach((listener) => listener(data.progress));
  return data;
}

export function subscribeToVerifiedProgress(
  listener: (progress: VerifiedDailyProgress) => void,
) {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export function getCachedVerifiedDailyProgress(userId: string) {
  return loadServerMissionProgress<VerifiedDailyProgress>(
    AsyncStorage,
    verifiedProgressKey(userId),
  );
}

export async function getVerifiedDailyProgress(userId: string) {
  return (await invokeProgress({ action: 'get' }, userId)).progress;
}

// Sends only the mission ID. Supabase checks verified progress and performs the
// one-time XP transaction; the phone never sends a completion or reward value.
export async function claimMissionReward(userId: string, missionId: string) {
  return invokeProgress({ action: 'claim-reward', missionId }, userId);
}

export async function syncDeviceSteps(
  userId: string,
  localDate: string,
  steps: number,
) {
  return (await invokeProgress({
    action: 'sync-steps',
    localDate,
    steps,
    idempotencyKey: `${userId}:${localDate}:${steps}`,
  }, userId)).progress;
}

export async function syncUserTimezone(userId: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return (await invokeProgress({ action: 'set-timezone', timezone }, userId)).progress;
}

function gpsQueueKey(userId: string, localDate: string) {
  return getUserDailyStorageKey(GPS_QUEUE_KEY_PREFIX, userId, localDate);
}

async function readGpsQueue(
  userId: string,
  localDate: string,
): Promise<QueuedGpsSample[]> {
  const value = await AsyncStorage.getItem(gpsQueueKey(userId, localDate));
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

export function queueGpsLocation(location: LocationObject, userId: string) {
  const operation = queueOperation.then(async () => {
    const localDate = getLocalDateKey(new Date(location.timestamp));
    const storageKey = gpsQueueKey(userId, localDate);
    const queued = [
      ...(await readGpsQueue(userId, localDate)),
      locationToSample(location),
    ].slice(-MAXIMUM_QUEUE_SAMPLES);
    await AsyncStorage.setItem(storageKey, JSON.stringify(queued));
    if (queued.length >= MINIMUM_SYNC_SAMPLES) {
      return flushGpsQueue(userId, localDate);
    }
    return null;
  });
  queueOperation = operation.catch(() => undefined);
  return operation;
}

export async function flushGpsQueue(
  userId: string,
  localDate = getLocalDateKey(),
) {
  const storageKey = gpsQueueKey(userId, localDate);
  const queued = await readGpsQueue(userId, localDate);
  if (queued.length < 2) return null;
  const batchId = `gps-${queued[0].sampleId}-${queued.at(-1)?.sampleId}`;
  const result = await invokeProgress({
    action: 'sync-distance', provider: 'gps', batchId, gpsSamples: queued,
  }, userId);
  // Keep the final point so the next batch can form one continuous segment.
  await AsyncStorage.setItem(storageKey, JSON.stringify(queued.slice(-1)));
  return result.progress;
}
