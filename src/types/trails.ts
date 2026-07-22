export type TrailCategory =
  | 'trail'
  | 'trailhead'
  | 'park'
  | 'nature_reserve'
  | 'walking_path';

export type TrailDifficulty = 'easy' | 'moderate' | 'challenging' | 'unknown';

export type TrailAmenity = 'parking' | 'restrooms' | 'water' | 'pet_friendly';

export type MeetupPace = 'relaxed' | 'moderate' | 'fast';

export type TrailStatus = 'open' | 'closed';

export type TrailActivityType = 'walking' | 'hiking';

export type GeoJsonLineString = {
  type: 'LineString';
  coordinates: [number, number][];
};

export type NearbyTrail = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  category: TrailCategory;
  address?: string;
  description?: string;
  accessibility?: string;
  difficulty?: TrailDifficulty;
  estimatedDurationMinutes?: number;
  routeDistanceMiles?: number;
  elevationGainFeet?: number;
  geometry?: GeoJsonLineString;
  source: 'geoapify' | 'openstreetmap' | 'mission_trails';
};

/** Rich app-facing trail data. API providers can be normalized into this shape later. */
export type Trail = NearbyTrail & {
  activityType: TrailActivityType;
  city: string;
  imageKey: 'mission-landscape';
  lengthMiles: number;
  estimatedDurationMinutes: number;
  difficulty: TrailDifficulty;
  terrain: string;
  rating: number;
  publicAccess: boolean;
  status: TrailStatus;
  xpReward: number;
  relicsPossible: boolean;
  accessible: boolean;
  accessibility: string;
  startLocation: string;
  amenities: TrailAmenity[];
  petRules: string;
  safetyNotes: string[];
};

export type TrailMeetup = {
  id: string;
  trailId: string;
  title: string;
  date: string;
  startTime: string;
  meetingPoint: string;
  hostName: string;
  attendeeCount: number;
  maxGroupSize: number;
  pace: MeetupPace;
};

export type HikingRoute = {
  distanceMiles: number;
  durationMinutes: number;
  elevationGainFeet?: number;
  geometry: GeoJsonLineString;
};

export type TrailFilterKey =
  | 'near_me'
  | 'walking'
  | 'hiking'
  | 'easy'
  | 'moderate'
  | 'challenging'
  | 'under_3'
  | '3_5'
  | '5_plus'
  | 'accessible'
  | 'meetups_today';

export type TrailFilters = {
  selected: TrailFilterKey[];
};

export type TrailSearchCoordinate = {
  latitude: number;
  longitude: number;
};

export type ActiveTrailActivity = {
  trail: NearbyTrail;
  startedAt: string;
  startCoordinate: TrailSearchCoordinate;
};
