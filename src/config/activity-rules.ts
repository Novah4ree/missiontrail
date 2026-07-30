/** One average walking step in meters. Change this single value to tune estimates. */
export const DEFAULT_STRIDE_LENGTH_METERS = 0.762;

/**
 * Conservative fallback for active walking calories when the user has not
 * provided weight. This is a gameplay estimate, not a medical measurement.
 */
export const FALLBACK_ACTIVE_CALORIES_PER_KILOMETER = 50;

export const METERS_PER_MILE = 1_609.344;

/** Reject accidental or manipulated daily device totals above this limit. */
export const MAX_DAILY_STEPS = 100_000;
