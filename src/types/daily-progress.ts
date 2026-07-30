export type MissionRewards = {
  xp: number;
  bondXp?: number;
  energyRestore?: number;
  companionXp?: number;
};

export type MissionRewardTransaction = {
  claimed: boolean;
  resultCode: string;
  xpAwarded: number;
  oldTotalXp: number;
  newTotalXp: number;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
  milestoneRewardsCrossed: {
    level: number;
    rewardCode: string;
    reward: Record<string, unknown>;
  }[];
};

export type RelicEligibility = {
  thresholdMeters: number;
  earned: boolean;
  active: boolean;
  effectiveWindowId: number | null;
};

export type VerifiedMissionProgress = {
  id: string;
  level?: number;
  title: string;
  required: boolean;
  state: 'locked' | 'active' | 'completed' | 'claimed' | 'expired';
  requirementType: 'distance' | 'steps' | 'relic' | 'location' | 'daily_set' | 'active_time' | 'session';
  progress: number;
  target: number;
  completed: boolean;
  rewardXp: number;
  rewards?: MissionRewards;
  claimedAt: string | null;
};

export type VerifiedDailyProgress = {
  totalXp: number;
  dailyStreak: number;
  verifiedSteps: number;
  companion: {
    companionId: string | null;
    bondPoints: number;
    bondTier: number;
    bondPercent: number;
    energy: number;
    maximumEnergy: number;
  };
  localDate: string;
  timezone: string;
  timezoneStatus: 'verified' | 'fallback';
  verifiedDistanceMeters: number;
  verifiedActiveSeconds: number;
  verifiedSessionCount: number;
  rare: RelicEligibility;
  legendary: RelicEligibility;
  missionOverride: {
    earned: boolean;
    active: boolean;
    completedRequired: number;
    required: number;
  };
  missions: VerifiedMissionProgress[];
  eligibilityActivation: 'next_spawn_window';
  serverTime: string;
};

export type DistanceSource = 'gps' | 'healthkit' | 'health_connect' | 'development_mock';

export type QueuedGpsSample = {
  sampleId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  reportedSpeedMetersPerSecond: number | null;
  mocked: boolean;
  movementKind: 'walking' | 'running' | 'unknown';
};
