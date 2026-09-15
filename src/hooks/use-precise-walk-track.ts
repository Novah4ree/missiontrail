import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import { calculateDistanceMeters } from "@/utils/distance";

// ============================================================
// PRECISE VISUAL WALK TRACKER
// ============================================================
//
// SECURITY:
//
// gpsPoints remains the untouched GPS history used elsewhere for
// secure relic verification, missions, distance verification,
// anti-cheat and server validation.
//
// This hook controls ONLY the position/trail the player sees.
//
// VISUAL TRACKING:
//
// - Core Motion steps decide WHEN visual movement can happen.
// - GPS course decides WHICH DIRECTION the player is walking.
// - A step can move the visual marker immediately.
// - Stable GPS clusters CORRECT the visual position.
// - Stable GPS no longer blocks every visual step.
// - Standing still freezes visual movement.
// - Phone compass orientation never invents walking coordinates.
//
// ============================================================

const FALLBACK_STEP_LENGTH_METERS = 0.762;

// GPS used to learn movement direction may be slightly less precise
// because it never directly moves the player by itself.
const COURSE_MAX_ACCURACY_METERS = 15;

// GPS correction remains strict.
const CORRECTION_MAX_ACCURACY_METERS = 10;

const MIN_STABLE_GPS_SAMPLES = 3;
const RECENT_GPS_WINDOW = 8;
const MAX_GPS_CLUSTER_RADIUS_METERS = 7;

// Prevent one broken sensor event from producing a giant trail.
const MAX_STEP_DELTA_PER_UPDATE = 20;
const MAX_PENDING_STEPS = 40;

// GPS-derived movement course needs actual displacement.
const MIN_COURSE_DISTANCE_METERS = 1;
const MAX_COURSE_DISTANCE_METERS = 20;

// Ignore GPS headings when iOS does not believe the phone is moving.
const MIN_SPEED_FOR_GPS_HEADING = 0.35;

// Reject impossible walking/running GPS course calculations.
const MAX_VISUAL_SPEED_METERS_PER_SECOND = 5;

// GPS corrections are blended, never teleported.
const GPS_CORRECTION_BLEND = 0.4;
const MIN_CORRECTION_METERS = 0.35;
const MAX_CORRECTION_METERS = 15;

const MAX_VISUAL_POINTS = 400;

type Options = {
  steps: number;
  gpsPoints: Location.LocationObject[];
  headingDegrees: number | null;
};

export function usePreciseWalkTrack({
  steps,
  gpsPoints,
  headingDegrees: _headingDegrees,
}: Options) {
  // Kept in the API because Home still supplies phone heading for the relic
  // compass. Visual walking intentionally does NOT use phone orientation.
  void _headingDegrees;

  const [walkPoints, setWalkPoints] = useState<
    Location.LocationObject[]
  >([]);

  const currentLocationRef =
    useRef<Location.LocationObject | null>(null);

  const previousStepCountRef =
    useRef<number | null>(null);

  // Steps received before GPS has established a walking course.
  const pendingStepsRef = useRef(0);

  // Actual GPS movement direction.
  const courseBearingRef = useRef<number | null>(null);

  // Used to decide whether GPS is allowed to correct visual position.
  const stepsSinceCorrectionRef = useRef(0);

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
      stepsSinceCorrectionRef.current = 0;
      return;
    }

    const rawDelta =
      steps - previousStepCountRef.current;

    previousStepCountRef.current = steps;

    if (rawDelta <= 0) {
      return;
    }

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

    const current = currentLocationRef.current;
    const bearing = courseBearingRef.current;

    // GPS has not established movement direction yet.
    // Save these few steps and flush them as soon as course is known.
    if (!current || bearing === null) {
      pendingStepsRef.current = Math.min(
        MAX_PENDING_STEPS,
        pendingStepsRef.current + rawDelta,
      );

      return;
    }

    const created = createStepLocations(
      current,
      bearing,
      rawDelta,
    );

    if (created.length === 0) {
      return;
    }

    const newest = created[created.length - 1];

    currentLocationRef.current = newest;

    stepsSinceCorrectionRef.current +=
      created.length;

    setWalkPoints((existing) =>
      [...existing, ...created].slice(
        -MAX_VISUAL_POINTS,
      ),
    );
  }, [steps]);

  // ============================================================
  // LIVE GPS COURSE + STABLE CORRECTION
  // ============================================================

  useEffect(() => {
    const usableCoursePoints =
      getUsableGpsPoints(
        gpsPoints,
        COURSE_MAX_ACCURACY_METERS,
      );

    if (usableCoursePoints.length === 0) {
      return;
    }

    const latest =
      usableCoursePoints[
        usableCoursePoints.length - 1
      ];

    const nextBearing =
      getGpsMovementBearing(
        usableCoursePoints,
      );

    if (nextBearing !== null) {
      courseBearingRef.current = nextBearing;
    }

    // Start immediately from one good GPS position.
    // We no longer wait for three samples just to draw the player.
    if (!currentLocationRef.current) {
      currentLocationRef.current = latest;

      pendingStepsRef.current = 0;
      stepsSinceCorrectionRef.current = 0;

      setWalkPoints([latest]);

      return;
    }

    // If steps arrived before GPS established a direction,
    // release them now.
    const pendingSteps =
      pendingStepsRef.current;

    const bearing =
      courseBearingRef.current;

    if (
      pendingSteps > 0 &&
      bearing !== null &&
      currentLocationRef.current
    ) {
      const created = createStepLocations(
        currentLocationRef.current,
        bearing,
        pendingSteps,
      );

      if (created.length > 0) {
        const newest =
          created[created.length - 1];

        currentLocationRef.current =
          newest;

        stepsSinceCorrectionRef.current +=
          created.length;

        setWalkPoints((existing) =>
          [...existing, ...created].slice(
            -MAX_VISUAL_POINTS,
          ),
        );
      }

      pendingStepsRef.current = 0;
    }

    // ==========================================================
    // GPS CORRECTION
    // ==========================================================
    //
    // Three agreeing GPS readings are still useful.
    //
    // The difference is that they are now the correction layer,
    // rather than a gate that freezes every visible step.
    // ==========================================================

    const correctionAnchor =
      getStableGpsCorrectionAnchor(
        gpsPoints,
      );

    if (
      !correctionAnchor ||
      !currentLocationRef.current ||
      stepsSinceCorrectionRef.current <= 0
    ) {
      return;
    }

    const current =
      currentLocationRef.current;

    const distanceMeters =
      calculateDistanceMeters(
        {
          latitude:
            current.coords.latitude,
          longitude:
            current.coords.longitude,
        },
        {
          latitude:
            correctionAnchor.coords.latitude,
          longitude:
            correctionAnchor.coords.longitude,
        },
      );

    if (
      distanceMeters <
      MIN_CORRECTION_METERS
    ) {
      stepsSinceCorrectionRef.current = 0;
      return;
    }

    // The more actual steps we took, the more correction distance
    // we can reasonably allow.
    const plausibleCorrectionMeters =
      Math.min(
        MAX_CORRECTION_METERS,
        Math.max(
          4,
          stepsSinceCorrectionRef.current *
            FALLBACK_STEP_LENGTH_METERS *
            1.6 +
            3,
        ),
      );

    if (
      distanceMeters >
      plausibleCorrectionMeters
    ) {
      if (__DEV__) {
        console.log(
          "[Visual walk] Ignored GPS correction jump:",
          {
            distanceMeters,
            plausibleCorrectionMeters,
            accuracy:
              correctionAnchor.coords
                .accuracy,
          },
        );
      }

      return;
    }

    const corrected =
      blendLocations(
        current,
        correctionAnchor,
        GPS_CORRECTION_BLEND,
      );

    currentLocationRef.current =
      corrected;

    stepsSinceCorrectionRef.current = 0;

    // Replace the latest visual point rather than adding a fake
    // footprint just because GPS made a correction.
    setWalkPoints((existing) => {
      if (existing.length === 0) {
        return [corrected];
      }

      return [
        ...existing.slice(0, -1),
        corrected,
      ].slice(-MAX_VISUAL_POINTS);
    });
  }, [gpsPoints]);

  return walkPoints;
}

// ============================================================
// GPS COURSE
// ============================================================

function getGpsMovementBearing(
  points: Location.LocationObject[],
) {
  if (points.length === 0) {
    return null;
  }

  const latest =
    points[points.length - 1];

  const heading =
    latest.coords.heading;

  const speed =
    latest.coords.speed;

  // iOS Core Location course heading is preferable because
  // it represents direction of travel, not direction the phone faces.
  if (
    typeof heading === "number" &&
    Number.isFinite(heading) &&
    heading >= 0 &&
    typeof speed === "number" &&
    Number.isFinite(speed) &&
    speed >= MIN_SPEED_FOR_GPS_HEADING
  ) {
    return normalizeBearing(heading);
  }

  if (points.length < 2) {
    return null;
  }

  const previous =
    points[points.length - 2];

  const distanceMeters =
    calculateDistanceMeters(
      {
        latitude:
          previous.coords.latitude,
        longitude:
          previous.coords.longitude,
      },
      {
        latitude:
          latest.coords.latitude,
        longitude:
          latest.coords.longitude,
      },
    );

  if (
    distanceMeters <
      MIN_COURSE_DISTANCE_METERS ||
    distanceMeters >
      MAX_COURSE_DISTANCE_METERS
  ) {
    return null;
  }

  const elapsedSeconds = Math.max(
    0.25,
    (latest.timestamp -
      previous.timestamp) /
      1000,
  );

  const impliedSpeed =
    distanceMeters / elapsedSeconds;

  if (
    impliedSpeed >
    MAX_VISUAL_SPEED_METERS_PER_SECOND
  ) {
    return null;
  }

  return getBearingDegrees(
    previous.coords.latitude,
    previous.coords.longitude,
    latest.coords.latitude,
    latest.coords.longitude,
  );
}

// ============================================================
// CREATE ONE VISUAL POSITION PER REAL STEP
// ============================================================

function createStepLocations(
  start: Location.LocationObject,
  bearingDegrees: number,
  count: number,
) {
  const safeCount = Math.max(
    0,
    Math.min(
      MAX_STEP_DELTA_PER_UPDATE,
      Math.floor(count),
    ),
  );

  const created:
    Location.LocationObject[] = [];

  let current = start;

  for (
    let index = 0;
    index < safeCount;
    index += 1
  ) {
    current = moveLocationByMeters(
      current,
      bearingDegrees,
      FALLBACK_STEP_LENGTH_METERS,
      Date.now() + index,
    );

    created.push(current);
  }

  return created;
}

// ============================================================
// STABLE GPS CORRECTION
// ============================================================

function getStableGpsCorrectionAnchor(
  points: Location.LocationObject[],
) {
  const usable = getUsableGpsPoints(
    points,
    CORRECTION_MAX_ACCURACY_METERS,
  ).slice(-RECENT_GPS_WINDOW);

  if (
    usable.length <
    MIN_STABLE_GPS_SAMPLES
  ) {
    return null;
  }

  const recent = usable.slice(
    -Math.min(5, usable.length),
  );

  const latitude = median(
    recent
      .map(
        (point) =>
          point.coords.latitude,
      )
      .sort((a, b) => a - b),
  );

  const longitude = median(
    recent
      .map(
        (point) =>
          point.coords.longitude,
      )
      .sort((a, b) => a - b),
  );

  const center = {
    latitude,
    longitude,
  };

  const clustered = recent.filter(
    (point) => {
      const distance =
        calculateDistanceMeters(
          center,
          {
            latitude:
              point.coords.latitude,
            longitude:
              point.coords.longitude,
          },
        );

      return (
        distance <=
        MAX_GPS_CLUSTER_RADIUS_METERS
      );
    },
  );

  if (
    clustered.length <
    MIN_STABLE_GPS_SAMPLES
  ) {
    return null;
  }

  // The cluster proves GPS is stable.
  //
  // Return the NEWEST point inside that stable cluster instead
  // of returning the median coordinate. This avoids making the
  // visual player trail several seconds behind the walker.
  return [...clustered].sort(
    (left, right) =>
      right.timestamp - left.timestamp,
  )[0];
}

// ============================================================
// GPS FILTER
// ============================================================

function getUsableGpsPoints(
  points: Location.LocationObject[],
  maximumAccuracy: number,
) {
  return points
    .slice(-RECENT_GPS_WINDOW)
    .filter((point) => {
      const {
        latitude,
        longitude,
        accuracy,
      } = point.coords;

      return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        typeof accuracy === "number" &&
        Number.isFinite(accuracy) &&
        accuracy <= maximumAccuracy
      );
    });
}

// ============================================================
// GPS CORRECTION BLEND
// ============================================================

function blendLocations(
  current: Location.LocationObject,
  target: Location.LocationObject,
  ratio: number,
): Location.LocationObject {
  const safeRatio = Math.max(
    0,
    Math.min(1, ratio),
  );

  return {
    ...target,

    timestamp: Math.max(
      current.timestamp,
      target.timestamp,
    ),

    coords: {
      ...target.coords,

      latitude:
        current.coords.latitude +
        (target.coords.latitude -
          current.coords.latitude) *
          safeRatio,

      longitude:
        current.coords.longitude +
        (target.coords.longitude -
          current.coords.longitude) *
          safeRatio,
    },
  };
}

// ============================================================
// STEP OFFSET
// ============================================================

function moveLocationByMeters(
  from: Location.LocationObject,
  bearingDegrees: number,
  distanceMeters: number,
  timestamp: number,
): Location.LocationObject {
  const earthRadiusMeters =
    6_371_000;

  const latitude1 =
    toRadians(
      from.coords.latitude,
    );

  const longitude1 =
    toRadians(
      from.coords.longitude,
    );

  const bearing =
    toRadians(
      normalizeBearing(
        bearingDegrees,
      ),
    );

  const angularDistance =
    distanceMeters /
    earthRadiusMeters;

  const latitude2 = Math.asin(
    Math.sin(latitude1) *
      Math.cos(angularDistance) +
      Math.cos(latitude1) *
        Math.sin(angularDistance) *
        Math.cos(bearing),
  );

  const longitude2 =
    longitude1 +
    Math.atan2(
      Math.sin(bearing) *
        Math.sin(angularDistance) *
        Math.cos(latitude1),
      Math.cos(angularDistance) -
        Math.sin(latitude1) *
          Math.sin(latitude2),
    );

  return {
    ...from,

    timestamp,

    coords: {
      ...from.coords,

      latitude:
        toDegrees(latitude2),

      longitude:
        normalizeLongitude(
          toDegrees(longitude2),
        ),

      heading:
        normalizeBearing(
          bearingDegrees,
        ),

      // Synthetic visual point only.
      // Secure GPS never receives this value.
      speed: null,
    },
  };
}

// ============================================================
// BEARING
// ============================================================

function getBearingDegrees(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const latitude1 =
    toRadians(fromLatitude);

  const latitude2 =
    toRadians(toLatitude);

  const longitudeDifference =
    toRadians(
      toLongitude -
        fromLongitude,
    );

  const y =
    Math.sin(longitudeDifference) *
    Math.cos(latitude2);

  const x =
    Math.cos(latitude1) *
      Math.sin(latitude2) -
    Math.sin(latitude1) *
      Math.cos(latitude2) *
      Math.cos(
        longitudeDifference,
      );

  return normalizeBearing(
    toDegrees(
      Math.atan2(y, x),
    ),
  );
}

function normalizeBearing(
  bearing: number,
) {
  return (
    ((bearing % 360) + 360) %
    360
  );
}

function normalizeLongitude(
  longitude: number,
) {
  return (
    ((longitude + 540) %
      360) -
    180
  );
}

function toRadians(
  degrees: number,
) {
  return (
    (degrees * Math.PI) /
    180
  );
}

function toDegrees(
  radians: number,
) {
  return (
    (radians * 180) /
    Math.PI
  );
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const middle =
    Math.floor(
      values.length / 2,
    );

  if (
    values.length % 2 ===
    0
  ) {
    return (
      (values[middle - 1] +
        values[middle]) /
      2
    );
  }

  return values[middle];
}
