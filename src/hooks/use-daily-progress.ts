import { useCallback, useEffect, useState } from 'react';

import {
  flushGpsQueue,
  claimMissionReward,
  getCachedVerifiedDailyProgress,
  getVerifiedDailyProgress,
  requestAndSyncPlatformHealth,
  syncUserTimezone,
  VerifiedProgressError,
} from '@/services/verified-distance';
import type { VerifiedDailyProgress } from '@/types/daily-progress';

export function useDailyProgress() {
  const [progress, setProgress] = useState<VerifiedDailyProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const cached = await getCachedVerifiedDailyProgress();
      if (cached) setProgress(cached);
      await syncUserTimezone();
      const queuedProgress = await flushGpsQueue().catch(() => null);
      setProgress(queuedProgress ?? await getVerifiedDailyProgress());
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof VerifiedProgressError
        ? error.message
        : 'We couldn’t update today’s walk. We’ll try again soon.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const claimReward = useCallback(async (missionId: string) => {
    setIsLoading(true);
    try {
      setProgress(await claimMissionReward(missionId));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof VerifiedProgressError
        ? error.message
        : 'That reward is not ready to claim yet.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      setProgress(await requestAndSyncPlatformHealth());
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof VerifiedProgressError
        ? error.message
        : 'Your health app didn’t update. Your walk can still count from location.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { progress, isLoading, message, refresh, syncHealth, claimReward };
}
