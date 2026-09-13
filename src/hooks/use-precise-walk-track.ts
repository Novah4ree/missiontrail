import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import { calculateDistanceMeters } from "@/utils/distance";

// ============================================================
// PRECISE VISUAL WALK TRACKER
// ============================================================
//
// SECURITY:
//
// gpsPoints remains the real GPS history used elsewhere for secure relic
// verification, missions, distance verification and anti-cheat.
//
// This hook controls ONLY the visible map trail.
//
// RULES:
//
// - GPS decides WHERE the player is.
// - Core Motion steps decide WHETHER the visible player is allowed to move.
// - Compass heading never invents coordinates.
// - Poor GPS freezes the visual player instead of moving them into houses.
// - GPS jumps must fit the number of confirmed physical steps.
// - A corrupted pedometer spike cannot generate hundreds of footprints.
//
// ============================================================

const STEP_LENGTH_METERS = 0.762;

// Visual map positioning needs substantially tighter GPS than the raw secure
// evidence stream. Indoor fixes worse than this are intentionally ignored.
const VISUAL_MAX_ACCURACY_METERS = 10;

// Require several recent good readings that agree before trusting GPS.
const MIN_STABLE_GPS_SAMPLES = 3;
const RECENT_GPS_WINDOW = 8;

// Recent good samples must form a reasonably tight cluster.
const MAX_GPS_CLUSTER_RADIUS_METERS = 7;

// Ignore tiny coordinate motion even if steps were reported.
const MIN_VISUAL_MOVEMENT_METERS = 1.25;

// One update can never authorize a ridiculous amount of motion.
const MAX_STEP_DELTA_PER_UPDATE = 20;
const MAX_PENDING_STEPS = 40;

// Large GPS displacement must make sense relative to confirmed steps.
const EXTRA_MOVEMENT_TOLERANCE_METERS = 3;

// Reject movement that would imply roughly > 11 MPH.
const MAX_VISUAL_SPEED_METERS_PER_SECOND = 5;

const MAX_VISUAL_POINTS = 400;

type Options = {
  steps: number;
  gpsPoints: Location.LocationObject[];
  headingDegrees: number | null;
};

// Purpose: Produces a stable visual walking trail from real GPS positions while
// using Core Motion only as proof that actual physical movement occurred.
export function usePreciseWalkTrack({
  steps,
  gpsPoints,
  headingDegrees: _headingDegrees,
}: Options) {
  // Keep the public API stable for Home. Heading is intentionally ignored now.
  // Phone orientation is not reliable walking direction.
  void _headingDegrees;

  const [walkPoints, setWalkPoints] = useState<
    Location.LocationObject[]
  >([]);

  const currentLocationRef =
    useRef<Location.LocationObject | null>(null);

  const previousStepCountRef =
    useRef<number | null>(null);

  const pendingStepsRef = useRef(0);

  // ============================================================
  // CORE MOTION
  // ============================================================

  useEffect(() => {
    if (!Number.isFinite(steps) || steps < 0) {
      return;
    }

    if (previousStepCountRef.current === null) {
      previousStepCountRef.current = steps;
      return;
    }

    // Pedometer/session reset.
    if (steps < previousStepCountRef.current) {
      previousStepCountRef.current = steps;
      pendingStepsRef.current = 0;
      return;
    }

    const rawDelta =
      steps - previousStepCountRef.current;

    previousStepCountRef.current = steps;

    if (rawDelta <= 0) {
      return;
    }

    // This is a second defensive wall behind the activity provider.
    // A giant delta is never allowed to create a visual trail.
    if (rawDelta > MAX_STEP_DELTA_PER_UPDATE) {
      if (__DEV__) {
        console.warn(
          "[Visual walk] Rejected impossible step delta:",
          rawDelta,
        );
      }

      pendingStepsRef.current = 0;
      return;
    }

    pendingStepsRef.current = Math.min(
      MAX_PENDING_STEPS,
      pendingStepsRef.current + rawDelta,
    );
  }, [steps]);

  // ============================================================
  // GPS POSITION
  // ============================================================

  useEffect(() => {
    const anchor = getStableGpsAnchor(gpsPoints);

    if (!anchor) {
      return;
    }

    // Establish the initial visual position only from a stable GPS cluster.
    if (!currentLocationRef.current) {
      currentLocationRef.current = anchor;
      pendingStepsRef.current = 0;
      setWalkPoints([anchor]);
      return;
    }

    // No confirmed physical steps means GPS has zero authority to move
    // the visible player.
    const pendingSteps = pendingStepsRef.current;

    if (pendingSteps <= 0) {
      return;
    }

    const current = currentLocationRef.current;

    const distanceMeters =
      calculateDistanceMeters(
        {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        },
        {
          latitude: anchor.coords.latitude,
          longitude: anchor.coords.longitude,
        },
      );

    if (distanceMeters < MIN_VISUAL_MOVEMENT_METERS) {
      return;
    }

    // The GPS displacement must be physically possible for the number of
    // Core Motion steps accumulated since the previous accepted position.
    const maximumPlausibleDistance =
      pendingSteps * STEP_LENGTH_METERS * 1.45 +
      EXTRA_MOVEMENT_TOLERANCE_METERS;

    if (distanceMeters > maximumPlausibleDistance) {
      if (__DEV__) {
        console.log(
          "[Visual walk] Ignored GPS jump:",
          {
            distanceMeters,
            pendingSteps,
            maximumPlausibleDistance,
            accuracy: anchor.coords.accuracy,
          },
        );
      }

      return;
    }

    const elapsedSeconds = Math.max(
      0.25,
      (anchor.timestamp - current.timestamp) / 1000,
    );

    const impliedSpeedMetersPerSecond =
      distanceMeters / elapsedSeconds;

    if (
      impliedSpeedMetersPerSecond >
      MAX_VISUAL_SPEED_METERS_PER_SECOND
    ) {
      return;
    }

    // Build visual footprints BETWEEN two real, accepted GPS positions.
    // We interpolate only for appearance. We never use compass heading to
    // manufacture a direction.
    const desiredSegments = Math.max(
      1,
      Math.min(
        pendingSteps,
        Math.round(distanceMeters / STEP_LENGTH_METERS),
      ),
    );

    const created = interpolateLocations(
      current,
      anchor,
      desiredSegments,
    );

    currentLocationRef.current = anchor;
    pendingStepsRef.current = Math.max(
      0,
      pendingSteps - desiredSegments,
    );

    setWalkPoints((existing) => [
      ...existing,
      ...created,
    ].slice(-MAX_VISUAL_POINTS));
  }, [gpsPoints, steps]);

  return walkPoints;
}

// ============================================================
// STABLE GPS ANCHOR
// ============================================================

function getStableGpsAnchor(
  points: Location.LocationObject[],
) {
  const usable = points
    .slice(-RECENT_GPS_WINDOW)
    .filter((point) => {
      const accuracy = point.coords.accuracy;

      return (
        accuracy !== null &&
        accuracy !== undefined &&
        Number.isFinite(accuracy) &&
        accuracy <= VISUAL_MAX_ACCURACY_METERS &&
        Number.isFinite(point.coords.latitude) &&
        Number.isFinite(point.coords.longitude)
      );
    });

  if (usable.length < MIN_STABLE_GPS_SAMPLES) {
    return null;
  }

  // Prefer the five most accurate recent fixes.
  const best = [...usable]
    .sort(
      (left, right) =>
        (left.coords.accuracy ?? 999) -
        (right.coords.accuracy ?? 999),
    )
    .slice(0, 5);

  if (best.length < MIN_STABLE_GPS_SAMPLES) {
    return null;
  }

  const latitude = median(
    best
      .map((point) => point.coords.latitude)
      .sort((a, b) => a - b),
  );

  const longitude = median(
    best
      .map((point) => point.coords.longitude)
      .sort((a, b) => a - b),
  );

  const center = {
    latitude,
    longitude,
  };

  const clustered = best.filter((point) => {
    const distance = calculateDistanceMeters(
      center,
      {
        latitude: point.coords.latitude,
        longitude: point.coords.longitude,
      },
    );

    return distance <= MAX_GPS_CLUSTER_RADIUS_METERS;
  });

  if (clustered.length < MIN_STABLE_GPS_SAMPLES) {
    return null;
  }

  const finalLatitude = median(
    clustered
      .map((point) => point.coords.latitude)
      .sort((a, b) => a - b),
  );

  const finalLongitude = median(
    clustered
      .map((point) => point.coords.longitude)
      .sort((a, b) => a - b),
  );

  const base = [...clustered].sort(
    (a, b) => b.timestamp - a.timestamp,
  )[0];

  const accuracy = median(
    clustered
      .map(
        (point) =>
          point.coords.accuracy ??
          VISUAL_MAX_ACCURACY_METERS,
      )
      .sort((a, b) => a - b),
  );

  return {
    ...base,

    coords: {
      ...base.coords,
      latitude: finalLatitude,
      longitude: finalLongitude,
      accuracy,
    },
  } satisfies Location.LocationObject;
}

// ============================================================
// VISUAL INTERPOLATION BETWEEN TWO REAL GPS POSITIONS
// ============================================================

function interpolateLocations(
  from: Location.LocationObject,
  to: Location.LocationObject,
  segments: number,
) {
  const count = Math.max(1, Math.min(segments, 20));

  const points: Location.LocationObject[] = [];

  for (let index = 1; index <= count; index += 1) {
    const ratio = index / count;

    points.push({
      ...to,

      timestamp:
        from.timestamp +
        (to.timestamp - from.timestamp) * ratio,

      coords: {
        ...to.coords,

        latitude:
          from.coords.latitude +
          (to.coords.latitude - from.coords.latitude) *
            ratio,

        longitude:
          from.coords.longitude +
          (to.coords.longitude - from.coords.longitude) *
            ratio,

        // These visual points are interpolation only.
        // Secure verification never receives them.
        speed: 0,
      },
    });
  }

  return points;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 0) {
    return (
      (values[middle - 1] + values[middle]) /
      2
    );
  }

  return values[middle];
}
