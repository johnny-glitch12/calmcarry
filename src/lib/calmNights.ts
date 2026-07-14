import { getJSON, setJSON } from './store';

/**
 * "Calm nights" - the gentle, non-failable progress (stars on KidsHome, a quiet
 * weekly card for adults). A night is EARNED by actually doing a calm session (at
 * most one per calendar day), so the count reflects real use rather than a
 * decorative number. Capped at the weekly goal; never decreases (nothing to "fail").
 */
export const CALM_NIGHTS_GOAL = 7;
const COUNT_KEY = 'cc.calmNights';
const DATE_KEY = 'cc.calmNightsDate';

function today(): string {
  // LOCAL calendar date (not UTC) - the "one per night" boundary must be the
  // user's local midnight, or evening sessions in UTC-behind zones mis-count.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function getCalmNights(): Promise<number> {
  const n = await getJSON<number>(COUNT_KEY, 0);
  return Math.min(Math.max(0, n), CALM_NIGHTS_GOAL);
}

/** Mark today as a calm night (once per day). Returns the resulting count. */
export async function markCalmNightToday(): Promise<number> {
  const last = await getJSON<string | null>(DATE_KEY, null);
  const current = await getCalmNights();
  if (last === today()) return current; // already counted today
  const next = Math.min(current + 1, CALM_NIGHTS_GOAL);
  await setJSON(COUNT_KEY, next);
  await setJSON(DATE_KEY, today());
  return next;
}
