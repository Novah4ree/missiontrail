import AsyncStorage from '@react-native-async-storage/async-storage';

export type RelicReward = {
  id: string;
  name: string;
  xp: number;
};

export type PlayerProgress = {
  collectedRelicIds: string[];
  collectedAtByRelicId: Record<string, string>;
  totalXp: number;
};

const PLAYER_PROGRESS_KEY = 'mission-trail:player-progress';

const emptyProgress: PlayerProgress = {
  collectedRelicIds: [],
  collectedAtByRelicId: {},
  totalXp: 0,
};


// Step 1: Read the saved progress. A new player starts with no relics and no XP.
export async function getPlayerProgress(): Promise<PlayerProgress> {
  const savedProgress = await AsyncStorage.getItem(PLAYER_PROGRESS_KEY);

  if (!savedProgress) {
    return emptyProgress;
  }

  const parsedProgress = JSON.parse(savedProgress) as Partial<PlayerProgress>;

  return {
    collectedRelicIds: parsedProgress.collectedRelicIds ?? [],
    collectedAtByRelicId: parsedProgress.collectedAtByRelicId ?? {},
    totalXp: parsedProgress.totalXp ?? 0,
  };
}

// Step 2: Save one relic and award its XP only if its ID has not been saved before.
export async function collectRelic(relic: RelicReward) {
  const progress = await getPlayerProgress();

  if (progress.collectedRelicIds.includes(relic.id)) {
    return { collected: false, progress };
  }

  const updatedProgress: PlayerProgress = {
    collectedRelicIds: [...progress.collectedRelicIds, relic.id],
    collectedAtByRelicId: {
      ...progress.collectedAtByRelicId,
      [relic.id]: new Date().toISOString(),
    },
    totalXp: progress.totalXp + relic.xp,
  };

  await AsyncStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(updatedProgress));

  return { collected: true, progress: updatedProgress };
}

// Server collection is authoritative. This only updates the offline UI cache;
// changing AsyncStorage cannot create a database collection or award server XP.
export async function cacheServerCollection(
  relic: RelicReward,
  collectedAt: string,
  xpAwarded: number,
) {
  const progress = await getPlayerProgress();
  if (progress.collectedRelicIds.includes(relic.id)) return progress;

  const updatedProgress: PlayerProgress = {
    collectedRelicIds: [...progress.collectedRelicIds, relic.id],
    collectedAtByRelicId: { ...progress.collectedAtByRelicId, [relic.id]: collectedAt },
    totalXp: progress.totalXp + xpAwarded,
  };
  await AsyncStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(updatedProgress));
  return updatedProgress;
}

export async function cacheServerCollections(
  collections: { relicId: string; collectedAt: string; xpAwarded: number }[],
) {
  const progress = await getPlayerProgress();
  const missing = collections.filter((item) => !progress.collectedRelicIds.includes(item.relicId));
  if (!missing.length) return progress;

  const updatedProgress: PlayerProgress = {
    collectedRelicIds: [...progress.collectedRelicIds, ...missing.map((item) => item.relicId)],
    collectedAtByRelicId: {
      ...progress.collectedAtByRelicId,
      ...Object.fromEntries(missing.map((item) => [item.relicId, item.collectedAt])),
    },
    totalXp: progress.totalXp + missing.reduce((total, item) => total + item.xpAwarded, 0),
  };
  await AsyncStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(updatedProgress));
  return updatedProgress;
}
