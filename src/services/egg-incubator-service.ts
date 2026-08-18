import AsyncStorage from '@react-native-async-storage/async-storage';

import { getEggById } from '@/data/companion-eggs';
import { hatchEgg } from '@/data/egg-hatching';
import type { Companion } from '@/data/companions';

const STORAGE_KEY =
  'mission-trails:egg-incubator:v1';

export type HatchedCompanionRecord = {
  instanceId: string;
  companionId: string;
  eggId: string;
  hatchedAt: string;
};

export type ActiveIncubation = {
  eggId: string;

  // Actual distance earned toward this egg.
  progressMiles: number;

  startedAt: string;

  // Used so today's entire distance is NOT
  // repeatedly added every time the app renders.
  lastObservedDailyMiles: number;
  lastObservedLocalDate: string;
};

export type EggIncubatorState = {
  version: 1;

  // Only ONE egg can incubate at a time.
  active: ActiveIncubation | null;

  // Number of each egg the player owns.
  inventory: Record<string, number>;

  // Companions successfully hatched.
  companions: HatchedCompanionRecord[];
};

const DEFAULT_STATE: EggIncubatorState = {
  version: 1,

  active: null,

  // Starter inventory while we build the system.
  inventory: {
    'water-egg': 1,
    'fire-egg': 1,
  },

  companions: [],
};

// Purpose: Returns local date key.
export function getLocalDateKey(
  date = new Date()
): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Purpose: Saves state.
async function saveState(
  state: EggIncubatorState
) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );

  return state;
}

// Purpose: Loads egg incubator state.
export async function loadEggIncubatorState():
  Promise<EggIncubatorState> {
  try {
    const saved =
      await AsyncStorage.getItem(
        STORAGE_KEY
      );

    if (!saved) {
      await saveState(DEFAULT_STATE);

      return {
        ...DEFAULT_STATE,
        inventory: {
          ...DEFAULT_STATE.inventory,
        },
        companions: [],
      };
    }

    const parsed =
      JSON.parse(saved) as
        Partial<EggIncubatorState>;

    return {
      version: 1,

      active:
        parsed.active ?? null,

      inventory: {
        ...DEFAULT_STATE.inventory,
        ...(parsed.inventory ?? {}),
      },

      companions:
        parsed.companions ?? [],
    };
  } catch (error) {
    console.warn(
      '[Egg Incubator] Could not load:',
      error
    );

    return {
      ...DEFAULT_STATE,
      inventory: {
        ...DEFAULT_STATE.inventory,
      },
      companions: [],
    };
  }
}

/**
 * Starts one egg.
 *
 * The player's current daily mileage becomes
 * the baseline so walking completed BEFORE
 * starting the egg does not count.
 */
// Purpose: Starts egg incubation.
export async function startEggIncubation(
  eggId: string,
  todayDistanceMiles: number
): Promise<EggIncubatorState> {
  const state =
    await loadEggIncubatorState();

  const egg = getEggById(eggId);

  if (!egg) {
    throw new Error(
      `Egg not found: ${eggId}`
    );
  }

  if (state.active) {
    throw new Error(
      'You already have an egg incubating.'
    );
  }

  const owned =
    state.inventory[eggId] ?? 0;

  if (owned <= 0) {
    throw new Error(
      `You do not own a ${egg.name}.`
    );
  }

  state.active = {
    eggId,

    progressMiles: 0,

    startedAt:
      new Date().toISOString(),

    lastObservedDailyMiles:
      Math.max(
        0,
        todayDistanceMiles
      ),

    lastObservedLocalDate:
      getLocalDateKey(),
  };

  return saveState(state);
}

/**
 * Adds only NEW walking distance.
 *
 * Same day:
 * current mileage - previous mileage
 *
 * New day:
 * today's mileage starts from 0 again,
 * so today's current mileage becomes
 * the new earned distance.
 */
// Purpose: Synchronizes egg incubator progress.
export async function syncEggIncubatorProgress(
  todayDistanceMiles: number
): Promise<EggIncubatorState> {
  const state =
    await loadEggIncubatorState();

  if (!state.active) {
    return state;
  }

  const egg =
    getEggById(
      state.active.eggId
    );

  if (!egg) {
    return state;
  }

  const today =
    getLocalDateKey();

  const currentDailyMiles =
    Math.max(
      0,
      todayDistanceMiles
    );

  let earnedMiles = 0;

  if (
    state.active
      .lastObservedLocalDate ===
    today
  ) {
    earnedMiles =
      Math.max(
        0,
        currentDailyMiles -
          state.active
            .lastObservedDailyMiles
      );
  } else {
    // Daily activity reset.
    // Count today's mileage as new.
    earnedMiles =
      currentDailyMiles;
  }

  state.active.progressMiles =
    Math.min(
      egg.hatchDistanceMiles,

      state.active.progressMiles +
        earnedMiles
    );

  state.active.lastObservedDailyMiles =
    currentDailyMiles;

  state.active.lastObservedLocalDate =
    today;

  return saveState(state);
}

// Purpose: Determines whether is active egg ready.
export function isActiveEggReady(
  state: EggIncubatorState
): boolean {
  if (!state.active) {
    return false;
  }

  const egg =
    getEggById(
      state.active.eggId
    );

  if (!egg) {
    return false;
  }

  return (
    state.active.progressMiles >=
    egg.hatchDistanceMiles
  );
}

/**
 * Hatch the active egg and permanently
 * save the resulting companion locally.
 */
// Purpose: Implements the hatch active egg operation.
export async function hatchActiveEgg():
  Promise<{
    state: EggIncubatorState;
    companion: Companion;
  }> {
  const state =
    await loadEggIncubatorState();

  if (!state.active) {
    throw new Error(
      'No egg is currently incubating.'
    );
  }

  const active =
    state.active;

  const egg =
    getEggById(active.eggId);

  if (!egg) {
    throw new Error(
      'The active egg could not be found.'
    );
  }

  if (
    active.progressMiles <
    egg.hatchDistanceMiles
  ) {
    throw new Error(
      'This egg is not ready to hatch yet.'
    );
  }

  const companion =
    hatchEgg(active.eggId);

  if (!companion) {
    throw new Error(
      `${egg.name} does not have a hatch pool yet.`
    );
  }

  const owned =
    state.inventory[
      active.eggId
    ] ?? 0;

  state.inventory[
    active.eggId
  ] = Math.max(
    0,
    owned - 1
  );

  const record:
    HatchedCompanionRecord = {
      instanceId:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`,

      companionId:
        companion.id,

      eggId:
        active.eggId,

      hatchedAt:
        new Date().toISOString(),
    };

  state.companions = [
    ...state.companions,
    record,
  ];

  // Incubator becomes empty.
  state.active = null;

  await saveState(state);

  return {
    state,
    companion,
  };
}

/**
 * Development helper.
 * Gives the player another egg.
 */
// Purpose: Implements the add egg to inventory operation.
export async function addEggToInventory(
  eggId: string,
  quantity = 1
): Promise<EggIncubatorState> {
  const state =
    await loadEggIncubatorState();

  state.inventory[eggId] =
    Math.max(
      0,
      state.inventory[eggId] ?? 0
    ) +
    Math.max(0, quantity);

  return saveState(state);
}

/**
 * Development-only reset.
 */
// Purpose: Implements the reset egg incubator operation.
export async function resetEggIncubator():
  Promise<EggIncubatorState> {
  const cleanState:
    EggIncubatorState = {
      ...DEFAULT_STATE,

      inventory: {
        ...DEFAULT_STATE.inventory,
      },

      companions: [],
    };

  return saveState(cleanState);
}
