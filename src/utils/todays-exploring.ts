import type { VerifiedDailyProgress } from '@/types/daily-progress';

export type TodaysExploringStats = {
  steps: number;
  distanceMeters: number;
  miles: number;
  activeSeconds: number;
  trips: number;
  streak: number;
  completedMissions: number;
  totalMissions: number;
};

export const EMPTY_TODAYS_EXPLORING: TodaysExploringStats = {
  steps: 0,
  distanceMeters: 0,
  miles: 0,
  activeSeconds: 0,
  trips: 0,
  streak: 0,
  completedMissions: 0,
  totalMissions: 0,
};

export function getTodaysExploringStats(
  progress: VerifiedDailyProgress | null | undefined,
): TodaysExploringStats {
  if (!progress) {
    return EMPTY_TODAYS_EXPLORING;
  }

  const missions = progress.missions ?? [];

  const completedMissions = missions.filter(
    (mission) =>
      mission.completed ||
      mission.state === 'completed' ||
      mission.state === 'claimed',
  ).length;

  const distanceMeters = Math.max(
    0,
    progress.verifiedDistanceMeters ?? 0,
  );

  return {
    steps: Math.max(
      0,
      Math.floor(progress.verifiedSteps ?? 0),
    ),

    distanceMeters,

    miles: distanceMeters / 1609.344,

    activeSeconds: Math.max(
      0,
      Math.floor(progress.verifiedActiveSeconds ?? 0),
    ),

    trips: Math.max(
      0,
      Math.floor(progress.verifiedSessionCount ?? 0),
    ),

    streak: Math.max(
      0,
      Math.floor(progress.dailyStreak ?? 0),
    ),

    completedMissions,

    totalMissions: missions.length,
  };
}

export function formatActiveTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);

  const minutes = Math.floor(safeSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}