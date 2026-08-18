import type { LocationObject } from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RELICS, type Relic } from "@/constants/relics";
import {
  collectRevealedRelic,
  getMysteryZones,
  locationsToProximitySamples,
  placeDevelopmentTestRelic,
  RelicProximityError,
  scanNearbyRelics,
} from "@/services/relic-proximity";
import type {
  MysteryZone,
  NearbyRelicSignal,
  RelicProximityStatus,
  RevealedRelic,
} from "@/types/relic-proximity";
import { calculateDistanceMeters } from "@/utils/distance";
import {
  getRelicHuntStage,
  hasCrossedHuntFallbackMargin,
  isCloserHuntStage,
  isFartherHuntStage,
  type RelicHuntStage,
} from "@/utils/relic-hunt";
import {
  getNearestAvailableRelicSignal,
  getRadarRefreshPolicy,
} from "@/utils/relic-radar";
import {
  cacheServerCollection,
  getPlayerProgress,
} from "@/utils/player-progress";
import { playRelicCollectHaptics } from "@/utils/game-haptics";

type Options = {
  enabled: boolean;
  gpsPoints: LocationObject[];
  onCollected: (relic: Relic, totalXp: number) => void;
  onRelicStageChanged?: (from: RelicHuntStage, to: RelicHuntStage) => void;
  onRelicSignalLocked?: () => void;
  onRelicRevealed?: () => void;
};

// Purpose: Provides the secure relic field React hook behavior.
export function useSecureRelicField({
  enabled,
  gpsPoints,
  onCollected,
  onRelicStageChanged,
  onRelicSignalLocked,
  onRelicRevealed,
}: Options) {
  const gpsPointsRef = useRef(gpsPoints);
  const initialFieldRequestRef = useRef(false);
  const initialFieldRetryNotBeforeRef = useRef(0);
  const lastRadarScanAtRef = useRef(0);
  const lastRadarLocationRef = useRef<LocationObject | null>(null);
  const scanInFlightRef = useRef(false);

  // A single weak GPS reading should not erase an active relic hunt.
  // Keep the last known-good signal briefly while GPS recovers.
  const lastGoodSignalAtRef = useRef(0);

  const selectedAssignmentIdRef = useRef<string | null>(null);
  const targetModeRef = useRef<"auto" | "manual">("auto");
  const huntStageRef = useRef<RelicHuntStage>("SEARCHING");
  const huntTargetRef = useRef<string | null>(null);
  const fallbackStageRef = useRef<{
    stage: RelicHuntStage;
    count: number;
  } | null>(null);

  const [zones, setZones] = useState<MysteryZone[]>([]);
  const [signals, setSignals] = useState<NearbyRelicSignal[]>([]);
  const [targetMode, setTargetMode] = useState<"auto" | "manual">("auto");
  const [huntStage, setHuntStage] = useState<RelicHuntStage>("SEARCHING");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);
  const [status, setStatus] = useState<RelicProximityStatus>(
    "mystery_zone_visible",
  );
  const [message, setMessage] = useState("Looking for Hidden Relic Areas…");
  const [clueStrength, setClueStrength] = useState<0 | 1 | 2 | 3>(0);
  const [distanceFeet, setDistanceFeet] = useState<number | null>(null);
  const [bearingDegrees, setBearingDegrees] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<RevealedRelic | null>(null);
  const [collectionExpiresAt, setCollectionExpiresAt] = useState<string | null>(
    null,
  );
  const [relicEnergyWarning, setRelicEnergyWarning] = useState(false);
  const [revealLastSampleAt, setRevealLastSampleAt] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [scanState, setScanState] = useState<
    "idle" | "scanning" | "found" | "empty" | "error"
  >("idle");
  const [refreshAfterSeconds, setRefreshAfterSeconds] = useState<number | null>(
    null,
  );

  useEffect(() => {
    gpsPointsRef.current = gpsPoints;
  }, [gpsPoints]);

  useEffect(() => {
    selectedAssignmentIdRef.current = selectedAssignmentId;
  }, [selectedAssignmentId]);

  useEffect(() => {
    targetModeRef.current = targetMode;
  }, [targetMode]);

  useEffect(() => {
    if (!revealed || !collectionExpiresAt) {
      setRelicEnergyWarning(false);
      return;
    }

    const expirationTime = Date.parse(collectionExpiresAt);

    if (!Number.isFinite(expirationTime)) {
      return;
    }

    // No countdown is displayed.
    // Give exactly one warning when about 2 minutes remain.
    const warningTime = expirationTime - 2 * 60 * 1000;
    const delay = warningTime - Date.now();

    const showWarning = () => {
      setRelicEnergyWarning(true);
      setMessage("Relic energy fading. Claim this relic soon.");
    };

    if (delay <= 0) {
      showWarning();
      return;
    }

    const timer = setTimeout(showWarning, delay);

    return () => clearTimeout(timer);
  }, [collectionExpiresAt, revealed]);

  const selectedZone = useMemo(
    () =>
      zones.find((zone) => zone.assignmentId === selectedAssignmentId) ??
      zones[0] ??
      null,
    [selectedAssignmentId, zones],
  );
  const selectedSignal = useMemo(
    () =>
      signals.find((signal) => signal.assignmentId === selectedAssignmentId) ??
      null,
    [selectedAssignmentId, signals],
  );
  const latestGpsTimestamp = gpsPoints.at(-1)?.timestamp ?? 0;
  const selectedSignalDistanceFeet = selectedSignal?.distanceFeet ?? null;
  const huntDistanceFeet = selectedSignalDistanceFeet ?? distanceFeet;
  // Keep a slightly larger post-reveal GPS window, then count only
  // samples that are actually valid for secure server collection.
  //
  // Previously the UI counted 3 RAW readings as "ready", but collect()
  // filtered them again. That could show LOCATION VERIFIED / CLAIM RELIC
  // and then immediately reject the collection.
  const finalSamples = useMemo(
    () =>
      locationsToProximitySamples(
        gpsPoints
          .filter((point) => point.timestamp > revealLastSampleAt)
          .slice(-10),
      ).slice(-2),
    [gpsPoints, revealLastSampleAt],
  );

  useEffect(() => {
    const candidate = getRelicHuntStage(huntDistanceFeet, status);
    const targetChanged = huntTargetRef.current !== selectedAssignmentId;

    if (targetChanged) {
      huntTargetRef.current = selectedAssignmentId;
      fallbackStageRef.current = null;
      huntStageRef.current = candidate;
      setHuntStage(candidate);
      return;
    }

    const current = huntStageRef.current;
    if (candidate === current || candidate === "SEARCHING") {
      fallbackStageRef.current = null;
      return;
    }

    // Purpose: Implements the commit stage operation.
    const commitStage = (next: RelicHuntStage) => {
      const previous = huntStageRef.current;
      huntStageRef.current = next;
      fallbackStageRef.current = null;
      setHuntStage(next);
      onRelicStageChanged?.(previous, next);
      if (next === "SIGNAL_LOCKED") onRelicSignalLocked?.();
      if (next === "FOUND") onRelicRevealed?.();
      if (__DEV__) {
        console.log("[RELIC HUNT] stage changed", {
          from: previous,
          to: next,
          distanceFeet: huntDistanceFeet,
        });
      }
    };

    if (candidate === "FOUND" || isCloserHuntStage(current, candidate)) {
      commitStage(candidate);
      return;
    }

    if (
      !isFartherHuntStage(current, candidate) ||
      !hasCrossedHuntFallbackMargin(current, huntDistanceFeet)
    ) {
      fallbackStageRef.current = null;
      return;
    }

    const pending = fallbackStageRef.current;
    if (pending?.stage === candidate) {
      if (pending.count + 1 >= 2) commitStage(candidate);
      else
        fallbackStageRef.current = {
          stage: candidate,
          count: pending.count + 1,
        };
    } else {
      fallbackStageRef.current = { stage: candidate, count: 1 };
    }
  }, [
    huntDistanceFeet,
    onRelicRevealed,
    onRelicSignalLocked,
    onRelicStageChanged,
    selectedAssignmentId,
    status,
  ]);

  // Purpose: Implements the refresh field operation.
  const refreshField = useCallback(async () => {
    const currentGpsPoints = gpsPointsRef.current;
    if (!enabled) {
      return;
    }

    if (currentGpsPoints.length < 2) {
      setStatus("improving_accuracy");
      setMessage(
        "Getting an accurate GPS lock… Hold still in an open area for a moment.",
      );
      return;
    }
    setIsBusy(true);

    if (__DEV__) {
      console.log("[RELIC FIELD] refresh requested", {
        gpsPointCount: currentGpsPoints.length,
        enabled,
      });
    }

    try {
      const diagnosticSamples = locationsToProximitySamples(currentGpsPoints);

      if (__DEV__) {
        const now = Date.now();

        console.log(
          "[RELIC GPS CHECK]",
          diagnosticSamples.map((sample, index) => ({
            index,
            accuracyMeters: sample.accuracyMeters,
            mocked: sample.mocked,
            ageMs: now - Date.parse(sample.capturedAt),
            deltaFromPreviousMs:
              index === 0
                ? null
                : Date.parse(sample.capturedAt) -
                  Date.parse(diagnosticSamples[index - 1].capturedAt),
          })),
        );
      }

      const field = await getMysteryZones(diagnosticSamples);

      // A successful field request clears any temporary GPS retry cooldown.
      initialFieldRetryNotBeforeRef.current = 0;
      if (__DEV__) {
        console.log("[RELIC FIELD]", {
          zoneCount: field.zones.length,
          available: field.zones.filter(
            (zone) => zone.availability === "available",
          ).length,
          locked: field.zones.filter((zone) => zone.availability === "locked")
            .length,
        });
      }

      setZones(field.zones);
      const targetStillActive = field.zones.some(
        (zone) =>
          zone.assignmentId === selectedAssignmentIdRef.current &&
          zone.availability === "available",
      );
      if (!targetStillActive) {
        targetModeRef.current = "auto";
        selectedAssignmentIdRef.current = null;
        setTargetMode("auto");
        setSelectedAssignmentId(null);
      }
      setSignals([]);
      setScanState("idle");
      setRefreshAfterSeconds(field.refreshAfterSeconds);
      setRevealed(null);
      setCollectionExpiresAt(null);
      setRelicEnergyWarning(false);
      setRevealLastSampleAt(0);
      setClueStrength(0);
      setDistanceFeet(null);
      setBearingDegrees(null);
      setMessage(
        field.limitation
          ? "Hidden Relic Areas are not ready here yet. Try another trail or park."
          : field.zones.length
            ? "A Hidden Relic Area is nearby. Follow the clues!"
            : "No Hidden Relic Areas are nearby right now. Keep exploring!",
      );
      setStatus("mystery_zone_visible");
    } catch (error) {
      // A failed anchor should recover automatically, but not on every single
      // GPS callback. Give the phone a short quiet window to improve its fix.
      initialFieldRequestRef.current = false;

      const retryCooldownMs = 4_000;
      initialFieldRetryNotBeforeRef.current = Date.now() + retryCooldownMs;

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const isGpsLockError =
        errorMessage.includes("safer GPS lock") ||
        errorMessage.includes("GPS lock");

      if (__DEV__) {
        console.log("[RELIC FIELD] recovery cooldown", {
          reason: isGpsLockError ? "gps_accuracy" : "request_error",
          retryInMs: retryCooldownMs,
        });
      }

      if (isGpsLockError) {
        setStatus("improving_accuracy");
        setMessage("Refining GPS… Hold steady for a moment.");
      } else {
        setStatus("offline_retry");
        setMessage(
          error instanceof RelicProximityError
            ? error.message
            : "The map is offline. Tap retry when connected.",
        );
      }
    } finally {
      setIsBusy(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      initialFieldRequestRef.current = false;
      initialFieldRetryNotBeforeRef.current = 0;
      return;
    }

    if (
      gpsPoints.length < 2 ||
      initialFieldRequestRef.current ||
      Date.now() < initialFieldRetryNotBeforeRef.current
    ) {
      return;
    }

    initialFieldRequestRef.current = true;

    void refreshField();
  }, [enabled, gpsPoints.length, refreshField]);
  useEffect(() => {
    if (!enabled || refreshAfterSeconds === null) return;

    // IMPORTANT:
    // Never rotate/rebuild the relic field while the player is actively
    // hunting a target or has already revealed one.
    //
    // A long walk should keep the same relic locked.
    if (selectedAssignmentId || revealed) {
      return;
    }

    const timer = setTimeout(
      () => {
        setMessage("Refreshing nearby Hidden Relic Areas…");
        void refreshField();
      },
      Math.max(1, refreshAfterSeconds) * 1_000 + 750,
    );

    return () => clearTimeout(timer);
  }, [
    enabled,
    refreshAfterSeconds,
    refreshField,
    revealed,
    selectedAssignmentId,
  ]);

  // Purpose: Implements the scan operation.
  const scan = useCallback(async (silent = false) => {
    const currentGpsPoints = gpsPointsRef.current;

    if (__DEV__ && !silent) console.log("[RELIC UI] scan pressed");
    if (scanInFlightRef.current) {
      if (!silent) {
        setScanState("scanning");
        setMessage("A relic scan is already running…");
      }
      return;
    }
    if (currentGpsPoints.length < 2) {
      setScanState("error");
      setStatus("improving_accuracy");
      setMessage("Finding your location… Move to an open area.");
      return;
    }
    const minimumSearchFeedback = new Promise<void>((resolve) => {
      setTimeout(resolve, 700);
    });
    if (!silent) {
      setMessage("Searching for relics…");
    }

    // Keep the last known distance and direction visible while
    // the next GPS/server reading is being checked.
    scanInFlightRef.current = true;
    setScanState("scanning");
    setIsBusy(true);
    lastRadarScanAtRef.current = Date.now();
    lastRadarLocationRef.current = currentGpsPoints.at(-1) ?? null;
    try {
      const [result] = await Promise.all([
        scanNearbyRelics(
          locationsToProximitySamples(currentGpsPoints),
          targetModeRef.current === "manual"
            ? (selectedAssignmentIdRef.current ?? undefined)
            : undefined,
        ),
        minimumSearchFeedback,
      ]);
      if (__DEV__) {
        console.log("[RELIC RADAR]", {
          signalCount: result.signals?.length ?? 0,
          availableCount:
            result.signals?.filter(
              (signal) => signal.availability === "available",
            ).length ?? 0,
          lockedCount:
            result.signals?.filter((signal) => signal.availability === "locked")
              .length ?? 0,
          nearestFeet: result.signals?.[0]?.distanceFeet ?? null,
          selectedAssignmentId: result.assignmentId ?? null,
        });
      }

      const nextSignals = result.signals ?? [];
      const availableSignals = nextSignals.filter(
        (signal) => signal.availability === "available",
      );

      const previousTargetId = selectedAssignmentIdRef.current;

      const previousTargetSignal = previousTargetId
        ? (nextSignals.find(
            (signal) =>
              signal.assignmentId === previousTargetId &&
              signal.availability === "available",
          ) ?? null)
        : null;

      const serverSuggestedSignal = result.assignmentId
        ? (nextSignals.find(
            (signal) =>
              signal.assignmentId === result.assignmentId &&
              signal.availability === "available",
          ) ?? null)
        : null;

      // Once a relic has been selected, KEEP IT.
      // Do not jump to another nearby relic just because GPS fluctuates.
      const activeSignal =
        previousTargetSignal ??
        serverSuggestedSignal ??
        availableSignals[0] ??
        null;

      const temporaryGpsProblem =
        result.status === "improving_accuracy" ||
        result.status === "invalid_movement";

      // =====================================================
      // SIGNAL HOLD
      // =====================================================
      //
      // A weak GPS sample does NOT mean the relic disappeared.
      // Keep the previous target, distance, bearing and clue visible.
      //
      // There is intentionally no short 20-second timeout here.
      // A player can be on a long walk and the hunt remains active.
      if (previousTargetId && nextSignals.length === 0 && temporaryGpsProblem) {
        setStatus(result.status);
        setScanState("found");

        setMessage(
          result.status === "invalid_movement"
            ? "Movement check in progress… Relic target remains locked."
            : "GPS adjusting… Relic target remains locked.",
        );

        if (__DEV__) {
          console.log("[RELIC TARGET HELD]", {
            assignmentId: previousTargetId,
            status: result.status,
            distanceFeet,
            bearingDegrees,
          });
        }

        return;
      }

      // Also hold the active target through a temporary empty response.
      //
      // The server can recover on the next automatic scan.
      if (
        previousTargetId &&
        nextSignals.length === 0 &&
        result.status !== "expired" &&
        result.status !== "collected" &&
        result.status !== "ineligible"
      ) {
        setStatus(result.status);
        setScanState("found");

        setMessage("Relic signal temporarily weak… Target remains locked.");

        if (__DEV__) {
          console.log("[RELIC TARGET HELD]", {
            assignmentId: previousTargetId,
            status: result.status,
          });
        }

        return;
      }

      setSignals(nextSignals);

      if (activeSignal) {
        // Lock onto this assignment.
        // From this point forward scans specifically follow this relic.
        targetModeRef.current = "manual";
        selectedAssignmentIdRef.current = activeSignal.assignmentId;

        setTargetMode("manual");
        setSelectedAssignmentId(activeSignal.assignmentId);

        setScanState("found");
        setStatus(result.status);
        setMessage(result.message);

        setDistanceFeet(activeSignal.distanceFeet);

        setBearingDegrees(activeSignal.bearingDegrees);

        setClueStrength(activeSignal.clueStrength);

        if (__DEV__) {
          console.log("[RELIC TARGET LOCKED]", {
            assignmentId: activeSignal.assignmentId,
            distanceFeet: activeSignal.distanceFeet,
          });
        }
      } else {
        const targetReallyEnded =
          result.status === "expired" ||
          result.status === "collected" ||
          result.status === "ineligible";

        // Only release the target when the SERVER tells us the
        // assignment is actually finished.
        if (targetReallyEnded) {
          targetModeRef.current = "auto";
          selectedAssignmentIdRef.current = null;

          setTargetMode("auto");
          setSelectedAssignmentId(null);

          setDistanceFeet(null);
          setBearingDegrees(null);
          setClueStrength(0);
        }

        setStatus(result.status);

        if (targetReallyEnded) {
          setScanState("empty");
          setMessage(result.message);
        } else {
          setScanState(previousTargetId ? "found" : "empty");

          setMessage(
            previousTargetId
              ? "Relic target remains locked. Waiting for the next GPS update."
              : "No available relic signal is active nearby yet.",
          );
        }
      }

      if (result.clueStrength !== undefined) {
        setClueStrength(result.clueStrength);
      }
      // When an active signal exists, its distance/bearing are the
      // authoritative navigation values for this hunt.
      //
      // Do not immediately overwrite them with nullable top-level
      // response fields from the same scan.
      if (!activeSignal && result.distanceFeet !== undefined) {
        setDistanceFeet(result.distanceFeet);
      }

      if (
        !activeSignal &&
        (result.bearingDegrees !== undefined ||
          result.encounterType === "ambient")
      ) {
        setBearingDegrees(result.bearingDegrees ?? null);
      }
      if (__DEV__) {
        console.log("[RELIC HUNT] server status", { status: result.status });
        console.log("[RELIC HUNT] scan", {
          stage: getRelicHuntStage(result.distanceFeet ?? null, result.status),
          distanceFeet: result.distanceFeet ?? null,
          direction: result.direction ?? null,
        });
      }
      if (result.status === "revealed" && result.relic) {
        if (result.assignmentId) setSelectedAssignmentId(result.assignmentId);

        setRevealed(result.relic);
        setCollectionExpiresAt(result.challenge?.expiresAt ?? null);
        setRelicEnergyWarning(false);

        setRevealLastSampleAt(currentGpsPoints.at(-1)?.timestamp ?? Date.now());
      }
    } catch (error) {
      await minimumSearchFeedback;
      setScanState("error");
      setStatus("offline_retry");
      setMessage(
        error instanceof RelicProximityError
          ? error.message
          : "We lost the connection. Tap Try Again.",
      );
    } finally {
      scanInFlightRef.current = false;
      setIsBusy(false);
    }
  }, []);

  // =====================================================
  // AUTOMATIC NEAREST RELIC RADAR
  // =====================================================
  //
  // Once the server has created Hidden Relic Areas,
  // automatically check for the nearest relic as GPS updates.
  //
  // The client receives distance + bearing only.
  // Exact relic coordinates remain server-side.

  useEffect(() => {
    if (
      !enabled ||
      zones.length === 0 ||
      gpsPoints.length < 2 ||
      isBusy ||
      revealed
    ) {
      return;
    }

    if (!latestGpsTimestamp) {
      return;
    }

    const latestLocation = gpsPointsRef.current.at(-1);
    if (!latestLocation) return;
    const policy = getRadarRefreshPolicy(selectedSignalDistanceFeet);
    const elapsed = Date.now() - lastRadarScanAtRef.current;
    const movedMeters = lastRadarLocationRef.current
      ? calculateDistanceMeters(
          {
            latitude: lastRadarLocationRef.current.coords.latitude,
            longitude: lastRadarLocationRef.current.coords.longitude,
          },
          {
            latitude: latestLocation.coords.latitude,
            longitude: latestLocation.coords.longitude,
          },
        )
      : Number.POSITIVE_INFINITY;

    if (
      elapsed < policy.intervalMs &&
      (elapsed < 8_000 || movedMeters < policy.movementMeters)
    ) {
      return;
    }

    void scan(true);
  }, [
    enabled,
    gpsPoints.length,
    latestGpsTimestamp,
    isBusy,
    revealed,
    scan,
    selectedSignalDistanceFeet,
    zones.length,
  ]);

  // Purpose: Selects signal.
  const selectSignal = useCallback(
    (assignmentId: string) => {
      const signal = signals.find(
        (candidate) => candidate.assignmentId === assignmentId,
      );
      if (!signal || signal.availability === "locked") return;
      targetModeRef.current = "manual";
      selectedAssignmentIdRef.current = assignmentId;
      setTargetMode("manual");
      setSelectedAssignmentId(assignmentId);
      setDistanceFeet(signal.distanceFeet);
      setBearingDegrees(signal.bearingDegrees);
      setClueStrength(signal.clueStrength);
      setMessage(
        signal.encounterType === "ambient"
          ? "Ambient signal all around you."
          : `Target locked. Head ${signal.direction ?? "toward the signal"}.`,
      );
    },
    [signals],
  );

  // Purpose: Provides the auto nearest React hook behavior.
  const useAutoNearest = useCallback(() => {
    targetModeRef.current = "auto";
    setTargetMode("auto");
    const nearestAvailable = getNearestAvailableRelicSignal(signals);
    selectedAssignmentIdRef.current = nearestAvailable?.assignmentId ?? null;
    setSelectedAssignmentId(nearestAvailable?.assignmentId ?? null);
    if (nearestAvailable) {
      setDistanceFeet(nearestAvailable.distanceFeet);
      setBearingDegrees(nearestAvailable.bearingDegrees);
      setClueStrength(nearestAvailable.clueStrength);
      setScanState("found");
      setMessage(
        nearestAvailable.encounterType === "ambient"
          ? "Auto Nearest selected an ambient signal all around you."
          : `Auto Nearest selected the closest available signal. Head ${nearestAvailable.direction ?? "toward the signal"}.`,
      );
      if (__DEV__) {
        console.log("[RELIC TARGET]", {
          mode: "auto",
          selectedAssignmentId: nearestAvailable.assignmentId,
        });
      }
    } else {
      setScanState("empty");
      setMessage(
        "No available signals are loaded. Tap Find Hidden Relic to refresh.",
      );
    }
  }, [signals]);

  // Purpose: Implements the place test relic operation.
  const placeTestRelic = useCallback(async () => {
    if (gpsPoints.length < 2) {
      setStatus("improving_accuracy");
      setMessage("Finding your location… Move to an open area.");
      return;
    }
    setIsBusy(true);
    try {
      const placed = await placeDevelopmentTestRelic(
        locationsToProximitySamples(gpsPoints),
      );
      await refreshField();
      targetModeRef.current = "manual";
      selectedAssignmentIdRef.current = placed.assignmentId;
      setTargetMode("manual");
      setSelectedAssignmentId(placed.assignmentId);
      setStatus("mystery_zone_visible");
      setDistanceFeet(null);
      setBearingDegrees(null);
      setMessage(placed.message);
    } catch (error) {
      setStatus("offline_retry");
      setMessage(
        error instanceof RelicProximityError
          ? error.message
          : "The test relic could not be placed. Tap Try Again.",
      );
    } finally {
      setIsBusy(false);
    }
  }, [gpsPoints, refreshField]);

  // Purpose: Implements the collect operation.
  const collect = useCallback(async () => {
    if (!selectedZone || !revealed) return;

    // finalSamples have already passed the same GPS validation used
    // for secure collection. Do not tell the player collection is ready
    // until three genuinely usable samples exist.
    const collectSamples = finalSamples;

    if (collectSamples.length < 3) {
      setStatus("improving_accuracy");
      setMessage(
        "Verifying your location… Hold still for a few seconds, then collect again.",
      );

      if (__DEV__) {
        console.log("[RELIC COLLECT WAITING]", {
          rawSampleCount: finalSamples.length,
          validSampleCount: collectSamples.length,
        });
      }

      return;
    }

    setStatus("collection_processing");
    setIsBusy(true);
    try {
      const result = await collectRevealedRelic(
        selectedZone.assignmentId,
        collectSamples,
      );

      if (__DEV__) {
        const collectSpreadMeters = collectSamples.flatMap((left, leftIndex) =>
          collectSamples.slice(leftIndex + 1).map((right) =>
            calculateDistanceMeters(
              {
                latitude: left.latitude,
                longitude: left.longitude,
              },
              {
                latitude: right.latitude,
                longitude: right.longitude,
              },
            ),
          ),
        );

        console.log("[RELIC COLLECT GPS]", {
          sampleCount: collectSamples.length,
          accuracies: collectSamples.map(
            (sample) => Math.round(sample.accuracyMeters * 10) / 10,
          ),
          spreadMeters: collectSpreadMeters.map(
            (meters) => Math.round(meters * 10) / 10,
          ),
        });

        console.log("[RELIC COLLECT RESULT]", {
          status: result.status,
          message: result.message,
          sampleCount: collectSamples.length,
          hasCollection: Boolean(result.collection),
          collectionRelicId: result.collection?.relicId ?? null,
          revealedRelicId: result.relic?.id ?? null,
        });
      }

      setStatus(result.status);
      setMessage(result.message);
      const relic = RELICS.find(
        (item) => item.id === (result.collection?.relicId ?? result.relic?.id),
      );
      if (relic && result.collection) {
        // Server confirmed the relic was collected.
        void playRelicCollectHaptics();
        await cacheServerCollection(
          relic,
          result.collection.id,
          result.collection.collectedAt,
          result.collection.xpAwarded,
        );
        const progress = await getPlayerProgress();
        onCollected(relic, progress.totalXp);
        setZones((current) =>
          current.filter(
            (zone) => zone.assignmentId !== selectedZone.assignmentId,
          ),
        );
        setSignals((current) =>
          current.filter(
            (signal) => signal.assignmentId !== selectedZone.assignmentId,
          ),
        );
        targetModeRef.current = "auto";
        selectedAssignmentIdRef.current = null;
        setTargetMode("auto");
        setSelectedAssignmentId(null);
        setRevealed(null);
        setCollectionExpiresAt(null);
        setRelicEnergyWarning(false);
        setRevealLastSampleAt(0);
        setClueStrength(0);
        setDistanceFeet(null);
        setBearingDegrees(null);
      }
    } catch (error) {
      setStatus("offline_retry");
      setMessage(
        error instanceof RelicProximityError
          ? error.message
          : "We lost the connection. Tap Collect Relic again.",
      );
    } finally {
      setIsBusy(false);
    }
  }, [finalSamples, onCollected, revealed, selectedZone]);

  return {
    zones,
    signals,
    selectedZone,
    selectedSignal,
    selectedAssignmentId,
    targetMode,
    huntStage,
    huntDistanceFeet,
    selectSignal,
    useAutoNearest,
    status,
    message,
    clueStrength,
    distanceFeet: selectedSignal?.distanceFeet ?? distanceFeet,
    bearingDegrees: selectedSignal?.bearingDegrees ?? bearingDegrees,
    revealed,
    relicEnergyWarning,
    isBusy,
    scanState,
    freshFinalReadingCount: finalSamples.length,
    refreshField,
    scan,
    placeTestRelic,
    collect,
  };
}
