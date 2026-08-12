import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The Glow Orb store must be unreachable in a build that Apple reviews, and the app
 * must not route users to the retail storefront at all (App Store guideline 1.4.1:
 * theglowcompany.co/products/calmcarry is headlined with medical claims, and an app
 * that funnels users to unsubstantiated disease claims is treated as making them).
 *
 * Modelled on communityGate.test.ts, which documents this exact regression class
 * shipping TWICE while the entry point "looked correctly hidden". So this guards the
 * property that matters - no reachable path opens the storefront or the checkout -
 * not just the visible rows.
 */
const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/** Strip comments so a mention inside prose can never satisfy or violate an assertion. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('device shop is fully gated (guideline 1.4.1)', () => {
  it('the flag is OFF for v1', () => {
    // POSITIVE CONTROL: if the shop is deliberately turned on, re-read these tests.
    expect(code('lib/flags.ts')).toMatch(/DEVICE_SHOP_ENABLED\s*=\s*false/);
  });

  it('the /shop ROUTE checks the flag and redirects, not just the entry rows', () => {
    const route = code('app/shop.tsx');
    expect(route).toMatch(/DEVICE_SHOP_ENABLED/);
    expect(route).toMatch(/if\s*\(\s*!\s*DEVICE_SHOP_ENABLED\s*\)/);
    expect(route).toMatch(/Redirect/);
  });

  it('every buy/store entry row is behind the flag', () => {
    for (const p of ['features/family/Family.tsx', 'features/device/DeviceHub.tsx', 'features/about/About.tsx']) {
      expect(code(p)).toMatch(/DEVICE_SHOP_ENABLED/);
    }
  });

  it('openCheckout is only reachable from the gated shop screen', () => {
    // openCheckout() opens the external storefront checkout. Its only caller must be
    // DeviceShop, whose only route (/shop) is gated above.
    const EXEMPT = ['content/store.ts', '__tests__', 'features/device/DeviceShop.tsx'];
    const hits = execSync(`grep -rl "openCheckout" ${ROOT} || true`)
      .toString()
      .split('\n')
      .filter((f) => f && !EXEMPT.some((e) => f.includes(e)));
    expect(hits).toEqual([]);
  });

  it('no screen opens the retail storefront domain ungated', () => {
    // After the gate, the app must route to NO theglowcompany.co page. The only
    // permitted mentions are the STORE_URL constant, the gated DeviceShop screen, an
    // input placeholder, and a design-token comment.
    const EXEMPT = [
      'content/store.ts', // STORE_URL definition (only consumed behind the gate now)
      '__tests__',
      'features/device/DeviceShop.tsx', // gated screen
      'features/device/RegisterDevice.tsx', // "theglowcompany.co" is a text input placeholder
      'theme/colors.ts', // brand-token source comment
      'lib/flags.ts', // the gate rationale comment
    ];
    const hits = execSync(`grep -rl "theglowcompany.co" ${ROOT} || true`)
      .toString()
      .split('\n')
      .filter((f) => f && f.endsWith('.tsx') === true || (f && f.endsWith('.ts')))
      .filter((f) => f && !EXEMPT.some((e) => f.includes(e)));
    expect(hits).toEqual([]);
  });
});
