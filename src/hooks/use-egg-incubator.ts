import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  type EggIncubatorState,
  hatchActiveEgg,
  isActiveEggReady,
  loadEggIncubatorState,
  startEggIncubation,
  syncEggIncubatorProgress,
} from '@/services/egg-incubator-service';

import type { Companion } from '@/data/companions';

type HatchResult = {
  companion: Companion;
};

// Purpose: Provides the egg incubator React hook behavior.
export function useEggIncubator(
  todayDistanceMiles: number
) {
  const [state, setState] =
    useState<EggIncubatorState | null>(
      null
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  // Purpose: Implements the refresh operation.
  const refresh =
    useCallback(async () => {
      try {
        const next =
          await loadEggIncubatorState();

        setState(next);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load incubator.'
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Every time Mission Trails updates
   * today's verified distance,
   * sync ONLY the new distance.
   */
  useEffect(() => {
    if (!state) {
      return;
    }

    let cancelled = false;

    // Purpose: Synchronizes the requested operation.
    async function sync() {
      try {
        const next =
          await syncEggIncubatorProgress(
            todayDistanceMiles
          );

        if (!cancelled) {
          setState(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not update egg progress.'
          );
        }
      }
    }

    void sync();

    return () => {
      cancelled = true;
    };
  }, [
    todayDistanceMiles,
    state?.active?.eggId,
  ]);

  // Purpose: Starts egg.
  const startEgg =
    useCallback(
      async (eggId: string) => {
        try {
          setError(null);

          const next =
            await startEggIncubation(
              eggId,
              todayDistanceMiles
            );

          setState(next);

          return next;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Could not start this egg.';

          setError(message);

          throw err;
        }
      },
      [todayDistanceMiles]
    );

  // Purpose: Implements the hatch operation.
  const hatch =
    useCallback(
      async (): Promise<HatchResult> => {
        try {
          setError(null);

          const result =
            await hatchActiveEgg();

          setState(result.state);

          return {
            companion:
              result.companion,
          };
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Could not hatch egg.';

          setError(message);

          throw err;
        }
      },
      []
    );

  return {
    state,

    activeEgg:
      state?.active ?? null,

    inventory:
      state?.inventory ?? {},

    companions:
      state?.companions ?? [],

    isReady:
      state
        ? isActiveEggReady(state)
        : false,

    isLoading,
    error,

    startEgg,
    hatch,
    refresh,
  };
}
