import type { Trail, TrailFilters, TrailMeetup } from '@/types/trails';

export const EMPTY_TRAIL_FILTERS: TrailFilters = { selected: [] };

function isToday(dateValue: string) {
  return dateValue === new Date().toISOString().slice(0, 10);
}

/** Applies search and filter groups without changing the original catalog. */
export function filterTrails(
  trails: Trail[],
  filters: TrailFilters,
  meetups: TrailMeetup[],
  query: string,
) {
  const selected = new Set(filters.selected);
  const normalizedQuery = query.trim().toLowerCase();

  return trails.filter((trail) => {
    const searchable = `${trail.name} ${trail.city} ${trail.address ?? ''} ${trail.activityType} ${trail.category}`.toLowerCase();
    const searchMatches = !normalizedQuery || searchable.includes(normalizedQuery);

    const activityFilters = ['walking', 'hiking'].filter((key) => selected.has(key as 'walking' | 'hiking'));
    const activityMatches = activityFilters.length === 0 || activityFilters.includes(trail.activityType);

    const difficultyFilters = ['easy', 'moderate', 'challenging'].filter((key) => selected.has(key as 'easy' | 'moderate' | 'challenging'));
    const difficultyMatches = difficultyFilters.length === 0 || difficultyFilters.includes(trail.difficulty);

    const lengthFilters = ['under_3', '3_5', '5_plus'].filter((key) => selected.has(key as 'under_3' | '3_5' | '5_plus'));
    const lengthMatches = lengthFilters.length === 0 ||
      (selected.has('under_3') && trail.lengthMiles < 3) ||
      (selected.has('3_5') && trail.lengthMiles >= 3 && trail.lengthMiles < 5) ||
      (selected.has('5_plus') && trail.lengthMiles >= 5);

    const nearMatches = !selected.has('near_me') || trail.distanceMiles <= 10;
    const accessibilityMatches = !selected.has('accessible') || trail.accessible;
    const meetupMatches = !selected.has('meetups_today') || meetups.some(
      (meetup) => meetup.trailId === trail.id && isToday(meetup.date),
    );

    return searchMatches && activityMatches && difficultyMatches && lengthMatches &&
      nearMatches && accessibilityMatches && meetupMatches;
  });
}
