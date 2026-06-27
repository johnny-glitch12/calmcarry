import { TRACKS } from '@/content/library';
import type { AppMode, Feeling, Intent } from '@/features/profile/ProfileProvider';

/**
 * Content recommender — turns the check-in answers into a RANKED set of tracks,
 * so what's surfaced actually corresponds to what the consumer said. Each track
 * carries lightweight tags (which arrival-feelings + intents it suits, and the
 * parts of day it fits); we score the catalog against the answer and sort.
 *
 * This is the personalization layer: it works over the bundled catalog today and
 * over Glowco's CMS-delivered library tomorrow (the CMS just supplies the same
 * tags per track). Adding tracks never needs a code change to the algorithm.
 */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function timeOfDay(hour: number): TimeOfDay {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

type Tags = { moods: Feeling[]; intents: Intent[]; parts: TimeOfDay[]; kidSafe?: boolean };

/** Per-track recommendation tags (the layer the CMS will eventually own). */
export const TRACK_TAGS: Record<string, Tags> = {
  'slow-tide': { moods: ['wired-tired', 'quiet', 'cant-switch-off'], intents: ['sleep', 'sounds', 'suggest'], parts: ['evening', 'night'], kidSafe: true },
  rainfall: { moods: ['racing', 'cant-switch-off', 'quiet'], intents: ['sleep', 'sounds'], parts: ['evening', 'night'], kidSafe: true },
  forest: { moods: ['wound-up', 'quiet', 'heavy-day'], intents: ['reset', 'sounds'], parts: ['afternoon', 'evening'], kidSafe: true },
  'box-breathing': { moods: ['racing', 'wound-up'], intents: ['reset'], parts: ['morning', 'afternoon', 'evening', 'night'], kidSafe: true },
  'deep-rest': { moods: ['cant-switch-off', 'heavy-day', 'wired-tired'], intents: ['sleep'], parts: ['evening', 'night'] },
  'letting-go': { moods: ['racing', 'heavy-day', 'cant-switch-off'], intents: ['sleep', 'reset'], parts: ['evening', 'night'] },
  penguin: { moods: ['quiet'], intents: ['sleep'], parts: ['night'], kidSafe: true },
  spa: { moods: ['wound-up', 'quiet'], intents: ['sounds', 'reset'], parts: ['afternoon', 'evening'] },
  gymnopedie: { moods: ['heavy-day', 'quiet', 'wired-tired'], intents: ['sounds', 'reset'], parts: ['evening', 'night'] },
  shoreline: { moods: ['wired-tired', 'quiet', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: ['evening', 'night'], kidSafe: true },
  fireside: { moods: ['heavy-day', 'quiet', 'wound-up'], intents: ['sleep', 'sounds'], parts: ['evening', 'night'] },
  'dawn-chorus': { moods: ['heavy-day', 'quiet'], intents: ['reset', 'sounds'], parts: ['morning', 'afternoon'], kidSafe: true },
  'brown-noise': { moods: ['racing', 'cant-switch-off', 'wired-tired'], intents: ['sleep', 'sounds'], parts: ['evening', 'night'], kidSafe: true },
  'pink-noise': { moods: ['racing', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: ['evening', 'night'], kidSafe: true },
  'white-noise': { moods: ['racing', 'wound-up'], intents: ['sounds', 'sleep'], parts: ['night'], kidSafe: true },
};

// which content category each intent leans toward (a soft affinity, not a filter)
const INTENT_CATEGORY: Record<Intent, string> = { sleep: 'meditation', reset: 'breathing', sounds: 'soundscape', suggest: 'soundscape' };

export type Answer = {
  feeling: Feeling | null;
  intent: Intent | null;
  mode: AppMode;
  hour: number;
  /** most-recently-played track ids (newest first) — gently favours picking back up */
  recentIds?: string[];
};

/** Ranked track ids best matching the answer. Always returns ≥1 (graceful fallback). */
export function recommendTracks(answer: Answer): string[] {
  const part = timeOfDay(answer.hour);
  const recent = answer.recentIds ?? [];
  const ids = Object.keys(TRACKS).filter((id) => {
    const t = TRACKS[id];
    if (!t) return false;
    // kids only ever get kid-safe content; adults get everything
    return answer.mode !== 'kids' || TRACK_TAGS[id]?.kidSafe;
  });

  const scored = ids.map((id) => {
    const t = TRACKS[id];
    const tags = TRACK_TAGS[id];
    let s = 0;
    if (tags) {
      if (answer.intent && tags.intents.includes(answer.intent)) s += 3;
      if (answer.feeling && tags.moods.includes(answer.feeling)) s += 3;
      if (tags.parts.includes(part)) s += 1;
    }
    if (answer.intent && t.category === INTENT_CATEGORY[answer.intent]) s += 1;
    // Gentle recency nudge — a recently-played track is a touch easier to pick back
    // up, but capped well below a strong feeling/intent match (max +1.5 vs +6) so it
    // never hijacks the recommendation. When there's NO check-in answer yet, this is
    // what surfaces "where you left off" as the hero.
    const r = recent.indexOf(id);
    if (r >= 0) s += Math.max(1.5 - r * 0.2, 0.3);
    return { id, s };
  });

  // stable sort: score desc, then catalog order (Object.keys is insertion order)
  scored.sort((a, b) => b.s - a.s);
  const ranked = scored.map((x) => x.id);
  // sensible default if nothing scored (no answer yet)
  return ranked.length ? ranked : [answer.mode === 'kids' ? 'penguin' : 'slow-tide'];
}
