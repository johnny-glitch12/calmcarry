import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Every surface that plays a catalogue TRACK must reason about the looping contract.
 * `trackLoops()` is the single source of truth: ambient beds and anything sold as
 * "loops" play until stopped; guided, breathing and timed music play once and end
 * gently.
 *
 * REGRESSION GUARD: wind-down.tsx - the flagship 20-minute ritual - set
 * `audio.loop = true` unconditionally and never imported trackLoops at all, so when
 * the recommender handed it a finite track it replayed a 4-minute AI-narrated
 * meditation five times through the ritual. Player and PlaybackProvider both got it
 * right, which is precisely why per-file tests missed it.
 *
 * The assertion is "the file references the contract", which is what actually
 * distinguished the broken surface from the correct ones. It deliberately does NOT
 * ban a hardcoded `loop = true`: PlaybackProvider's mixer palette is built by
 * filtering the catalogue through trackLoops (see MIX_CATALOG), so every sound it
 * can play is loopable by construction and looping it is correct.
 *
 * Scope: files importing the track catalogue. Decorative always-on ambience (splash,
 * onboarding) and the expo-video learn clip do not play catalogue tracks and are out
 * of scope rather than silently excused.
 */
describe('looping contract on catalogue-playback surfaces', () => {
  const srcDir = join(__dirname, '..', '..');

  const surfaces = (): string[] => {
    const out = execSync(`grep -rl -F "TRACKS" "${srcDir}" --include=*.ts --include=*.tsx || true`, {
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .filter(Boolean)
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => !f.endsWith(join('content', 'library.ts'))) // the contract's own home
      // only surfaces that actually drive a player's loop flag
      .filter((f) => execSync(`grep -c -F ".loop =" "${f}" || true`, { encoding: 'utf8' }).trim() !== '0');
  };

  it('found the playback surfaces to check', () => {
    expect(surfaces().length).toBeGreaterThan(0);
  });

  /** Source with comments stripped - a mention of the contract in a COMMENT must not
   *  satisfy this test. (First draft asserted `toContain('trackLoops')` on the raw
   *  file and passed even with the bug reintroduced, because the explanatory comment
   *  contained the word. Mutation-tested since.) */
  const codeOf = (file: string): string =>
    execSync(`cat "${file}"`, { encoding: 'utf8' })
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/^\s*\/\/.*$/gm, '') // whole-line comments
      .replace(/\/\/.*$/gm, ''); // trailing comments

  it.each(surfaces().map((f) => [f.replace(`${srcDir}/`, ''), f] as [string, string]))(
    '%s actually CALLS trackLoops() to decide its loop flag',
    (_rel, file) => {
      const code = codeOf(file);
      expect(code).toMatch(/\btrackLoops\s*\(/); // a real call, not a mention
      // and it must be imported from the contract's home, not shadowed locally
      expect(code).toMatch(/import\s*\{[^}]*\btrackLoops\b[^}]*\}\s*from\s*['"]@\/content\/library['"]/);
    },
  );
});
