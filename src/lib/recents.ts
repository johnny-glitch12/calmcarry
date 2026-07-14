import { getJSON, remove, setJSON } from './store';

/**
 * Recently played - a small "pick up where you left off" list. Track ids, most
 * recent first, de-duplicated, capped. Recorded when a session actually starts
 * playing (see Player), so it reflects real listens.
 */
const KEY = 'cc.recentlyPlayed';
const CAP = 12;

export async function getRecents(): Promise<string[]> {
  const list = await getJSON<string[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

/** Record a play: move the id to the front, drop duplicates, keep the cap. */
export async function pushRecent(id: string): Promise<void> {
  const list = await getRecents();
  const next = [id, ...list.filter((x) => x !== id)].slice(0, CAP);
  await setJSON(KEY, next);
}

/** Clear on sign-out / account switch so account B never sees account A's recents. */
export async function clearRecents(): Promise<void> {
  await remove(KEY);
}
