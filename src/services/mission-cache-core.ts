export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

// Saves only a server response. Phone-created completion flags are never accepted.
export async function saveServerMissionProgress<T>(
  storage: KeyValueStorage,
  key: string,
  progress: T,
) {
  await storage.setItem(key, JSON.stringify(progress));
}

// Restores the last server response so a restart can show valid progress offline.
export async function loadServerMissionProgress<T>(storage: KeyValueStorage, key: string) {
  const value = await storage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
