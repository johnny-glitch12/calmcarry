import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The community wall must be unreachable in a build that answers "User Generated
 * Content: NO" on the App Store Connect privacy form.
 *
 * This has already been wrong twice, in two different ways, and both times the tab
 * looked correctly hidden:
 *   1. the Listen screen had a "Share this mix anonymously" button that posted to the
 *      wall without checking the flag;
 *   2. the route itself rendered unconditionally - expo-router's `href: null` hides
 *      the tab BUTTON but leaves the route registered, so calmcarry://community still
 *      opened it.
 *
 * So this guards the property that actually matters - no reachable path publishes or
 * displays user content - rather than the tab bar, which is the part that kept
 * looking fine while the app was still shipping UGC.
 */
const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Strip comments so a mention inside prose can never satisfy an assertion. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('community wall is fully gated', () => {
  it('the flag is OFF for v1', () => {
    // POSITIVE CONTROL for every assertion below: if the wall were deliberately
    // turned on, these tests should be re-read, not silently passing.
    expect(code('lib/flags.ts')).toMatch(/COMMUNITY_ENABLED\s*=\s*false/);
  });

  it('the ROUTE checks the flag, not just the tab bar', () => {
    const route = code('app/(tabs)/community.tsx');
    expect(route).toMatch(/COMMUNITY_ENABLED/);
    // and it must actually branch on it, not merely import it
    expect(route).toMatch(/if\s*\(\s*!\s*COMMUNITY_ENABLED\s*\)/);
  });

  it('the Listen screen mix-share is behind the flag', () => {
    // the exact miss last time: the tab was hidden, this button still posted.
    const src = code('features/listen/ListenScreen.tsx');
    expect(src).toMatch(/createPost/); // the button still exists for when the wall returns
    expect(src).toMatch(/COMMUNITY_ENABLED\s*&&/);
  });

  it('NO new entry point can publish without the flag', () => {
    // Catches a future third caller being added and missed the way the last one was.
    // CommunityScreen is exempt: it IS the wall, and its only route is gated above.
    const EXEMPT = ['lib/api.ts', '__tests__', 'features/community/CommunityScreen.tsx'];
    const hits = execSync(`grep -rl "createPost" ${ROOT} || true`)
      .toString()
      .split('\n')
      .filter((f) => f && !EXEMPT.some((e) => f.includes(e)));

    const ungated = hits.filter((f) => !/COMMUNITY_ENABLED/.test(readFileSync(f, 'utf8')));
    expect(ungated).toEqual([]);
  });

  it('the tab is still hidden too', () => {
    expect(code('app/(tabs)/_layout.tsx')).toMatch(/COMMUNITY_ENABLED/);
    expect(code('components/TabBar.tsx')).toMatch(/COMMUNITY_ENABLED/);
  });
});
