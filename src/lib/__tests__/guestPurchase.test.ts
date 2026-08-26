/**
 * Signed-out purchases must WORK (App Store 5.1.1(v)).
 *
 * Apple rejected requiring registration before buying a subscription that isn't
 * account-based. The contract pinned here: with no server session (token null or
 * the offline 'local' sentinel), the purchase/restore/redelivery paths validate
 * against the STORE's own event on-device - never the backend - finish the
 * transaction, and surface the store's expiry so the caller can grant a local,
 * self-bounding entitlement. A real session keeps the server-validated path.
 *
 * Same harness as iapFlowFlag.test.ts: the real module against a fake
 * react-native-iap, observed only through public behaviour.
 */

type PurchaseCb = (p: unknown) => void | Promise<void>;

const mockListeners: { purchase: PurchaseCb[]; error: ((e: unknown) => void)[] } = { purchase: [], error: [] };
let mockRequestPurchase: () => Promise<unknown> = async () => undefined;
let mockAvailablePurchases: unknown[] = [];
let mockAvailableImpl: () => Promise<unknown[]> = async () => mockAvailablePurchases;
let mockFinishCalls = 0;
const mockBillingValidate = jest.fn(async () => ({ isPremium: true }));

jest.mock('react-native-iap', () => ({
  initConnection: async () => true,
  fetchProducts: async () => [],
  finishTransaction: async () => {
    mockFinishCalls += 1;
  },
  getAvailablePurchases: () => mockAvailableImpl(),
  isEligibleForIntroOfferIOS: async () => true,
  requestPurchase: () => mockRequestPurchase(),
  purchaseUpdatedListener: (cb: PurchaseCb) => {
    mockListeners.purchase.push(cb);
    return {
      remove: () => {
        mockListeners.purchase = mockListeners.purchase.filter((x) => x !== cb);
      },
    };
  },
  purchaseErrorListener: (cb: (e: unknown) => void) => {
    mockListeners.error.push(cb);
    return {
      remove: () => {
        mockListeners.error = mockListeners.error.filter((x) => x !== cb);
      },
    };
  },
}));

jest.mock('../api', () => ({
  api: { billingValidate: mockBillingValidate },
}));

/** A StoreKit2-shaped signed transaction: only the base64url JSON payload matters. */
function jwsWith(expiresDate: number): string {
  return `eyJhbGciOiJFUzI1NiJ9.${Buffer.from(JSON.stringify({ expiresDate })).toString('base64url')}.sig`;
}

// Unlike iapFlowFlag.test.ts (whose beforeEach pre-warms the store connection via
// initIapListener), these tests hit ensureConnection COLD - the connect promise
// chain alone is several microtask hops - so settle deeper than 3 ticks.
const settle = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe('guest purchase (no server session)', () => {
  let iap: typeof import('../iap.native');

  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    mockListeners.purchase = [];
    mockListeners.error = [];
    mockRequestPurchase = async () => undefined;
    mockAvailablePurchases = [];
    mockAvailableImpl = async () => mockAvailablePurchases;
    mockFinishCalls = 0;
    mockBillingValidate.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iap = require('../iap.native');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a signed-out purchase succeeds on the store event alone - no backend call', async () => {
    const expires = Date.now() + 30 * 86_400_000;
    const p = iap.purchaseSubscription('monthly', null);
    await settle();
    const flowListener = mockListeners.purchase[mockListeners.purchase.length - 1];
    await flowListener?.({ productId: 'calmcarry.premium.monthly', purchaseToken: jwsWith(expires) });
    const r = await p;

    expect(r.ok).toBe(true);
    // the store's own expiry rides along so the local entitlement self-bounds
    expect(r.expiresAt).toBe(new Date(expires).toISOString());
    // no account, no server: the whole point of 5.1.1(v)
    expect(mockBillingValidate).not.toHaveBeenCalled();
    // acknowledged immediately - content is delivered locally the moment we grant
    expect(mockFinishCalls).toBe(1);
  });

  it('a guest event for a foreign product id grants nothing', async () => {
    const p = iap.purchaseSubscription('monthly', null);
    await settle();
    const flowListener = mockListeners.purchase[mockListeners.purchase.length - 1];
    await flowListener?.({ productId: 'someone.elses.sku', purchaseToken: jwsWith(Date.now()) });
    const r = await p;

    expect(r.ok).toBe(false);
    expect(mockFinishCalls).toBe(0);
  });

  it('the launch listener rescues a guest redelivery (Ask to Buy / killed mid-checkout)', async () => {
    const onValidated = jest.fn();
    iap.initIapListener(() => null, onValidated);
    await settle();

    const expires = Date.now() + 86_400_000;
    await mockListeners.purchase[0]?.({ productId: 'calmcarry.premium.annual', purchaseToken: jwsWith(expires) });

    expect(onValidated).toHaveBeenCalledWith(new Date(expires).toISOString());
    expect(mockBillingValidate).not.toHaveBeenCalled();
    expect(mockFinishCalls).toBe(1);
  });

  it("the offline 'local' sentinel takes the guest path, not a dead server call", async () => {
    const onValidated = jest.fn();
    iap.initIapListener(() => 'local', onValidated);
    await settle();

    await mockListeners.purchase[0]?.({ productId: 'calmcarry.premium.monthly', purchaseToken: jwsWith(Date.now() + 1000) });

    expect(onValidated).toHaveBeenCalled();
    expect(mockBillingValidate).not.toHaveBeenCalled();
  });

  it('Android opaque tokens (no JWS) still grant, with no local expiry bound', async () => {
    // Play purchase tokens are opaque - expiry is unknowable on-device, so the
    // grant is { ok, expiresAt: null } and lapse detection belongs to the store
    // reconcile. A future "hardening" that treats an unparseable expiry as a
    // validation failure would silently break every Android guest.
    const onValidated = jest.fn();
    iap.initIapListener(() => null, onValidated);
    await settle();

    await mockListeners.purchase[0]?.({ productId: 'calmcarry.premium.monthly', purchaseToken: 'opaque-android-token' });

    expect(onValidated).toHaveBeenCalledWith(null);
    expect(mockFinishCalls).toBe(1);
  });

  it('a still-restoring session (getToken undefined) leaves the event queued, not guest-finished', async () => {
    const onValidated = jest.fn();
    iap.initIapListener(() => undefined, onValidated);
    await settle();

    await mockListeners.purchase[0]?.({ productId: 'calmcarry.premium.monthly', purchaseToken: jwsWith(Date.now() + 1000) });

    // no verdict yet: not finished (stays in the store queue), no grant, no server call
    expect(onValidated).not.toHaveBeenCalled();
    expect(mockFinishCalls).toBe(0);
    expect(mockBillingValidate).not.toHaveBeenCalled();
  });

  it('guest restore re-applies what the Apple/Google account owns - no CalmCarry account needed', async () => {
    const expires = Date.now() + 5 * 86_400_000;
    mockAvailablePurchases = [{ productId: 'calmcarry.premium.annual', purchaseToken: jwsWith(expires) }];

    const r = await iap.restoreSubscription(null);

    expect(r.ok).toBe(true);
    expect(r.expiresAt).toBe(new Date(expires).toISOString());
    expect(mockBillingValidate).not.toHaveBeenCalled();
  });

  it('restore WITH a session still validates server-side (the account-linking path)', async () => {
    mockAvailablePurchases = [{ productId: 'calmcarry.premium.annual', purchaseToken: jwsWith(Date.now() + 1000) }];

    const r = await iap.restoreSubscription('token-123');

    expect(r.ok).toBe(true);
    expect(mockBillingValidate).toHaveBeenCalledTimes(1);
    expect(mockBillingValidate.mock.calls[0][0]).toBe('token-123');
  });
});

describe('currentStoreEntitlement - the guest source of truth', () => {
  let iap: typeof import('../iap.native');

  beforeEach(async () => {
    jest.resetModules();
    mockListeners.purchase = [];
    mockListeners.error = [];
    mockAvailablePurchases = [];
    mockAvailableImpl = async () => mockAvailablePurchases;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iap = require('../iap.native');
  });

  it("an owned subscription is 'active' with the store's expiry", async () => {
    const expires = Date.now() + 86_400_000;
    mockAvailablePurchases = [{ productId: 'calmcarry.premium.monthly', purchaseToken: jwsWith(expires) }];
    expect(await iap.currentStoreEntitlement()).toEqual({ verdict: 'active', expiresAt: new Date(expires).toISOString() });
  });

  it("nothing owned is a definitive 'none' - callers may downgrade", async () => {
    expect(await iap.currentStoreEntitlement()).toEqual({ verdict: 'none', expiresAt: null });
  });

  it("an owned Android subscription (opaque token) is 'active' with null expiry", async () => {
    mockAvailablePurchases = [{ productId: 'calmcarry.premium.annual', purchaseToken: 'opaque-android-token' }];
    expect(await iap.currentStoreEntitlement()).toEqual({ verdict: 'active', expiresAt: null });
  });

  it("a store failure is 'unknown', never a downgrade verdict", async () => {
    mockAvailableImpl = async () => {
      throw new Error('store unreachable');
    };
    expect((await iap.currentStoreEntitlement()).verdict).toBe('unknown');
  });
});
