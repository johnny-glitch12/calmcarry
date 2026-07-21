import { TRACKS, trackLoops } from '../library';

/**
 * The looping contract behind every "· loops" label in the library UI: a track sold
 * as looping must actually loop in the Player. Before this rule, all 21 noise / fan /
 * music-blend tracks played one ~90s file, went silent, and pushed the check-in
 * screen at a drifting user — the single fastest way a sleep app loses someone.
 */
describe('trackLoops', () => {
  it('every track labelled "loops" loops', () => {
    for (const track of Object.values(TRACKS)) {
      if (track.duration === 'loops') {
        expect(trackLoops(track)).toBe(true);
      }
    }
  });

  it('every ambient soundscape loops (all-night play)', () => {
    for (const track of Object.values(TRACKS)) {
      if (track.category === 'soundscape') {
        expect(trackLoops(track)).toBe(true);
      }
    }
  });

  it('guided, breathing and story tracks end (never restart mid-drift)', () => {
    for (const track of Object.values(TRACKS)) {
      if (['meditation', 'breathing', 'story'].includes(track.category)) {
        expect(trackLoops(track)).toBe(false);
      }
    }
  });

  it('no finite duration label on a track that loops forever (honest metadata)', () => {
    for (const track of Object.values(TRACKS)) {
      if (trackLoops(track) && track.category !== 'soundscape') {
        expect(track.duration).toBe('loops');
      }
    }
  });
});
