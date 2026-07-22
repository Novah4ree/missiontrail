import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  MeetupPace,
  Trail,
  TrailMeetup,
  TrailSearchCoordinate,
} from '@/types/trails';
import { calculateDistanceMeters } from '@/utils/distance';

const FAVORITES_KEY = 'mission-trails:favorite-trails:v1';
const METERS_PER_MILE = 1_609.344;

const MOCK_TRAILS: Trail[] = [
  {
    id: 'mission-gorge-loop',
    name: 'Mission Gorge Explorer Loop',
    latitude: 32.8328,
    longitude: -117.0424,
    distanceMiles: 0,
    category: 'trail',
    activityType: 'hiking',
    city: 'San Diego',
    imageKey: 'mission-landscape',
    address: 'Mission Gorge Road, San Diego, CA',
    description: 'A public sample route with rocky viewpoints, shaded pockets, and a clearly marked return loop.',
    lengthMiles: 3.2,
    estimatedDurationMinutes: 95,
    difficulty: 'moderate',
    terrain: 'Packed dirt and rock',
    rating: 4.8,
    publicAccess: true,
    status: 'open',
    xpReward: 320,
    relicsPossible: true,
    accessible: false,
    accessibility: 'Uneven grades and rocky sections; wheelchair access is not provided.',
    startLocation: 'Public visitor center trailhead',
    amenities: ['parking', 'restrooms', 'water'],
    petRules: 'Leashed pets are allowed where posted.',
    elevationGainFeet: 520,
    safetyNotes: ['Carry water and sun protection.', 'Stay on marked public paths.'],
    geometry: {
      type: 'LineString',
      coordinates: [[-117.0424, 32.8328], [-117.0398, 32.8361], [-117.0357, 32.8341], [-117.0386, 32.8297], [-117.0424, 32.8328]],
    },
    source: 'mission_trails',
  },
  {
    id: 'lake-murray-walk',
    name: 'Lake Circuit Walk',
    latitude: 32.7844,
    longitude: -117.0437,
    distanceMiles: 0,
    category: 'walking_path',
    activityType: 'walking',
    city: 'La Mesa',
    imageKey: 'mission-landscape',
    address: 'Lake Murray Boulevard, La Mesa, CA',
    description: 'A wide public walking path beside the water with frequent rest areas and gentle grades.',
    lengthMiles: 4.8,
    estimatedDurationMinutes: 100,
    difficulty: 'easy',
    terrain: 'Paved path',
    rating: 4.7,
    publicAccess: true,
    status: 'open',
    xpReward: 400,
    relicsPossible: true,
    accessible: true,
    accessibility: 'Mostly level paved route with accessible parking and restrooms.',
    startLocation: 'Public boat ramp meeting board',
    amenities: ['parking', 'restrooms', 'water', 'pet_friendly'],
    petRules: 'Leashed pets are welcome; clean up after them.',
    elevationGainFeet: 90,
    safetyNotes: ['Use lights near sunset.', 'Give cyclists room to pass.'],
    geometry: { type: 'LineString', coordinates: [[-117.0437, 32.7844], [-117.0492, 32.7867], [-117.0514, 32.7815], [-117.0457, 32.7794]] },
    source: 'mission_trails',
  },
  {
    id: 'oak-canyon-path',
    name: 'Oak Canyon Path',
    latitude: 32.8396,
    longitude: -117.0278,
    distanceMiles: 0,
    category: 'nature_reserve',
    activityType: 'hiking',
    city: 'San Diego',
    imageKey: 'mission-landscape',
    address: 'East Fortuna Staging Area, San Diego, CA',
    description: 'A steeper sample canyon route intended for prepared hikers who are comfortable on loose terrain.',
    lengthMiles: 5.6,
    estimatedDurationMinutes: 165,
    difficulty: 'challenging',
    terrain: 'Rock, loose gravel, and dirt',
    rating: 4.6,
    publicAccess: true,
    status: 'open',
    xpReward: 560,
    relicsPossible: true,
    accessible: false,
    accessibility: 'Steep and uneven trail; accessible route is not provided.',
    startLocation: 'Public East Fortuna staging area',
    amenities: ['parking'],
    petRules: 'Leashed pets only; avoid hot afternoon conditions.',
    elevationGainFeet: 1_120,
    safetyNotes: ['Turn back during extreme heat.', 'Watch for loose footing.'],
    geometry: { type: 'LineString', coordinates: [[-117.0278, 32.8396], [-117.0244, 32.8442], [-117.0191, 32.8478], [-117.0168, 32.8521]] },
    source: 'mission_trails',
  },
  {
    id: 'community-greenway',
    name: 'Community Greenway',
    latitude: 32.8088,
    longitude: -117.0705,
    distanceMiles: 0,
    category: 'park',
    activityType: 'walking',
    city: 'San Diego',
    imageKey: 'mission-landscape',
    address: 'Allied Gardens, San Diego, CA',
    description: 'A short neighborhood park loop suited to relaxed walks, mobility devices, and small public meetups.',
    lengthMiles: 1.4,
    estimatedDurationMinutes: 32,
    difficulty: 'easy',
    terrain: 'Paved and compact gravel',
    rating: 4.4,
    publicAccess: true,
    status: 'open',
    xpReward: 140,
    relicsPossible: false,
    accessible: true,
    accessibility: 'Level entrances, curb cuts, and accessible restrooms are available.',
    startLocation: 'Public park information sign',
    amenities: ['parking', 'restrooms', 'water', 'pet_friendly'],
    petRules: 'Leashed pets are welcome.',
    safetyNotes: ['Use marked crossings near the entrance.'],
    geometry: { type: 'LineString', coordinates: [[-117.0705, 32.8088], [-117.0681, 32.8109], [-117.0658, 32.8085], [-117.0685, 32.8067], [-117.0705, 32.8088]] },
    source: 'mission_trails',
  },
  {
    id: 'sunset-ridge-trail',
    name: 'Sunset Ridge Trail',
    latitude: 32.8704,
    longitude: -117.0671,
    distanceMiles: 0,
    category: 'trailhead',
    activityType: 'hiking',
    city: 'San Diego',
    imageKey: 'mission-landscape',
    address: 'North Mission Trails area, San Diego, CA',
    description: 'A sample ridge route currently shown as closed to demonstrate status-aware trail actions.',
    lengthMiles: 7.1,
    estimatedDurationMinutes: 220,
    difficulty: 'challenging',
    terrain: 'Rocky single-track',
    rating: 4.5,
    publicAccess: true,
    status: 'closed',
    xpReward: 700,
    relicsPossible: true,
    accessible: false,
    accessibility: 'Not provided.',
    startLocation: 'Public north staging area',
    amenities: ['parking'],
    petRules: 'Not provided.',
    safetyNotes: ['Do not enter while the route is marked closed.'],
    geometry: { type: 'LineString', coordinates: [[-117.0671, 32.8704], [-117.0619, 32.8748], [-117.0557, 32.8782]] },
    source: 'mission_trails',
  },
];

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

let meetups: TrailMeetup[] = [
  { id: 'sunrise-walk', trailId: 'lake-murray-walk', title: 'Sunrise Social Walk', date: localDate(), startTime: '7:30 AM', meetingPoint: 'Public boat ramp meeting board', hostName: 'Trail Guide Maya', attendeeCount: 8, maxGroupSize: 14, pace: 'relaxed' },
  { id: 'gorge-weekend', trailId: 'mission-gorge-loop', title: 'Weekend Gorge Trek', date: localDate(), startTime: '9:00 AM', meetingPoint: 'Visitor center trail map', hostName: 'Jordan R.', attendeeCount: 6, maxGroupSize: 10, pace: 'moderate' },
  { id: 'greenway-stroll', trailId: 'community-greenway', title: 'Community Stroll', date: localDate(1), startTime: '5:30 PM', meetingPoint: 'Public park information sign', hostName: 'Sam K.', attendeeCount: 4, maxGroupSize: 12, pace: 'relaxed' },
];

/** Returns mock catalog data sorted by approximate device distance when available. */
export async function getTrails(userLocation?: TrailSearchCoordinate | null) {
  return MOCK_TRAILS.map((trail) => ({
    ...trail,
    distanceMiles: userLocation
      ? calculateDistanceMeters(userLocation, trail) / METERS_PER_MILE
      : trail.lengthMiles,
  })).sort((left, right) => left.distanceMiles - right.distanceMiles);
}

export async function getTrailMeetups(trailId?: string) {
  return meetups.filter((meetup) => !trailId || meetup.trailId === trailId);
}

export async function getFavoriteTrailIds() {
  const value = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!value) return [] as string[];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [] as string[];
  }
}

/** Saves only public trail IDs; no user coordinates are written to favorites. */
export async function setTrailFavorite(trailId: string, favorite: boolean) {
  const current = await getFavoriteTrailIds();
  const next = favorite
    ? Array.from(new Set([...current, trailId]))
    : current.filter((id) => id !== trailId);
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export type CreateMeetupInput = {
  trailId: string;
  title: string;
  date: string;
  startTime: string;
  meetingPoint: string;
  pace: MeetupPace;
  maxGroupSize: number;
};

/** Adds a local demo meetup. TODO: replace with authenticated Supabase moderation. */
export async function createTrailMeetup(input: CreateMeetupInput) {
  const meetup: TrailMeetup = {
    ...input,
    id: `local-${Date.now()}`,
    hostName: 'You',
    attendeeCount: 1,
  };
  meetups = [meetup, ...meetups];
  return meetup;
}

/** TODO: submit this request through an authenticated, moderated backend. */
export async function requestToJoinMeetup(_meetupId: string) {
  return { status: 'requested' as const };
}

/** TODO: send reports to a trusted moderation service; never alert the reported user. */
export async function reportMeetupHost(_meetupId: string) {
  return { status: 'reported' as const };
}

/** TODO: persist blocks against the signed-in user account in Supabase. */
export async function blockMeetupHost(_meetupId: string) {
  return { status: 'blocked' as const };
}
