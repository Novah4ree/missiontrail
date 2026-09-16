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

export type ProgressionCurrentMission = {
  missionNumber: number;
  title: string;
  tier: string;
  metric: string;
  progress: number;
  target: number;
  missionPoints: number;
  eggHuntReward: boolean;
  status: 'active' | 'completed';
};

export type ProgressionSummary = {
  daily: {
    date: string;
    steps: number;
  };

  weekly: {
    weekStart: string;
    steps: number;
  };

  lifetime: {
    steps: number;
  };

  personalRecord: {
    highestDailySteps: number;
    date: string | null;
  };

  scores: {
    missionPoints: number;
    gamePoints: number;
    stepPoints: number;
    overallPoints: number;
  };

  eggHuntsAvailable: number;

  currentMission: ProgressionCurrentMission | null;
};

export type CompanionLifeStage = 'baby' | 'teen' | 'adult';

export type VerifiedDailyProgress = {
  totalXp: number;
  dailyStreak: number;

  // Permanent Mission Trails progression.
  progression: ProgressionSummary | null;

  verifiedSteps: number;
  companion: {
    companionId: string | null;
    bondPoints: number;
    bondTier: number;
    bondPercent: number;
    energy: number;
    maximumEnergy: number;

    // Companion-only progression. This is separate from the player's XP.
    growthHp?: number;
    companionXp?: number;
    growthPoints?: number;
    companionLevel?: number;
    lifeStage?: CompanionLifeStage;
    growthIntoLevel?: number;
    growthRequired?: number;

    // Backward-compatible names used by existing Companion UI code.
    hpIntoLevel?: number;
    hpRequired?: number;

    // Tamagotchi-style companion care stats.
    hunger?: number;
    happiness?: number;
    health?: number;
    careStreak?: number;
    lastFedAt?: string | null;
    lastHealthyDate?: string | null;
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