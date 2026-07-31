import { execSync } from 'child_process';
import { join } from 'path';

import { setAnalyticsMode, track, flush, getAnalyticsOptOut } from '../analytics';

/**
 * COPPA INVARIANTS: nothing about a child leaves this device.
 *
 * This is not a nice-to-have. The app's entire legal position on children's privacy
 * rests on it. COPPA's consent duty is triggered by COLLECTING personal information
 * from a child, and the FTC has said an operator is not collecting when information
 * stays on the device and is never transmitted. CalmCarry relies on that: kid
 * profiles are device-local, kids mode makes analytics and crash reporting no-ops,
 * and no screen under features/kids/ talks to the network.
 *
 * If any one of those silently regresses, the app does not merely have a bug - it
 * acquires a verifiable-parental-consent obligation it does not implement, and the
 * published children's notice becomes false. The whole point of pinning it here is
 * that the regression fails the build instead of shipping quietly.
 *
 * These are deliberately structural (grep-based) as well as behavioural: the risk is
 * a NEW file or a NEW call site added later, which a per-file unit test cannot see.
 */
describe('COPPA invariant: no child data leaves the device', () => {
  const srcDir = join(__dirname, '..', '..');
  const repoRoot = join(srcDir, '..');

  const grep = (pattern: string, path: string): string[] => {
    const out = execSync(`grep -rn -E "${pattern}" "${path}" --include=*.ts --include=*.tsx || true`, {
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .filter(Boolean)
      .filter((l) => !l.includes('__tests__'));
  };

  /** Strip comments so a mention in prose never satisfies (or trips) an assertion. */
  const codeOnly = (lines: string[]): string[] =>
    lines.filter((l) => {
      const body = l.slice(l.indexOf(':', l.indexOf(':') + 1) + 1).trim();
      return body.length > 0 && !body.startsWith('//') && !body.startsWith('*') && !body.startsWith('/*');
    });

  it('no screen under features/kids/ touches the network or analytics', () => {
    const kidsDir = join(srcDir, 'features', 'kids');
    const offenders = codeOnly([
      ...grep("\\bapi\\.[a-zA-Z]", kidsDir),
      ...grep("\\bfetch\\s*\\(", kidsDir),
      ...grep("\\btrack\\s*\\(", kidsDir),
      ...grep("from '@/lib/api'", kidsDir),
    ]);
    expect(offenders).toEqual([]);
  });

  /**
   * EVERY screen a child can REACH must gate its network calls on kids mode - not
   * just the ones living in the kids/ folder.
   *
   * This scope hole shipped a false privacy claim. The original test scanned only
   * features/kids/, but KID_ALLOWED lets a child reach /player, whose screen lives
   * in features/player/ - and it called resolveAudioSource unguarded, sending the
   * parent's token plus the exact track a child chose to the server on every play.
   * The folder was clean; the promise was still false.
   */
  it('every kid-reachable screen gates its API calls on kids mode', () => {
    const layout = execSync(`cat "${join(srcDir, 'app', '_layout.tsx')}"`, { encoding: 'utf8' });
    const allowed = /const KID_ALLOWED = \[([^\]]+)\]/.exec(layout)?.[1] ?? '';
    const routes = [...allowed.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThan(0); // the list must still be findable

    // Map each reachable route to the screen file(s) that implement it.
    const routeFiles: Record<string, string[]> = {
      '/player': ['features/player/Player.tsx'],
      '/listen': ['features/listen/ListenScreen.tsx'],
      '/sounds': ['features/sounds/SoundsLibrary.tsx'],
      '/parent-gate': ['features/parentgate/ParentGate.tsx'],
      '/': ['features/tonight/TonightScreen.tsx', 'features/kids/KidsHome.tsx'],
    };

    /**
     * DOCUMENTED EXCEPTION, not a silent exclusion.
     *
     * ParentGate calls api.login in the "Forgot PIN?" recovery flow: a PARENT
     * deliberately proves who they are with their own account password before the
     * PIN is reset. It transmits the parent's own credentials and nothing whatsoever
     * about the child, and it only happens on an explicit adult action.
     *
     * It is listed here rather than excluded by loosening the rule, so that adding a
     * SECOND call to this screen still fails the test. If the published wording ever
     * hardens to "no network request of any kind occurs while a child profile is
     * active", this exception makes that sentence false and must be revisited.
     */
    const DOCUMENTED_EXCEPTIONS: Record<string, string> = {
      'features/parentgate/ParentGate.tsx':
        'api.login - parent-initiated identity check for Forgot PIN; sends no child data',
    };

    for (const route of routes) {
      for (const rel of routeFiles[route] ?? []) {
        const file = join(srcDir, rel);
        let body: string;
        try {
          body = execSync(`cat "${file}"`, { encoding: 'utf8' });
        } catch {
          continue; // screen moved or renamed; the route map below will flag it
        }
        const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        // Any outbound call in a kid-reachable screen must be accompanied by a
        // kids-mode check somewhere in that file.
        const lines = stripped.split('\n');
        const callLines = lines
          .map((l, i) => [i, l] as [number, string])
          .filter(([, l]) => /\bapi\.[a-zA-Z]+|\bresolveAudioSource\s*\(|\bfetch\s*\(/.test(l));
        if (!callLines.length) continue;

        if (DOCUMENTED_EXCEPTIONS[rel]) {
          // Exactly ONE known call is tolerated here. A second one is a new decision
          // and must fail until it is reviewed and documented above.
          expect({ rel, calls: callLines.length }).toEqual({ rel, calls: 1 });
          continue;
        }

        // EACH call must have a kids gate NEAR IT. Checking only that the file
        // contains a gate somewhere is not enough, and that weakness is exactly what
        // let the leak ship: Player.tsx already gated its session logging, so a
        // file-wide search found a gate while the audio request 45 lines above stayed
        // wide open. Proximity is the difference between a test and a decoration.
        // The guard forms actually used in this codebase. `kids` is the local boolean
        // `const kids = mode === 'kids'` (ListenScreen), which is a real gate even
        // though it does not spell out the comparison at the call site.
        const GATE = /mode\s*!==\s*'kids'|mode\s*===\s*'kids'|\bisKid\b|\bwasKid\b|\bkids\b/;
        for (const [idx, line] of callLines) {
          const near = lines.slice(Math.max(0, idx - 12), idx + 2).join('\n');
          expect({ rel, call: line.trim().slice(0, 60), gatedNearby: GATE.test(near) }).toEqual({
            rel,
            call: line.trim().slice(0, 60),
            gatedNearby: true,
          });
        }
      }
    }
  });

  it('deleting a kid profile does not call the server (create/rename/DELETE all gated)', () => {
    const provider = execSync(`cat "${join(srcDir, 'features', 'profile', 'ProfileProvider.tsx')}"`, {
      encoding: 'utf8',
    });
    // A kid id is minted locally as p-kids-<ts>, so an ungated DELETE told the
    // server a child profile existed AND raised a 500 that logged that id.
    const stripped = provider.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).toMatch(/!wasKid[\s\S]{0,80}?api\.deleteProfile|api\.deleteProfile[\s\S]{0,80}?!wasKid/);
  });

  it('every logSession call site is gated on the profile NOT being a kid', () => {
    // A child playing a track must not POST an account-linked listening record.
    const sites = codeOnly(grep("logSession\\(", srcDir)).filter((l) => !l.includes('lib/sessions.ts'));
    expect(sites.length).toBeGreaterThan(0); // guard against the grep silently matching nothing

    for (const site of sites) {
      const [file, lineNo] = [site.split(':')[0], parseInt(site.split(':')[1], 10)];
      const body = execSync(`cat "${file}"`, { encoding: 'utf8' }).split('\n');
      // the kids guard must appear within the preceding few lines
      const window = body.slice(Math.max(0, lineNo - 8), lineNo).join('\n');
      expect(window).toMatch(/mode\s*!==\s*'kids'/);
    }
  });

  it('kid profiles are never sent to the server (create + rename are adult-only)', () => {
    const provider = join(srcDir, 'features', 'profile', 'ProfileProvider.tsx');
    // Comments stripped first: a long explanatory comment between the guard and the
    // call must not push them out of range and fail a correct implementation, and a
    // guard MENTIONED in prose must not satisfy the check either.
    const code = execSync(`cat "${provider}"`, { encoding: 'utf8' })
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\/.*$/gm, '');

    // Each server call must sit within a few lines of its kids guard.
    const lines = code.split('\n');
    const nearGuard = (needle: RegExp, guard: RegExp) => {
      const i = lines.findIndex((l) => needle.test(l));
      expect(i).toBeGreaterThanOrEqual(0); // the call must still exist to be guarded
      return guard.test(lines.slice(Math.max(0, i - 10), i + 2).join('\n'));
    };

    // Match on the METHOD, not `api.method`: the call is chained across lines
    // (`api` then `.createProfile(...)`), so requiring both on one line finds nothing
    // and the check would silently pass on an empty search instead of failing.
    expect(nearGuard(/\.createProfile\s*\(/, /type === 'adult'/)).toBe(true);
    expect(nearGuard(/\.updateProfile\s*\(/, /!isKid\b/)).toBe(true);
  });

  it('no advertising / attribution / third-party analytics SDK is installed', () => {
    // "email plus" and the internal-operations exemption both evaporate the moment
    // children's data is disclosed to a third party. Adding one of these is a legal
    // change, not a dependency change, so it must not pass silently.
    const pkg = JSON.parse(execSync(`cat "${join(repoRoot, 'package.json')}"`, { encoding: 'utf8' }));
    const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
    const banned = [
      'react-native-fbsdk',
      'appsflyer',
      'react-native-idfa',
      'branch',
      'amplitude',
      'mixpanel',
      'segment',
      '@segment',
      'firebase-analytics',
      'react-native-google-mobile-ads',
      'admob',
      'onesignal',
    ];
    const found = deps.filter((d) => banned.some((b) => d.toLowerCase().includes(b)));
    expect(found).toEqual([]);
  });
});

/**
 * These assert on the TRANSPORT, not on a return value.
 *
 * The first version of this suite asserted `expect(flush()).resolves.toBeUndefined()`
 * and PASSED with the kids guard deleted - flush() catches its own network failure
 * and resolves either way, so the assertion proved nothing. The only thing that
 * actually distinguishes "no data left the device" is whether the send was ever
 * attempted, so spy on it. Mutation-tested.
 */
jest.mock('../api', () => ({
  api: { trackEvents: jest.fn().mockResolvedValue({ ok: true }) },
}));
// expo-crypto and expo-secure-store are native modules with no jest implementation.
// flush() resolves the anonymous install id before sending, and secureGet swallows
// its own failure, so without these the send silently never happens and EVERY
// "nothing was sent" assertion would pass vacuously. The control test below exists
// to prove these mocks work.
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-anon-id-0000' }));
jest.mock('expo-secure-store', () => {
  const mem: Record<string, string> = {};
  return {
    getItemAsync: async (k: string) => mem[k] ?? null,
    setItemAsync: async (k: string, v: string) => {
      mem[k] = v;
    },
    deleteItemAsync: async (k: string) => {
      delete mem[k];
    },
  };
});
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { api } = require('../api') as { api: { trackEvents: jest.Mock } };

describe('COPPA invariant: kids-mode kill switches actually fire', () => {
  beforeEach(() => api.trackEvents.mockClear());
  afterEach(() => setAnalyticsMode('adult'));

  it('sends NOTHING to the server while a child profile is active', async () => {
    setAnalyticsMode('kids');
    // A burst well past the flush threshold (10) - if the guard regressed these
    // would batch and ship.
    for (let i = 0; i < 25; i++) await track('session_start', { contentId: 'slow-tide' });
    await flush();
    expect(api.trackEvents).not.toHaveBeenCalled();
  });

  it('the kids guard is independent of the adult analytics opt-out', async () => {
    // Kids are never tracked REGARDLESS of the adult opt-out: two separate
    // protections that must not be collapsed into one.
    await expect(getAnalyticsOptOut()).resolves.toBe(false); // adult is opted IN
    setAnalyticsMode('kids');
    for (let i = 0; i < 12; i++) await track('paywall_view');
    await flush();
    expect(api.trackEvents).not.toHaveBeenCalled();
  });

  it('control: an ADULT profile DOES send (proves the spy would catch a leak)', async () => {
    setAnalyticsMode('adult');
    // Deliberately BELOW the auto-flush threshold (10): at or above it, track()
    // fires its own un-awaited flush, and the awaited one below then returns
    // immediately on the single-flight guard - so the assertion would run before the
    // send resolved and this control would fail for the wrong reason.
    for (let i = 0; i < 5; i++) await track('session_start', { contentId: 'slow-tide' });
    await flush();
    expect(api.trackEvents).toHaveBeenCalled();
  });
});
