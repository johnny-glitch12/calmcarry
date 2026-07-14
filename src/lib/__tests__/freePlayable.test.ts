import { FEELING_MAP, FREE_RESCUE } from '@/content/feelings';
import { TRACKS } from '@/content/library';
import { recommendTracks, TRACK_TAGS } from '@/lib/recommend';

/**
 * THE 3AM GUARANTEE (pre-mortem trust & safety). A free user in the middle of the
 * night must ALWAYS land on a track that plays - never a locked hero, never a 60s
 * preview that fades into the paywall mid-drift. Three independent guards exist in
 * the app (ProfileProvider free-hero fallback, TonightScreen FREE_RESCUE swap,
 * MoodSurvey freeTrack routing); ALL of them silently break if a content edit locks
 * the last free track in a ranking. This suite makes that regression loud.
 *
 * NOTE: mirrors ProfileProvider.tsx logic (`recommendedTrackIds.find(id =>
 * !TRACKS[id]?.locked)`) rather than importing it - ProfileProvider's runtime import
 * chain (analytics/monitoring) doesn't load under jest-expo, and the invariant lives
 * in the pure data anyway.
 */

const FEELINGS = ['racing', 'cant-switch-off', 'wired-tired', 'wound-up', 'heavy-day', 'quiet', null] as const;
const INTENTS = ['sleep', 'reset', 'sounds', 'suggest', null] as const;
const HOURS = [3, 9, 14, 22]; // deep night, morning, afternoon, bedtime

// The free anchors the app's fallbacks reach for - DERIVED from the same data the
// runtime uses (src/content/feelings.ts), so an edit there is asserted here, not missed.
const FREE_ANCHORS = [...new Set([FREE_RESCUE, ...Object.values(FEELING_MAP).map((m) => m.freeTrack)])];

describe('free playability (the 3am guarantee)', () => {
  it('every adult recommendation ranking contains at least one unlocked track', () => {
    for (const feeling of FEELINGS) {
      for (const intent of INTENTS) {
        for (const hour of HOURS) {
          const ids = recommendTracks({ feeling, intent, mode: 'adult', hour });
          const free = ids.find((id) => !TRACKS[id]?.locked);
          // mirrors ProfileProvider's free-hero fallback - if this is undefined,
          // a free user's hero CTA dead-ends at the paywall
          expect(free).toBeTruthy();
        }
      }
    }
  });

  it('every kids recommendation ranking contains at least one unlocked track', () => {
    for (const hour of HOURS) {
      const ids = recommendTracks({ feeling: null, intent: null, mode: 'kids', hour });
      expect(ids.find((id) => !TRACKS[id]?.locked)).toBeTruthy();
    }
  });

  it('the free fallback anchors exist, stay unlocked, and stay tagged', () => {
    for (const id of FREE_ANCHORS) {
      expect(TRACKS[id]).toBeTruthy();
      expect(TRACKS[id].locked ?? false).toBe(false);
      expect(TRACK_TAGS[id]).toBeTruthy(); // untagged = invisible to the recommender
    }
    // the always-free rescue must also be reachable by a kid profile
    expect(TRACK_TAGS[FREE_RESCUE]?.kidSafe).toBe(true);
  });

  it('the catalog never drops below a minimal free tier', () => {
    const freeCount = Object.values(TRACKS).filter((t) => !t.locked).length;
    // 5 free tracks today; alert loudly if a content edit erodes the free tier
    expect(freeCount).toBeGreaterThanOrEqual(3);
  });
});
