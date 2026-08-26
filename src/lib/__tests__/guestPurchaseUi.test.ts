/**
 * The 5.1.1(v) rejection surface, pinned at the SOURCE level.
 *
 * Apple rejected build 17 because the paywall bounced signed-out users to /auth
 * before they could purchase ("app requires users to register ... to purchase
 * In-App Purchase products that are not account based"). The lib-level guest
 * contract lives in guestPurchase.test.ts, but the thing Apple actually saw was
 * the SCREEN behaviour - and mounting CalmPlan/AccountScreen needs the full
 * provider tree, so these invariants are pinned the way parentGateHardening
 * pins ParentGate: by reading the source. Crude, but it makes re-adding any
 * sign-in gate on the purchase path a red suite instead of a silent regression.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

describe('no registration wall on the purchase path (App Store 5.1.1(v))', () => {
  const calmPlan = read('features/paywall/CalmPlan.tsx');
  const account = read('features/account/AccountScreen.tsx');
  const signIn = read('features/auth/SignIn.tsx');
  const auth = read('features/auth/AuthProvider.tsx');

  it('the paywall purchases for guests (null token), never routing to /auth', () => {
    expect(calmPlan).toContain('purchaseSubscription(plan, live ? token : null)');
    // the exact rejected behaviour: a signed-out Subscribe bounced to sign-in
    expect(calmPlan).not.toMatch(/Sign in first/);
    expect(calmPlan).not.toMatch(/router\.push\(['"]\/auth/);
  });

  it('restore works signed out on both the paywall and Settings', () => {
    expect(calmPlan).toContain('restoreSubscription(live ? token : null)');
    expect(account).toContain('restoreSubscription(live ? token : null)');
    expect(calmPlan).not.toMatch(/Sign in to restore/);
    expect(account).not.toMatch(/Sign in to restore/);
  });

  it('registration is explicitly optional where the funnel lands', () => {
    expect(signIn).toContain('Continue without an account');
  });

  it('the paywall tells guests an account is optional (Apple-suggested remedy)', () => {
    expect(calmPlan).toMatch(/No account needed/);
  });

  it("a store round-trip with no verdict ('unknown') can never downgrade", () => {
    // both the guest reconcile and the authed foreground guard must treat an
    // unreachable store as silence, not as "not premium"
    expect(auth).toMatch(/verdict === 'unknown'\) return/);
  });

  it("the planted-'local'-token guard survives on web, where no store can vouch", () => {
    expect(auth).toContain("savedToken === 'local' && !COMP_LOGIN && !iapSupported");
  });

  it('sign-in and registration carry a live guest purchase into the account', () => {
    // the entRef carry-over is what makes "buy first, register later" real
    expect(auth).toMatch(/isLivePremium\(entRef\.current\)/);
    expect(auth).toMatch(/linkGuestPurchase/);
  });

  it("the kids-mode contract holds: the store reconcile waits for an adult profile", () => {
    expect(auth).toMatch(/isKidsActive\(\)\) return/);
  });
});
