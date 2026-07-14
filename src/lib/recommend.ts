import { TRACKS } from '@/content/library';
import type { AppMode, Feeling, Intent } from '@/features/profile/ProfileProvider';

/**
 * Content recommender - turns everything the consumer has told us into a RANKED
 * set of tracks: the onboarding survey (goals + when they want help), tonight's
 * check-in feeling, their favourites (taste), what they played recently, the
 * time of day, and kids mode. Pure + deterministic, so it's unit-testable and
 * CMS-ready (Glowco's library just ships the same tags per track).
 *
 * Signal weights (strongest first): feeling/intent match (+3 each) > favourite
 * (+2.5) > worked-before (completed wind-downs, max +2.1) > goal/moment
 * affinities (+1.5) > taste-by-category (+0.75/fav cat, capped) > time-of-day
 * fit (+1) > recency nudge (max +1.5). Nothing below a direct feeling match can
 * hijack the top slot.
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

const ALL: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
const EN: TimeOfDay[] = ['evening', 'night'];
const DAY: TimeOfDay[] = ['morning', 'afternoon'];

/** Per-track recommendation tags - EVERY track in TRACKS must appear here
 *  (guarded by a unit test so new tracks can't silently fall out of the
 *  recommender, which would also hide them from kids). */
export const TRACK_TAGS: Record<string, Tags> = {
  // originals
  'slow-tide': { moods: ['wired-tired', 'quiet', 'cant-switch-off'], intents: ['sleep', 'sounds', 'suggest'], parts: EN, kidSafe: true },
  rainfall: { moods: ['racing', 'cant-switch-off', 'quiet'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  forest: { moods: ['wound-up', 'quiet', 'heavy-day'], intents: ['reset', 'sounds'], parts: ['afternoon', 'evening'], kidSafe: true },
  'box-breathing': { moods: ['racing', 'wound-up'], intents: ['reset'], parts: ALL, kidSafe: true },
  'deep-rest': { moods: ['cant-switch-off', 'heavy-day', 'wired-tired'], intents: ['sleep'], parts: EN },
  'letting-go': { moods: ['racing', 'heavy-day', 'cant-switch-off'], intents: ['sleep', 'reset'], parts: EN },
  penguin: { moods: ['quiet'], intents: ['sleep'], parts: ['night'], kidSafe: true },
  spa: { moods: ['wound-up', 'quiet'], intents: ['sounds', 'reset'], parts: ['afternoon', 'evening'] },
  gymnopedie: { moods: ['heavy-day', 'quiet', 'wired-tired'], intents: ['sounds', 'reset'], parts: EN },
  shoreline: { moods: ['wired-tired', 'quiet', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  fireside: { moods: ['heavy-day', 'quiet', 'wound-up'], intents: ['sleep', 'sounds'], parts: EN },
  'dawn-chorus': { moods: ['heavy-day', 'quiet'], intents: ['reset', 'sounds'], parts: DAY, kidSafe: true },
  'brown-noise': { moods: ['racing', 'cant-switch-off', 'wired-tired'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'pink-noise': { moods: ['racing', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'white-noise': { moods: ['racing', 'wound-up'], intents: ['sounds', 'sleep'], parts: ['night'], kidSafe: true },
  'green-noise': { moods: ['racing', 'quiet'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'rain-fire': { moods: ['heavy-day', 'quiet', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN },
  'rain-ocean': { moods: ['wired-tired', 'cant-switch-off', 'quiet'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'rain-forest': { moods: ['quiet', 'wound-up', 'racing'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'beach-fire': { moods: ['heavy-day', 'quiet'], intents: ['sleep', 'sounds'], parts: EN },
  'rain-piano': { moods: ['heavy-day', 'quiet', 'wired-tired'], intents: ['sounds', 'reset'], parts: EN },
  fan: { moods: ['racing', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  // fans & hums
  'ceiling-fan': { moods: ['cant-switch-off', 'wired-tired'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'desk-fan': { moods: ['racing', 'wound-up'], intents: ['sounds'], parts: ALL, kidSafe: true },
  'airplane-cabin': { moods: ['racing', 'cant-switch-off', 'wired-tired'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'night-train': { moods: ['cant-switch-off', 'quiet'], intents: ['sleep', 'sounds'], parts: ['night'], kidSafe: true },
  'ac-hum': { moods: ['racing', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'night-drive': { moods: ['cant-switch-off', 'quiet', 'wired-tired'], intents: ['sleep', 'sounds'], parts: ['night'], kidSafe: true },
  'tumble-dryer': { moods: ['quiet', 'heavy-day'], intents: ['sounds', 'sleep'], parts: EN, kidSafe: true },
  // wind & air
  'soft-wind': { moods: ['quiet', 'wound-up'], intents: ['sounds', 'reset'], parts: ALL, kidSafe: true },
  'mountain-wind': { moods: ['heavy-day', 'quiet'], intents: ['sounds'], parts: EN },
  'winter-wind': { moods: ['quiet', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN },
  'leaf-wind': { moods: ['wound-up', 'quiet', 'racing'], intents: ['reset', 'sounds'], parts: ALL, kidSafe: true },
  // for little ones
  heartbeat: { moods: ['quiet'], intents: ['sleep'], parts: ['night'], kidSafe: true },
  womb: { moods: ['quiet'], intents: ['sleep'], parts: ['night'], kidSafe: true },
  shush: { moods: ['quiet', 'racing'], intents: ['sleep'], parts: ['night'], kidSafe: true },
  // shaped variants
  'rain-window': { moods: ['quiet', 'heavy-day', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'rain-tent': { moods: ['quiet', 'wound-up'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'rain-distant': { moods: ['quiet', 'wired-tired'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'rain-heavy': { moods: ['racing', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN },
  'deep-swell': { moods: ['wired-tired', 'cant-switch-off'], intents: ['sleep'], parts: ['night'], kidSafe: true },
  'sea-dunes': { moods: ['quiet', 'heavy-day'], intents: ['sounds', 'sleep'], parts: EN, kidSafe: true },
  'forest-dusk': { moods: ['heavy-day', 'quiet', 'wound-up'], intents: ['sleep', 'sounds'], parts: ['evening'], kidSafe: true },
  'birds-far': { moods: ['quiet', 'heavy-day'], intents: ['reset', 'sounds'], parts: DAY, kidSafe: true },
  embers: { moods: ['heavy-day', 'quiet'], intents: ['sleep', 'sounds'], parts: ['night'] },
  // blends
  'piano-fire': { moods: ['heavy-day', 'quiet'], intents: ['sounds', 'reset'], parts: EN },
  'piano-sea': { moods: ['wired-tired', 'quiet'], intents: ['sounds', 'reset'], parts: EN },
  'piano-birds': { moods: ['heavy-day', 'quiet'], intents: ['reset', 'sounds'], parts: DAY },
  'gymnopedie-rain': { moods: ['heavy-day', 'quiet', 'wired-tired'], intents: ['sounds', 'reset'], parts: EN },
  'forest-campfire': { moods: ['wound-up', 'quiet'], intents: ['sounds', 'sleep'], parts: EN },
  'shore-morning': { moods: ['quiet', 'heavy-day'], intents: ['reset', 'sounds'], parts: DAY, kidSafe: true },
  'fireside-hush': { moods: ['cant-switch-off', 'heavy-day'], intents: ['sleep'], parts: ['night'] },
  'storm-rolling': { moods: ['racing', 'quiet'], intents: ['sounds', 'sleep'], parts: EN },
  'the-cabin': { moods: ['heavy-day', 'quiet', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN },
  // noise variants
  'deep-brown': { moods: ['racing', 'cant-switch-off', 'wired-tired'], intents: ['sleep'], parts: ['night'], kidSafe: true },
  'soft-white': { moods: ['racing', 'wound-up'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
  'warm-pink': { moods: ['racing', 'cant-switch-off'], intents: ['sleep', 'sounds'], parts: EN, kidSafe: true },
};

// which content category each intent leans toward (a soft affinity, not a filter)
const INTENT_CATEGORY: Record<Intent, string> = { sleep: 'meditation', reset: 'breathing', sounds: 'soundscape', suggest: 'soundscape' };

// What the onboarding GOALS say about content (survey step "What can we help you
// with?"). Soft category boosts; `parts` limits the boost to fitting times.
const GOAL_AFFINITY: Record<string, { cats: string[]; boost: number; parts?: TimeOfDay[] }> = {
  'fall-asleep': { cats: ['soundscape', 'meditation'], boost: 1 },
  'stay-asleep': { cats: ['noise'], boost: 1.5 }, // masking beds hold through the night
  'wake-refreshed': { cats: ['soundscape', 'music'], boost: 1, parts: DAY },
  'quiet-mind': { cats: ['breathing', 'meditation'], boost: 1.5 },
  'calm-anxious': { cats: ['breathing'], boost: 1.5 },
  routine: { cats: ['meditation', 'music'], boost: 0.75 },
};

// What the onboarding MOMENTS say ("When do you want CalmCarry's help?").
const MOMENT_AFFINITY: Record<string, { cats: string[]; boost: number; parts?: TimeOfDay[] }> = {
  'falling-asleep': { cats: ['soundscape', 'meditation'], boost: 0.75, parts: EN },
  'night-wakes': { cats: ['noise'], boost: 1.5, parts: ['night'] },
  'anxious-moments': { cats: ['breathing'], boost: 1.5, parts: ALL },
  'daytime-reset': { cats: ['breathing', 'soundscape'], boost: 1, parts: DAY },
  'wind-down': { cats: ['music', 'soundscape'], boost: 0.75, parts: ['evening'] },
};

export type Answer = {
  feeling: Feeling | null;
  intent: Intent | null;
  mode: AppMode;
  hour: number;
  /** most-recently-played track ids (newest first) - gently favours picking back up */
  recentIds?: string[];
  /** saved favourites - the strongest "what they like" signal */
  favoriteIds?: string[];
  /** onboarding survey: what we can help with (GOALS keys) */
  goals?: string[];
  /** onboarding survey: when they want help (MOMENTS keys) */
  moments?: string[];
  /** completed wind-downs per track (cc.trackWins) - behavioural "it worked" signal */
  workedBefore?: Record<string, number>;
};

function scoreOne(id: string, answer: Answer, part: TimeOfDay, favCats: Map<string, number>): number {
  const t = TRACKS[id];
  const tags = TRACK_TAGS[id];
  let s = 0;
  if (tags) {
    if (answer.intent && tags.intents.includes(answer.intent)) s += 3;
    if (answer.feeling && tags.moods.includes(answer.feeling)) s += 3;
    if (tags.parts.includes(part)) s += 1;
  }
  if (answer.intent && t.category === INTENT_CATEGORY[answer.intent]) s += 1;
  // taste: direct favourite, plus a capped same-category affinity from all favourites
  if (answer.favoriteIds?.includes(id)) s += 2.5;
  // wind-downs this track carried to the end - strong, but a tonight-feeling match still wins
  s += Math.min(answer.workedBefore?.[id] ?? 0, 3) * 0.7;
  s += Math.min((favCats.get(t.category) ?? 0) * 0.75, 1.5);
  // the survey: goals + moments → category boosts (time-gated where it matters)
  for (const g of answer.goals ?? []) {
    const a = GOAL_AFFINITY[g];
    if (a && a.cats.includes(t.category) && (!a.parts || a.parts.includes(part))) s += a.boost;
  }
  for (const m of answer.moments ?? []) {
    const a = MOMENT_AFFINITY[m];
    if (a && a.cats.includes(t.category) && (!a.parts || a.parts.includes(part))) s += a.boost;
  }
  // gentle recency nudge - capped well below a feeling/intent match
  const r = (answer.recentIds ?? []).indexOf(id);
  if (r >= 0) s += Math.max(1.5 - r * 0.2, 0.3);
  return s;
}

/** Ranked track ids best matching the answer. Always returns ≥1 (graceful fallback). */
export function recommendTracks(answer: Answer): string[] {
  const part = timeOfDay(answer.hour);
  const ids = Object.keys(TRACKS).filter((id) => answer.mode !== 'kids' || TRACK_TAGS[id]?.kidSafe);
  // category taste profile from favourites (how many favourites per category)
  const favCats = new Map<string, number>();
  for (const f of answer.favoriteIds ?? []) {
    const cat = TRACKS[f]?.category;
    if (cat) favCats.set(cat, (favCats.get(cat) ?? 0) + 1);
  }
  const scored = ids.map((id) => ({ id, s: scoreOne(id, answer, part, favCats) }));
  scored.sort((a, b) => b.s - a.s); // stable: ties keep catalog order
  const ranked = scored.map((x) => x.id);
  return ranked.length ? ranked : [answer.mode === 'kids' ? 'penguin' : 'slow-tide'];
}

/** An honest one-line reason for why a track is being suggested - only ever
 *  claims signals we actually have. Returns null when there's nothing personal
 *  to say (the caller falls back to its generic kicker). */
export function explainRecommendation(id: string, answer: Answer): string | null {
  const t = TRACKS[id];
  if (!t) return null;
  const part = timeOfDay(answer.hour);
  if (answer.favoriteIds?.includes(id)) return 'One of your saved favourites';
  if ((answer.workedBefore?.[id] ?? 0) >= 2) return 'It’s carried you to the end of a wind-down before';
  if ((answer.recentIds ?? []).slice(0, 3).includes(id)) return 'Pick up where you left off';
  if (part === 'night' && answer.moments?.includes('night-wakes') && t.category === 'noise')
    return 'Steady masking for the night wake-ups you mentioned';
  if (answer.goals?.includes('calm-anxious') && t.category === 'breathing')
    return 'For the wound-up moments you told us about';
  if (answer.goals?.includes('quiet-mind') && (t.category === 'breathing' || t.category === 'meditation'))
    return 'To quiet a racing mind, like you asked';
  if (answer.goals?.includes('stay-asleep') && t.category === 'noise')
    return 'Masking that holds through the night';
  if (part !== 'night' && part !== 'evening' && answer.moments?.includes('daytime-reset'))
    return 'A daytime reset, like you asked for';
  const favCat = (answer.favoriteIds ?? []).some((f) => TRACKS[f]?.category === t.category);
  if (favCat) return `More like the ${t.category === 'noise' ? 'noise beds' : t.category + 's'} you save`;
  return null;
}
