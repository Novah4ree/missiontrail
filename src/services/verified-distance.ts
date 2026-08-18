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
const MINIMUM_SYNC_SAMPLES = 10;
const MAXIMUM_QUEUE_SAMPLES = 500;
const GPS_SYNC_INTERVAL_MS = 20_000;
const GPS_SYNC_RETRY_BASE_MS = 30_000;
const GPS_SYNC_MAX_RETRY_MS = 5 * 60_000;
let queueOperation: Promise<unknown> = Promise.resolve();
const progressRefreshesInFlight = new Map<string, Promise<VerifiedDailyProgress>>();
const gpsFlushesInFlight = new Map<string, Promise<VerifiedDailyProgress | null>>();
const gpsLastAttemptAt = new Map<string, number>();
const gpsRetryNotBefore = new Map<string, number>();
const gpsFailureCounts = new Map<string, number>();
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

// Purpose: Implements the verified progress key operation.
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
// Purpose: Implements the read function error operation.
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

// Purpose: Implements the invoke progress operation.
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

// Purpose: Subscribes to to verified progress.
export function subscribeToVerifiedProgress(
  listener: (progress: VerifiedDailyProgress) => void,
) {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

// Purpose: Returns cached verified daily progress.
export function getCachedVerifiedDailyProgress(userId: string) {
  return loadServerMissionProgress<VerifiedDailyProgress>(
    AsyncStorage,
    verifiedProgressKey(userId),
  );
}

// Purpose: Returns verified daily progress.
export function getVerifiedDailyProgress(userId: string) {
  const existing = progressRefreshesInFlight.get(userId);
  if (existing) {
    if (__DEV__) console.log('[PROGRESS REFRESH] deduplicated');
    return existing;
  }

  const request = invokeProgress({ action: 'get' }, userId)
    .then(({ progress }) => progress)
    .finally(() => {
      if (progressRefreshesInFlight.get(userId) === request) {
        progressRefreshesInFlight.delete(userId);
      }
    });
  progressRefreshesInFlight.set(userId, request);
  return request;
}

// Sends only the mission ID. Supabase checks verified progress and performs the
// one-time XP transaction; the phone never sends a completion or reward value.
// Purpose: Implements the claim mission reward operation.
export async function claimMissionReward(userId: string, missionId: string) {
  return invokeProgress({ action: 'claim-reward', missionId }, userId);
}

// Purpose: Synchronizes device steps.
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

// Purpose: Synchronizes user timezone.
export async function syncUserTimezone(userId: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return (await invokeProgress({ action: 'set-timezone', timezone }, userId)).progress;
}

// Purpose: Implements the gps queue key operation.
function gpsQueueKey(userId: string, localDate: string) {
  return getUserDailyStorageKey(GPS_QUEUE_KEY_PREFIX, userId, localDate);
}

// Purpose: Implements the read gps queue operation.
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

// Purpose: Implements the location to sample operation.
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

// Purpose: Queues gps location.
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

// Purpose: Implements the flush gps queue operation.
export function flushGpsQueue(
  userId: string,
  localDate = getLocalDateKey(),
) {
  const flushKey = `${userId}:${localDate}`;
  const existing = gpsFlushesInFlight.get(flushKey);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const storageKey = gpsQueueKey(userId, localDate);
    const queued = await readGpsQueue(userId, localDate);
    if (queued.length < 2) return null;
    const now = Date.now();
    const nextAllowedAt = Math.max(
      (gpsLastAttemptAt.get(flushKey) ?? 0) + GPS_SYNC_INTERVAL_MS,
      gpsRetryNotBefore.get(flushKey) ?? 0,
    );
    if (now < nextAllowedAt) {
      // Samples stay queued locally while the retry cooldown is active.
      // There is nothing actionable to log for every GPS callback.
      return null;
    }
    gpsLastAttemptAt.set(flushKey, now);
    const batchId = `gps-${queued[0].sampleId}-${queued.at(-1)?.sampleId}`;
    let result: ProgressResponse;
    try {
      result = await invokeProgress({
        action: 'sync-distance', provider: 'gps', batchId, gpsSamples: queued,
      }, userId);
      gpsFailureCounts.delete(flushKey);
      gpsRetryNotBefore.delete(flushKey);
    } catch (error) {
      const failureCount = (gpsFailureCounts.get(flushKey) ?? 0) + 1;
      gpsFailureCounts.set(flushKey, failureCount);
      const retryDelay = Math.min(
        GPS_SYNC_RETRY_BASE_MS * 2 ** (failureCount - 1),
        GPS_SYNC_MAX_RETRY_MS,
      );
      gpsRetryNotBefore.set(flushKey, Date.now() + retryDelay);
      if (__DEV__) {
        console.warn('[DISTANCE SYNC] retry scheduled', {
          code: error instanceof VerifiedProgressError ? error.code : 'SYNC_FAILED',
          retryInMs: retryDelay,
          samples: queued.length,
        });
      }
      throw error;
    }
    // Keep the final verified point for continuity plus any samples appended
    // while this request was in flight, so a concurrent queue write is not lost.
    const latestQueue = await readGpsQueue(userId, localDate);
    const finalSyncedSampleId = queued.at(-1)?.sampleId;
    const finalSyncedIndex = latestQueue.findIndex(
      ({ sampleId }) => sampleId === finalSyncedSampleId,
    );
    const remainingSamples = finalSyncedIndex >= 0
      ? latestQueue.slice(finalSyncedIndex + 1)
      : latestQueue;
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify([...queued.slice(-1), ...remainingSamples]),
    );
    return result.progress;
  })().finally(() => {
    if (gpsFlushesInFlight.get(flushKey) === request) {
      gpsFlushesInFlight.delete(flushKey);
    }
  });
  gpsFlushesInFlight.set(flushKey, request);
  return request;
}
