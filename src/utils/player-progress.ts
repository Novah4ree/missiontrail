import AsyncStorage from '@react-native-async-storage/async-storage';

export type RelicReward = {
  id: string;
  name: string;
  xp: number;
};

export type RelicCollectionRecord = {
  collectionId: string;
  relicId: string;
  collectedAt: string;
  xpAwarded: number;
};

export type PlayerProgress = {
  // Distinct relic TYPES discovered.
  // Example: fossil-fang appears once here even if the player owns 50.
  collectedRelicIds: string[];

  // First known discovery time for each relic type.
  collectedAtByRelicId: Record<string, string>;

  // Actual number of copies currently cached for each relic type.
  relicQuantityById: Record<string, number>;

  // Individual collectible records.
  // This is what lets the player own many copies of one relic type.
  relicCollections: RelicCollectionRecord[];

  totalXp: number;
};

const PLAYER_PROGRESS_KEY = 'mission-trail:player-progress';

const emptyProgress: PlayerProgress = {
  collectedRelicIds: [],
  collectedAtByRelicId: {},
  relicQuantityById: {},
  relicCollections: [],
  totalXp: 0,
};

function buildDerivedCollectionState(
  collections: RelicCollectionRecord[],
) {
  const relicIds = new Set<string>();
  const collectedAtByRelicId: Record<string, string> = {};
  const relicQuantityById: Record<string, number> = {};

  for (const collection of collections) {
    relicIds.add(collection.relicId);

    relicQuantityById[collection.relicId] =
      (relicQuantityById[collection.relicId] ?? 0) + 1;

    const currentDate = collectedAtByRelicId[collection.relicId];

    if (
      !currentDate ||
      Date.parse(collection.collectedAt) < Date.parse(currentDate)
    ) {
      collectedAtByRelicId[collection.relicId] =
        collection.collectedAt;
    }
  }

  return {
    collectedRelicIds: Array.from(relicIds),
    collectedAtByRelicId,
    relicQuantityById,
  };
}

function migrateLegacyCollections(
  parsedProgress: Partial<PlayerProgress>,
): RelicCollectionRecord[] {
  if (
    Array.isArray(parsedProgress.relicCollections) &&
    parsedProgress.relicCollections.length > 0
  ) {
    return parsedProgress.relicCollections;
  }

  // Older versions stored only one relic ID per type.
  // Convert those old discoveries into temporary local records.
  return (parsedProgress.collectedRelicIds ?? []).map((relicId) => ({
    collectionId: `legacy:${relicId}`,
    relicId,
    collectedAt:
      parsedProgress.collectedAtByRelicId?.[relicId] ??
      new Date(0).toISOString(),
    xpAwarded: 0,
  }));
}

async function savePlayerProgress(progress: PlayerProgress) {
  await AsyncStorage.setItem(
    PLAYER_PROGRESS_KEY,
    JSON.stringify(progress),
  );
}

// Purpose: Returns player progress.
export async function getPlayerProgress(): Promise<PlayerProgress> {
  const savedProgress =
    await AsyncStorage.getItem(PLAYER_PROGRESS_KEY);

  if (!savedProgress) {
    return emptyProgress;
  }

  const parsedProgress =
    JSON.parse(savedProgress) as Partial<PlayerProgress>;

  const relicCollections =
    migrateLegacyCollections(parsedProgress);

  const derived =
    buildDerivedCollectionState(relicCollections);

  return {
    ...derived,
    relicCollections,
    totalXp: parsedProgress.totalXp ?? 0,
  };
}

// Local/test collection.
// Duplicate relic TYPES are intentionally allowed.
export async function collectRelic(relic: RelicReward) {
  const progress = await getPlayerProgress();

  const now = new Date().toISOString();

  const collection: RelicCollectionRecord = {
    collectionId:
      `local:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    relicId: relic.id,
    collectedAt: now,
    xpAwarded: relic.xp,
  };

  const relicCollections = [
    ...progress.relicCollections,
    collection,
  ];

  const derived =
    buildDerivedCollectionState(relicCollections);

  const updatedProgress: PlayerProgress = {
    ...derived,
    relicCollections,
    totalXp: progress.totalXp + relic.xp,
  };

  await savePlayerProgress(updatedProgress);

  return {
    collected: true,
    progress: updatedProgress,
  };
}

// Server collection is authoritative.
//
// collectionId identifies ONE physical/spawned relic claim.
// relic.id identifies the relic TYPE.
//
// Therefore:
// Fossil Fang collection A = allowed
// Fossil Fang collection B = allowed
// Collection A submitted twice = ignored locally
export async function cacheServerCollection(
  relic: RelicReward,
  collectionId: string,
  collectedAt: string,
  xpAwarded: number,
) {
  const progress = await getPlayerProgress();

  if (
    progress.relicCollections.some(
      (item) => item.collectionId === collectionId,
    )
  ) {
    return progress;
  }

  const relicCollections = [
    ...progress.relicCollections,
    {
      collectionId,
      relicId: relic.id,
      collectedAt,
      xpAwarded,
    },
  ];

  const derived =
    buildDerivedCollectionState(relicCollections);

  const updatedProgress: PlayerProgress = {
    ...derived,
    relicCollections,
    totalXp: progress.totalXp + xpAwarded,
  };

  await savePlayerProgress(updatedProgress);

  return updatedProgress;
}

// Synchronizes the user's server-owned inventory.
//
// Server rows are authoritative. Local development collections are
// preserved so development/test mode continues working.
export async function cacheServerCollections(
  collections: RelicCollectionRecord[],
) {
  const progress = await getPlayerProgress();

  const localDevelopmentCollections =
    progress.relicCollections.filter((item) =>
      item.collectionId.startsWith('local:'),
    );

  const byCollectionId =
    new Map<string, RelicCollectionRecord>();

  for (const collection of [
    ...localDevelopmentCollections,
    ...collections,
  ]) {
    byCollectionId.set(
      collection.collectionId,
      collection,
    );
  }

  const relicCollections =
    Array.from(byCollectionId.values());

  const derived =
    buildDerivedCollectionState(relicCollections);

  const updatedProgress: PlayerProgress = {
    ...derived,
    relicCollections,

    // Vault syncing should not manufacture XP.
    // XP continues to come from verified rewards/server progress.
    totalXp: progress.totalXp,
  };

  await savePlayerProgress(updatedProgress);

  return updatedProgress;
}
