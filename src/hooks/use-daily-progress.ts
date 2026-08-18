import { useSharedDailyProgress } from '@/providers/activity-progress-provider';

// Purpose: Provides the daily progress React hook behavior.
export function useDailyProgress() {
  return useSharedDailyProgress();
}
