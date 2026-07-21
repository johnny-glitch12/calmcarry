import { getJSON, setJSON } from './store';

/**
 * The user's nightly sleep-hours goal - a real, saved preference (not a tracked
 * metric; CalmCarry doesn't measure your sleep). Set during onboarding and
 * editable in Settings; used to frame the evening rhythm + the wind-down nudge.
 */
const KEY = 'cc.sleepGoalHours';
export const SLEEP_GOAL_MIN = 4;
export const SLEEP_GOAL_MAX = 12;
export const SLEEP_GOAL_DEFAULT = 8;

// quarter-hour precision: the onboarding slider moves in 15-min steps, and a
// 7h45m goal must never silently become 8h
const clamp = (h: number) => Math.min(SLEEP_GOAL_MAX, Math.max(SLEEP_GOAL_MIN, Math.round(h * 4) / 4));

export async function getSleepGoalHours(): Promise<number> {
  return clamp(await getJSON<number>(KEY, SLEEP_GOAL_DEFAULT));
}

export async function setSleepGoalHours(hours: number): Promise<void> {
  await setJSON(KEY, clamp(hours));
}

/** The stored value, or null if never set - prefs sync uses this to tell the
 *  default apart from an explicit choice before adopting another device's goal. */
export async function getStoredSleepGoalHours(): Promise<number | null> {
  const v = await getJSON<number | null>(KEY, null);
  return typeof v === 'number' ? clamp(v) : null;
}
