import { getJSON, setJSON } from './store';

/**
 * Saved tracks - a simple, local "favourites" list so a user can re-find a session
 * they loved. Mirrors the programs.ts pattern: plain string ids, ordered most-recent
 * first, persisted in AsyncStorage. No backend needed for v1.
 */
const KEY = 'cc.favorites';

export async function getFavorites(): Promise<string[]> {
  const list = await getJSON<string[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function isFavorite(id: string): Promise<boolean> {
  return (await getFavorites()).includes(id);
}

/** Replace the whole list (cross-device prefs sync adopting the merged set). */
export async function replaceFavorites(ids: string[]): Promise<void> {
  await setJSON(KEY, ids);
}

/** Toggle a track's saved state. Returns the resulting state (true = now saved). */
export async function toggleFavorite(id: string): Promise<boolean> {
  const list = await getFavorites();
  const has = list.includes(id);
  const next = has ? list.filter((x) => x !== id) : [id, ...list];
  await setJSON(KEY, next);
  return !has;
}
