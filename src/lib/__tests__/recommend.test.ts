import { TRACKS } from '@/content/library';
import { explainRecommendation, recommendTracks, TRACK_TAGS } from '@/lib/recommend';

const base = { feeling: null, intent: null, mode: 'adult' as const, hour: 22 };

describe('recommend', () => {
  // DRIFT GUARD: an untagged track scores zero for everyone and is fully
  // invisible to kids — every track added to TRACKS must be tagged.
  it('tags every track in the catalog', () => {
    const untagged = Object.keys(TRACKS).filter((id) => !TRACK_TAGS[id]);
    expect(untagged).toEqual([]);
  });

  it('kids only ever get kid-safe tracks', () => {
    const ids = recommendTracks({ ...base, mode: 'kids' });
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(TRACK_TAGS[id]?.kidSafe).toBe(true);
  });

  it('ranks a saved favourite above an otherwise-equal track', () => {
    const ids = recommendTracks({ ...base, favoriteIds: ['fireside'] });
    const fav = ids.indexOf('fireside');
    expect(fav).toBeGreaterThanOrEqual(0);
    expect(fav).toBeLessThan(5);
  });

  it('surfaces masking beds at night for the stay-asleep goal', () => {
    const ids = recommendTracks({ ...base, hour: 3, goals: ['stay-asleep'], moments: ['night-wakes'] });
    const topFive = ids.slice(0, 5).map((id) => TRACKS[id].category);
    expect(topFive).toContain('noise');
  });

  it('surfaces breathing for anxious daytime moments', () => {
    const ids = recommendTracks({ ...base, hour: 14, goals: ['calm-anxious'], moments: ['anxious-moments'] });
    const topFive = ids.slice(0, 5).map((id) => TRACKS[id].category);
    expect(topFive).toContain('breathing');
  });

  it('a feeling match still beats taste boosts (feeling cannot be hijacked)', () => {
    const ids = recommendTracks({ ...base, feeling: 'racing', intent: 'reset', favoriteIds: ['spa'] });
    // box-breathing is the canonical racing/reset match
    expect(ids.indexOf('box-breathing')).toBeLessThan(ids.indexOf('spa'));
  });

  it('tracks that carried completed wind-downs rank higher (worked-before)', () => {
    const plain = recommendTracks(base);
    const learned = recommendTracks({ ...base, workedBefore: { fireside: 3 } });
    expect(learned.indexOf('fireside')).toBeLessThan(plain.indexOf('fireside'));
    expect(learned.indexOf('fireside')).toBeLessThan(5);
    // ...but a direct feeling/intent match still outranks a worked-before track
    const withFeeling = recommendTracks({ ...base, feeling: 'racing', intent: 'reset', workedBefore: { spa: 9 } });
    expect(withFeeling.indexOf('box-breathing')).toBeLessThan(withFeeling.indexOf('spa'));
  });

  it('explains honestly and only from real signals', () => {
    expect(explainRecommendation('fireside', { ...base, favoriteIds: ['fireside'] })).toMatch(/favourite/i);
    expect(
      explainRecommendation('brown-noise', { ...base, hour: 3, moments: ['night-wakes'] })
    ).toMatch(/night wake-ups/i);
    // nothing personal to say → null (caller falls back to a generic kicker)
    expect(explainRecommendation('spa', base)).toBeNull();
  });
});
