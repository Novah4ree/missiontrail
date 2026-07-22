export type RelicEligibility = {
  thresholdMeters: number;
  earned: boolean;
  active: boolean;
  effectiveWindowId: number | null;
};

export type VerifiedMissionProgress = {
  id: string;
  title: string;
  required: boolean;
  state: 'locked' | 'active' | 'completed' | 'claimed';
  requirementType: 'distance' | 'steps' | 'relic' | 'location' | 'daily_set' | 'active_time' | 'session';
  progress: number;
  target: number;
  completed: boolean;
  rewardXp: number;
  claimedAt: string | null;
};

export type VerifiedDailyProgress = {
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

export type HealthActivityRecord = {
  recordId: string;
  activityType: 'walking' | 'running';
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  sourceName: string;
};

export type HealthPermissionState = 'undetermined' | 'granted' | 'denied' | 'unavailable';
