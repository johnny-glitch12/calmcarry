import { getJSON, setJSON } from './store';

/**
 * The nights log - an OPTIONAL, one-tap reflection after a wind-down: did tonight
 * land "calmer" or "about the same"? It powers a single honest home receipt
 * ("calmer on N of your last 7 nights") and nothing else. Deliberately tiny: NO
 * scale, NO history graph, NO mood log - at most one entry per calendar day (a
 * later tap the same day overwrites the earlier one) over a short rolling window,
 * so it can never become a diary to keep up with. LOCAL ONLY: never synced, never
 * sent to analytics (build plan §3/§14 keeps feelings off the server; the owner
 * approved this one on-device receipt). The chip that writes here is adult-only.
 */
export type NightOutcome = 'calmer' | 'same';
export type NightEntry = { date: string; outcome: NightOutcome };

const KEY = 'cc.nightsLog';
const WINDOW = 14; // keep only the last ~2 weeks; the receipt reads the last 7

function today(): string {
  // LOCAL calendar date (not UTC) - the "one per night" boundary is the user's
  // local midnight, matching lib/calmNights, or an evening tap in a UTC-behind
  // zone would mis-date.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Read the rolling log (newest last). Defends against corrupted/old persisted data. */
async function readLog(): Promise<NightEntry[]> {
  const raw = await getJSON<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is NightEntry =>
      !!e &&
      typeof (e as NightEntry).date === 'string' &&
      ((e as NightEntry).outcome === 'calmer' || (e as NightEntry).outcome === 'same'),
  );
}

/** Log tonight's outcome. One entry per calendar day (a second tap the same day
 *  replaces the first); trimmed to the last WINDOW nights so the store never grows. */
export async function recordNight(outcome: NightOutcome): Promise<void> {
  const log = await readLog();
  const t = today();
  const next = [...log.filter((e) => e.date !== t), { date: t, outcome }].slice(-WINDOW);
  await setJSON(KEY, next);
}

/** The most recent `n` logged nights (newest last). */
export async function getRecentNights(n = 7): Promise<NightEntry[]> {
  const log = await readLog();
  return log.slice(-n);
}

/** Honest receipt over the last 7 logged nights: how many landed calmer, of how many
 *  were answered. total is 0 when nothing is logged (callers hide the line then, so a
 *  first-time user never sees a "0 of 0" zero-state). */
export async function getReceipt(): Promise<{ calmer: number; total: number }> {
  const recent = await getRecentNights(7);
  const calmer = recent.filter((e) => e.outcome === 'calmer').length;
  return { calmer, total: recent.length };
}
