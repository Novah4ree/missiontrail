import type { LocationObject } from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RELICS, type Relic } from '@/constants/relics';
import {
  collectRevealedRelic,
  findNearestRelic,
  getMysteryZones,
  locationsToProximitySamples,
  placeDevelopmentTestRelic,
  RelicProximityError,
} from '@/services/relic-proximity';
import { cacheServerCollection, getPlayerProgress } from '@/utils/player-progress';
import type { MysteryZone, RelicProximityStatus, RevealedRelic } from '@/types/relic-proximity';

type Options = {
  enabled: boolean;
  gpsPoints: LocationObject[];
  onCollected: (relic: Relic, totalXp: number) => void;
};

export function useSecureRelicField({ enabled, gpsPoints, onCollected }: Options) {
  const gpsPointsRef = useRef(gpsPoints);
  const [zones, setZones] = useState<MysteryZone[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [status, setStatus] = useState<RelicProximityStatus>('mystery_zone_visible');
  const [message, setMessage] = useState('Looking for Hidden Relic Areas…');
  const [clueStrength, setClueStrength] = useState<0 | 1 | 2 | 3>(0);
  const [distanceFeet, setDistanceFeet] = useState<number | null>(null);
  const [bearingDegrees, setBearingDegrees] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<RevealedRelic | null>(null);
  const [revealLastSampleAt, setRevealLastSampleAt] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [refreshAfterSeconds, setRefreshAfterSeconds] = useState<number | null>(null);

  useEffect(() => {
    gpsPointsRef.current = gpsPoints;
  }, [gpsPoints]);

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.assignmentId === selectedAssignmentId) ?? zones[0] ?? null,
    [selectedAssignmentId, zones],
  );
  const finalSamples = gpsPoints.filter((point) => point.timestamp > revealLastSampleAt).slice(-3);

  const refreshField = useCallback(async () => {
    const currentGpsPoints = gpsPointsRef.current;
    if (!enabled || currentGpsPoints.length < 3) return;
    setIsBusy(true);
    try {
      const field = await getMysteryZones(locationsToProximitySamples(currentGpsPoints));
      setZones(field.zones);
      setSelectedAssignmentId((current) => (
        field.zones.some((zone) => zone.assignmentId === current)
          ? current
          : field.zones[0]?.assignmentId ?? null
      ));
      setRefreshAfterSeconds(field.refreshAfterSeconds);
      setRevealed(null);
      setRevealLastSampleAt(0);
      setClueStrength(0);
      setDistanceFeet(null);
      setBearingDegrees(null);
      setMessage(field.limitation
        ? 'Hidden Relic Areas are not ready here yet. Try another trail or park.'
        : field.zones.length ? 'A Hidden Relic Area is nearby. Follow the clues!' : 'No Hidden Relic Areas are nearby right now. Keep exploring!');
      setStatus('mystery_zone_visible');
    } catch (error) {
      setStatus('offline_retry');
      setMessage(error instanceof RelicProximityError ? error.message : 'The map is offline. Tap retry when connected.');
    } finally {
      setIsBusy(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled && gpsPoints.length === 3 && zones.length === 0) void refreshField();
  }, [enabled, gpsPoints.length, refreshField, zones.length]);

  useEffect(() => {
    if (!enabled || refreshAfterSeconds === null) return;
    const timer = setTimeout(() => {
      setMessage('These relics moved! Looking for new Hidden Relic Areas…');
      void refreshField();
    }, Math.max(1, refreshAfterSeconds) * 1_000 + 750);
    return () => clearTimeout(timer);
  }, [enabled, refreshAfterSeconds, refreshField]);

  const scan = useCallback(async () => {
    if (gpsPoints.length < 3) {
      setStatus('improving_accuracy');
      setMessage('Finding your location… Move to an open area.');
      return;
    }
    const minimumSearchFeedback = new Promise<void>((resolve) => {
      setTimeout(resolve, 700);
    });
    setMessage('Searching for relics…');
    setDistanceFeet(null);
    setBearingDegrees(null);
    setIsBusy(true);
    try {
      const [result] = await Promise.all([
        findNearestRelic(locationsToProximitySamples(gpsPoints)),
        minimumSearchFeedback,
      ]);
      setStatus(result.status);
      setMessage(result.message);
      setClueStrength(result.clueStrength ?? 0);
      setDistanceFeet(result.distanceFeet ?? null);
      setBearingDegrees(result.bearingDegrees ?? null);
      if (result.status === 'revealed' && result.relic) {
        if (result.assignmentId) setSelectedAssignmentId(result.assignmentId);
        setRevealed(result.relic);
        setRevealLastSampleAt(gpsPoints.at(-1)?.timestamp ?? Date.now());
      }
    } catch (error) {
      await minimumSearchFeedback;
      setStatus('offline_retry');
      setMessage(error instanceof RelicProximityError ? error.message : 'We lost the connection. Tap Try Again.');
    } finally {
      setIsBusy(false);
    }
  }, [gpsPoints]);

  const placeTestRelic = useCallback(async () => {
    if (gpsPoints.length < 3) {
      setStatus('improving_accuracy');
      setMessage('Finding your location… Move to an open area.');
      return;
    }
    setIsBusy(true);
    try {
      const placed = await placeDevelopmentTestRelic(locationsToProximitySamples(gpsPoints));
      await refreshField();
      setSelectedAssignmentId(placed.assignmentId);
      setStatus('mystery_zone_visible');
      setDistanceFeet(null);
      setBearingDegrees(null);
      setMessage(placed.message);
    } catch (error) {
      setStatus('offline_retry');
      setMessage(error instanceof RelicProximityError
        ? error.message
        : 'The test relic could not be placed. Tap Try Again.');
    } finally {
      setIsBusy(false);
    }
  }, [gpsPoints, refreshField]);

  const collect = useCallback(async () => {
    if (!selectedZone || !revealed) return;
    if (finalSamples.length < 3) {
      setStatus('improving_accuracy');
      setMessage('Checking your location… Hold still for a moment.');
      return;
    }
    setStatus('collection_processing');
    setIsBusy(true);
    try {
      const result = await collectRevealedRelic(
        selectedZone.assignmentId,
        locationsToProximitySamples(finalSamples),
      );
      setStatus(result.status);
      setMessage(result.message);
      const relic = RELICS.find((item) => item.id === (result.collection?.relicId ?? result.relic?.id));
      if (relic && result.collection) {
        await cacheServerCollection(relic, result.collection.collectedAt, result.collection.xpAwarded);
        const progress = await getPlayerProgress();
        onCollected(relic, progress.totalXp);
        setZones((current) => current.filter((zone) => zone.assignmentId !== selectedZone.assignmentId));
        setRevealed(null);
        setRevealLastSampleAt(0);
        setClueStrength(0);
        setDistanceFeet(null);
        setBearingDegrees(null);
      }
    } catch (error) {
      setStatus('offline_retry');
      setMessage(error instanceof RelicProximityError ? error.message : 'We lost the connection. Tap Collect Relic again.');
    } finally {
      setIsBusy(false);
    }
  }, [finalSamples, onCollected, revealed, selectedZone]);

  return {
    zones, selectedZone, selectedAssignmentId, setSelectedAssignmentId,
    status, message, clueStrength, distanceFeet, bearingDegrees, revealed, isBusy,
    freshFinalReadingCount: finalSamples.length,
    refreshField, scan, placeTestRelic, collect,
  };
}
