import { useSharedDailyProgress } from '@/providers/activity-progress-provider';

export function useDailyProgress() {
  return useSharedDailyProgress();
}
