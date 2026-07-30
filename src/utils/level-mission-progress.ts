export type LevelMissionLike = {
  level?: number;
  required: boolean;
  state: 'locked' | 'active' | 'completed' | 'claimed' | 'expired';
};

/** Selects one level's configured missions so every Level card uses the same list. */
export function selectLevelMissions<T extends LevelMissionLike>(
  missions: T[],
  level: number,
) {
  return missions.filter((mission) => (mission.level ?? 1) === level);
}

/** Calculates the count and percentage shown by both the header and progress card. */
export function summarizeLevelMissions(missions: LevelMissionLike[]) {
  const totalCount = missions.length;
  const completedCount = missions.filter(
    (mission) => mission.state === 'completed' || mission.state === 'claimed',
  ).length;
  const required = missions.filter((mission) => mission.required);
  const completedRequiredCount = required.filter(
    (mission) => mission.state === 'completed' || mission.state === 'claimed',
  ).length;

  return {
    totalCount,
    completedCount,
    completedRequiredCount,
    requiredCount: required.length,
    progressPercent: totalCount > 0
      ? Math.round((completedCount / totalCount) * 100)
      : 0,
    nextLevelUnlocked: required.length > 0 && completedRequiredCount === required.length,
  };
}
