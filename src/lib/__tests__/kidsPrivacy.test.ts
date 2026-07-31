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
    const body = execSync(`cat "${provider}"`, { encoding: 'utf8' });
    // createProfile must be gated on an adult type
    expect(body).toMatch(/type === 'adult'.*api\.createProfile|api\.createProfile[\s\S]{0,200}?type === 'adult'/);
    // updateProfile must be gated on the profile not being a kid
    expect(body).toMatch(/isKid[\s\S]{0,120}?api\.updateProfile|!isKid/);
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
