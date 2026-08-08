import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TRACKS } from '../library';

/**
 * The app must not advertise "sleep stories", "bedtime stories" or "tales" while it
 * ships zero story tracks.
 *
 * This exact claim was scrubbed from the store listing and paywall as an App Store
 * 2.3.1 (accurate metadata) risk, but it survived in onboarding, search, the tour,
 * the account screen and the Tonight header. A UI that promises a feature the binary
 * does not contain is the clearest kind of 2.3.1 rejection, and it disappoints every
 * new user and every parent on their first run.
 *
 * The test binds the copy to the content: if a real story track is ever added, the
 * catalogue check flips and the copy is allowed again.
 */
const SRC = join(__dirname, '..', '..');

describe('no story/tale claims while zero story tracks ship', () => {
  const storyTracks = Object.values(TRACKS).filter((t) => t.category === 'story');

  it('confirms the premise: there are currently no story tracks', () => {
    // POSITIVE CONTROL. If a story track is added, this flips and the guard below is
    // intentionally relaxed - the copy would then be truthful.
    expect(storyTracks).toHaveLength(0);
  });

  it('no user-facing screen promises stories, tales or bedtime stories', () => {
    if (storyTracks.length > 0) return; // stories exist -> the claim would be honest

    // Enumerate the user-facing source (features + app screens), strip comments from
    // each so an internal note about the 'story' category cannot trip the check, then
    // look for the claim words. Comment-stripping is done on file CONTENT rather than
    // per grep line, because a JSX block comment {/* ... */} can span lines and its
    // tail reads like code.
    const files = execSync(`git -C ${SRC} ls-files features app`)
      .toString()
      .split('\n')
      .filter((f) => /\.(t|j)sx?$/.test(f) && !f.includes('__tests__'));

    const claim = /sleep tale|bedtime stor(y|ies)|sleep stor(y|ies)|\btales\b|\bstories\b/i;
    const offenders: string[] = [];
    for (const rel of files) {
      const code = readFileSync(join(SRC, rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSX {/* */} bodies)
        .replace(/^\s*\/\/.*$/gm, ''); // line comments
      code.split('\n').forEach((line, i) => {
        if (claim.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});
