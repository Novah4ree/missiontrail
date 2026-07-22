export type RelicProximityStatus =
  | 'mystery_zone_visible'
  | 'too_far'
  | 'approaching'
  | 'improving_accuracy'
  | 'revealed'
  | 'collection_processing'
  | 'collected'
  | 'expired'
  | 'ineligible'
  | 'invalid_movement'
  | 'already_collected'
  | 'offline_retry';

export type MysteryZone = {
  assignmentId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  clueBandMeters: number;
  status: string;
  availability: 'available' | 'locked';
  expiresAt: string;
  graceEndsAt: string;
};

export type ProximityLocationSample = {
  sampleId: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedMetersPerSecond: number | null;
  provider: 'gps';
  mocked: boolean;
};

export type RevealedRelic = {
  id: string;
  name: string;
  rarity: string;
  xp: number;
};

export type CollectionResult = {
  id: string;
  relicId: string;
  xpAwarded: number;
  collectedAt: string;
  wasNew: boolean;
};
