import { CommunityService } from './community.service';

/**
 * Sharing a mix stored null for every real share.
 *
 * The sanitiser iterated a hardcoded allow-list of the LEGACY sound palette (rain,
 * ocean, brown...) which was never updated when the app moved to canonical track ids
 * (rainfall, slow-tide, brown-noise...). Every key the app sent was dropped, the
 * level set came out empty, and the mix was saved as null - while the user was shown
 * "Shared anonymously to the community."
 *
 * It is now a shape check, because the server cannot see the client's content library
 * and any enumerated copy of it rots the moment a track is added.
 */
function svc() {
  const saved: { text: string; status: string; mix: unknown }[] = [];
  const repo = {
    create: (x: Record<string, unknown>) => x,
    save: async (p: Record<string, unknown>) => {
      saved.push(p as never);
      return { id: 'p1', createdAt: new Date('2026-01-01'), ...p };
    },
  };
  return { s: new CommunityService(repo as never, {} as never), saved };
}

/** The sanitiser is private; exercise it the way the app does - through create(). */
async function share(mix: unknown) {
  const { s, saved } = svc();
  await s.create('owner-1', 'Shared a mix to drift to.', mix);
  return saved[0].mix as { name: string; levels: Record<string, number> } | null;
}

describe('shared mix sanitising', () => {
  it('THE BUG: a mix of canonical track ids survives', async () => {
    const mix = await share({ name: 'Rainfall · Slow Tide', levels: { rainfall: 2, 'slow-tide': 3 } });
    expect(mix).not.toBeNull();
    expect(mix!.levels).toEqual({ rainfall: 2, 'slow-tide': 3 });
    expect(mix!.name).toBe('Rainfall · Slow Tide');
  });

  it('legacy keys from already-published posts still survive', async () => {
    const mix = await share({ name: 'Rain', levels: { rain: 1, ocean: 2 } });
    expect(mix!.levels).toEqual({ rain: 1, ocean: 2 });
  });

  it('accepts a track id added after this code was written', async () => {
    // the whole point of the shape check: no catalogue to fall out of date
    const mix = await share({ name: 'New', levels: { 'some-future-track': 2 } });
    expect(mix!.levels).toEqual({ 'some-future-track': 2 });
  });

  it('levels are clamped to 1-3', async () => {
    const mix = await share({ name: 'x', levels: { rainfall: 99, fireside: 0.2, 'brown-noise': -5 } });
    expect(mix!.levels.rainfall).toBe(3);
    expect(mix!.levels.fireside).toBe(1);
    expect(mix!.levels['brown-noise']).toBeUndefined(); // not a positive level
  });

  it('rejects keys that are not track-id shaped', async () => {
    const mix = await share({
      name: 'x',
      levels: {
        rainfall: 2,
        'DROP TABLE': 2,
        ['a'.repeat(64)]: 2,
        'Has Spaces': 1,
        UPPER: 1,
        '': 2,
        '-leading-dash': 1,
        '1numeric': 1,
      },
    });
    expect(Object.keys(mix!.levels)).toEqual(['rainfall']);
  });

  it('rejects __proto__ arriving the way a real request delivers it', async () => {
    // in an object LITERAL __proto__ is not an own property, so writing the test that
    // way would prove nothing. Through JSON.parse - which is how a request body
    // actually reaches this code - it is a real own key.
    const levels = JSON.parse('{"rainfall":2,"__proto__":3,"constructor":2}') as Record<string, number>;
    const mix = await share({ name: 'x', levels });
    expect(Object.keys(mix!.levels)).toEqual(['rainfall']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('caps how many sounds one mix may carry', async () => {
    const levels: Record<string, number> = {};
    for (let i = 0; i < 40; i++) levels[`track-${i}`] = 2;
    const mix = await share({ name: 'huge', levels });
    expect(Object.keys(mix!.levels).length).toBe(12);
  });

  it('a mix with no usable sound is still null (text-only win)', async () => {
    expect(await share({ name: 'x', levels: { 'Bad Key': 2 } })).toBeNull();
    expect(await share({ name: 'x', levels: {} })).toBeNull();
    expect(await share(undefined)).toBeNull();
    expect(await share('not an object')).toBeNull();
    expect(await share({ name: 'x' })).toBeNull();
  });

  it('names a mix that arrives without one', async () => {
    const mix = await share({ levels: { rainfall: 2 } });
    expect(mix!.name).toBe('A shared mix');
  });

  it('caps the name length', async () => {
    const mix = await share({ name: 'z'.repeat(200), levels: { rainfall: 2 } });
    expect(mix!.name.length).toBe(60);
  });

  it('a mix name that trips moderation holds the post for review', async () => {
    const { s, saved } = svc();
    await s.create('owner-1', 'a calm night', { name: 'see https://spam.example', levels: { rainfall: 2 } });
    expect(saved[0].status).toBe('pending');
  });
});
