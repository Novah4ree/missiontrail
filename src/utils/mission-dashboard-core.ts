export type DashboardMissionState =
  | 'locked'
  | 'active'
  | 'completed'
  | 'claimed'
  | 'expired';

export type DashboardMissionLike = {
  required: boolean;
  state: DashboardMissionState;
  rewardXp: number;
};

export const MISSION_DASHBOARD_SECTION_ORDER = [
  'header',
  'overview',
  'missions',
  'explore',
  'relics',
  'companion',
  'level',
] as const;

/** Creates every mission count and XP total from the same assigned collection. */
// Purpose: Implements the summarize mission dashboard operation.
export function summarizeMissionDashboard(missions: DashboardMissionLike[]) {
  const required = missions.filter((mission) => mission.required);
  const completedRequired = required.filter(
    (mission) => mission.state === 'completed' || mission.state === 'claimed',
  );
  // "Available" means every remaining reward the user can still earn or claim.
  // Claimed XP is excluded because it has already entered lifetime XP.
  const availableXp = missions
    .filter((mission) => mission.state === 'active' || mission.state === 'completed')
    .reduce((total, mission) => total + Math.max(0, mission.rewardXp), 0);
  const claimableXp = missions
    .filter((mission) => mission.state === 'completed')
    .reduce((total, mission) => total + Math.max(0, mission.rewardXp), 0);
  const earnedXp = missions
    .filter((mission) => mission.state === 'claimed')
    .reduce((total, mission) => total + Math.max(0, mission.rewardXp), 0);

  return {
    completedCount: completedRequired.length,
    totalCount: required.length,
    availableXp,
    claimableXp,
    earnedXp,
    progressPercent: required.length > 0
      ? Math.round((completedRequired.length / required.length) * 100)
      : 0,
    allRequiredComplete: required.length > 0 && completedRequired.length === required.length,
  };
}

/** Converts server state plus live sensor progress into clear, non-claiming UI copy. */
// Purpose: Returns mission display status.
export function getMissionDisplayStatus(
  state: DashboardMissionState,
  progress: number,
  target: number,
) {
  if (state === 'locked') return 'Locked';
  if (state === 'expired') return 'Expired';
  if (state === 'claimed') return 'Completed';
  if (state === 'completed') return 'Ready to Claim';
  if (target > 0 && progress >= target) return 'Verifying';
  if (progress > 0) return 'In Progress';
  return 'Not Started';
}

/** Keeps a true empty day distinct from loading, failure, and cached offline data. */
// Purpose: Returns mission collection state.
export function getMissionCollectionState(input: {
  isLoading: boolean;
  missionCount: number;
  hasError: boolean;
  isUsingCache: boolean;
}) {
  if (input.isLoading && input.missionCount === 0) return 'loading';
  if (input.isUsingCache && input.missionCount > 0) return 'offline-cache';
  if (input.hasError && input.missionCount === 0) return 'error';
  if (input.missionCount === 0) return 'empty';
  return 'loaded';
}

// Purpose: Clamps progress to its supported range.
export function clampProgress(value: number, target: number) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(1, Math.max(0, value / target));
}

/** Selects companion copy only from real activity, mission, and Energy state. */
// Purpose: Returns companion dashboard message.
export function getCompanionDashboardMessage(input: {
  name: string;
  hasCompanion: boolean;
  todaySteps: number;
  todayMiles: number;
  hasReadyMission: boolean;
  allRequiredComplete: boolean;
  energyPercent: number;
}) {
  if (!input.hasCompanion) return 'Choose a companion to share your next adventure.';
  if (input.allRequiredComplete) return 'Amazing work—today’s adventure is complete.';
  if (input.hasReadyMission) return 'A mission is ready to be claimed!';
  if (input.energyPercent < 25) return `${input.name} needs food or rest before another mission.`;
  if (input.todaySteps > 0 || input.todayMiles > 0) return `${input.name} is keeping pace with you.`;
  return `${input.name} is ready for today’s first adventure.`;
}
