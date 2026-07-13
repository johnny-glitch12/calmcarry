/**
 * The check-in's feeling vocabulary + its track mapping — PURE DATA, extracted from
 * ProfileProvider so tests (freePlayable.test.ts) can derive the free-anchor set from
 * the same source the runtime uses, instead of hand-copying ids that silently drift.
 * ProfileProvider re-exports everything here, so existing imports are untouched.
 */

// Forward-looking check-in intents (build plan §6: "What would feel good right now?").
export type Intent = 'sleep' | 'reset' | 'sounds' | 'suggest';

/**
 * How someone is "arriving" tonight — the gentle feeling step of the check-in.
 * SAFE WORDS ONLY (build plan §3/§14): NEVER "anxious"/"insomnia"/clinical terms.
 * Each maps forward-looking → an intent + a recommended track + a warm line
 * (no symptom tracking, no history — it only tailors the next recommendation).
 */
export type Feeling = 'racing' | 'cant-switch-off' | 'wired-tired' | 'wound-up' | 'heavy-day' | 'quiet';

/** The always-free one-tap rescue track (never locked) — the honest 3 a.m. answer:
 *  no sign-in, no paywall, no quiz, just a gentle drift back to sleep. Used by the
 *  Home hero fallback, the Night Door, and asserted unlocked by freePlayable.test. */
export const FREE_RESCUE = 'slow-tide';

// freeTrack: the anti-bait fallback — where a FREE user lands when the primary
// pick is premium-locked (a preview that fades into the paywall mid-drift is the
// exact BetterSleep move this app exists to avoid). Every freeTrack must stay
// unlocked — freePlayable.test.ts derives its assertions from this map.
export const FEELING_MAP: Record<Feeling, { intent: Intent; track: string; freeTrack: string; line: string }> = {
  racing: { intent: 'reset', track: 'box-breathing', freeTrack: 'box-breathing', line: 'Let’s slow the spin.' },
  'cant-switch-off': { intent: 'sleep', track: 'deep-rest', freeTrack: 'slow-tide', line: 'We’ll help you set the day down.' },
  'wired-tired': { intent: 'sleep', track: 'slow-tide', freeTrack: 'slow-tide', line: 'Tired body, busy mind. Let’s settle both.' },
  'wound-up': { intent: 'reset', track: 'box-breathing', freeTrack: 'box-breathing', line: 'A few slow breaths to unwind.' },
  'heavy-day': { intent: 'sleep', track: 'deep-rest', freeTrack: 'gymnopedie', line: 'Somewhere soft to land.' },
  quiet: { intent: 'sounds', track: 'slow-tide', freeTrack: 'slow-tide', line: 'Just some calm to rest in.' },
};
