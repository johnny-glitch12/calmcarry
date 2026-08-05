import { getJSON, setJSON } from './store';

/**
 * Saved tracks - a simple, local "favourites" list so a user can re-find a session
 * they loved. Mirrors the programs.ts pattern: plain string ids, ordered most-recent
 * first, persisted in AsyncStorage. No backend needed for v1.
 */
const KEY = 'cc.favorites';

/**
 * When this device last CHANGED the list itself (ms epoch), or 0 if it never has.
 *
 * This exists because a set union cannot express a removal. Sync used to merge the
 * local and server lists with `new Set([...local, ...server])`, which meant every
 * unsave was silently undone: you removed a track, the stale server copy still had
 * it, and the next app open handed it straight back. Union is only safe for a list
 * that grows.
 *
 * A timestamp makes removal representable - the side that edited most recently wins
 * the whole list, so a delete propagates exactly like an add.
 */
const AT_KEY = 'cc.favorites.updatedAt';

export async function getFavorites(): Promise<string[]> {
  const list = await getJSON<string[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

/** When this device last edited the list. 0 means "never touched it". */
export async function getFavoritesUpdatedAt(): Promise<number> {
  const at = await getJSON<number>(AT_KEY, 0);
  return typeof at === 'number' && Number.isFinite(at) && at > 0 ? at : 0;
}

export async function isFavorite(id: string): Promise<boolean> {
  return (await getFavorites()).includes(id);
}

/**
 * Adopt a list that came from somewhere else (the cross-device reconcile).
 *
 * Takes the winning side's timestamp rather than stamping `Date.now()`, because
 * adopting a remote list is NOT a local edit. Stamping it here would make every app
 * open look like a fresh change and this device would always win the next
 * comparison, which defeats the whole mechanism.
 */
export async function replaceFavorites(ids: string[], updatedAt: number): Promise<void> {
  await setJSON(KEY, ids);
  await setJSON(AT_KEY, updatedAt);
}

/**
 * Decide which copy of the list survives a cross-device reconcile.
 *
 * Pure on purpose: this is the rule that decides whether a user's unsave sticks, and
 * it needs to be testable without standing up a React tree, AsyncStorage and a fake
 * server. The caller does the I/O.
 *
 * Last edit wins the WHOLE list. Anything element-wise (union, intersection) throws
 * away the one fact that distinguishes "device B has not seen this save yet" from
 * "device A deliberately removed it", and those need opposite outcomes.
 */
export function reconcileFavorites(
  local: string[],
  localAt: number,
  server: string[],
  serverAt: number,
): { favorites: string[]; updatedAt: number } {
  // Neither side ever stamped: pre-upgrade data, and there is genuinely no way to
  // tell an add from a delete. Union is the safer error for this one reconcile only -
  // after it, both sides carry a timestamp and removals work normally.
  if (localAt === 0 && serverAt === 0) {
    return { favorites: Array.from(new Set([...local, ...server])), updatedAt: 0 };
  }
  // Ties go to local. A tie means both were stamped in the same millisecond, which in
  // practice means this device wrote both, and preferring the copy in the user's hand
  // is the least surprising outcome.
  const favorites = localAt >= serverAt ? local : server;
  return { favorites, updatedAt: Math.max(localAt, serverAt) };
}

/** Toggle a track's saved state. Returns the resulting state (true = now saved). */
export async function toggleFavorite(id: string): Promise<boolean> {
  const list = await getFavorites();
  const has = list.includes(id);
  const next = has ? list.filter((x) => x !== id) : [id, ...list];
  await setJSON(KEY, next);
  // stamp AFTER the list, so a crash between the two leaves an older timestamp on a
  // newer list. That way the reconcile re-pushes rather than treating this device as
  // authoritative for an edit it may not have finished writing.
  await setJSON(AT_KEY, Date.now());
  return !has;
}
