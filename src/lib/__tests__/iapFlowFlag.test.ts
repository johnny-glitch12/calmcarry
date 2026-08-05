/**
 * The purchase flow must always hand the store back to the launch listener.
 *
 * `purchaseFlowActive` mutes the persistent launch listener so a single store event
 * isn't validated twice. If it ever latches true, that listener stays muted for the
 * rest of the process - and it is the thing that rescues a user who paid while the
 * app was backgrounded, or whose Ask to Buy was approved hours later. A stuck flag
 * turns "you paid and we'll sort it out on next launch" into "you paid and nothing
 * happens, ever".
 *
 * These tests drive the real module against a fake react-native-iap so the flag is
 * observed the only way the app observes it: through the launch listener's behaviour.
 */

type PurchaseCb = (p: unknown) => void | Promise<void>;

const mockListeners: { purchase: PurchaseCb[]; error: ((e: unknown) => void)[] } = { purchase: [], error: [] };
let mockRequestPurchase: () => Promise<unknown> = async () => undefined;
let mockInitCalls = 0;
let mockInitImpl: () => Promise<boolean> = async () => true;

jest.mock('react-native-iap', () => ({
  initConnection: () => {
    mockInitCalls += 1;
    return mockInitImpl();
  },
  fetchProducts: async () => [],
  finishTransaction: async () => undefined,
  getAvailablePurchases: async () => [],
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
  api: { billingValidate: jest.fn(async () => ({ isPremium: true })) },
}));

/** Fire the store event at the LAUNCH listener only (index 0 is registered first). */
async function emitToLaunchListener(productId = 'calmcarry.premium.monthly') {
  const launch = mockListeners.purchase[0];
  await launch?.({ productId, purchaseToken: 'tok' });
}

describe('purchaseFlowActive always releases', () => {
  let iap: typeof import('../iap.native');
  let onValidated: jest.Mock;

  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    mockListeners.purchase = [];
    mockListeners.error = [];
    mockInitCalls = 0;
    mockInitImpl = async () => true;
    mockRequestPurchase = async () => undefined;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iap = require('../iap.native');
    onValidated = jest.fn();
    iap.initIapListener(() => 'token-123', onValidated);
    // let ensureConnection() settle so the launch listener is registered
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers the launch listener and validates a transaction delivered at rest', async () => {
    // POSITIVE CONTROL. If this fails, every assertion below is vacuous - they would
    // all "pass" simply because nothing was ever listening.
    expect(mockListeners.purchase.length).toBe(1);
    await emitToLaunchListener();
    expect(onValidated).toHaveBeenCalled();
  });

  it('a completed purchase leaves the launch listener live', async () => {
    const p = iap.purchaseSubscription('monthly', 'token-123');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    // the flow's own listener answers
    const flowListener = mockListeners.purchase[mockListeners.purchase.length - 1];
    await flowListener?.({ productId: 'calmcarry.premium.monthly', purchaseToken: 'tok' });
    await p;

    onValidated.mockClear();
    await emitToLaunchListener();
    expect(onValidated).toHaveBeenCalled();
  });

  it('THE BUG: a flow the store never resolves still releases the listener', async () => {
    // requestPurchase resolves, but no purchase or error event ever arrives - the
    // sheet was dismissed without emitting, or the app was backgrounded mid-checkout.
    const p = iap.purchaseSubscription('monthly', 'token-123');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(3 * 60_000 + 1000);
    const result = await p;

    // we stopped waiting, and said so honestly rather than claiming success
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timeout');

    // and crucially the launch listener is back on duty for the transaction that
    // may still be sitting in the store queue
    onValidated.mockClear();
    await emitToLaunchListener();
    expect(onValidated).toHaveBeenCalled();
  });

  it('a cancelled purchase releases the listener', async () => {
    const p = iap.purchaseSubscription('monthly', 'token-123');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    mockListeners.error[mockListeners.error.length - 1]?.({ code: 'user-cancelled' });
    expect((await p).reason).toBe('cancelled');

    onValidated.mockClear();
    await emitToLaunchListener();
    expect(onValidated).toHaveBeenCalled();
  });

  it('a purchase that throws releases the listener', async () => {
    mockRequestPurchase = async () => {
      throw new Error('store exploded');
    };
    const p = iap.purchaseSubscription('monthly', 'token-123');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await p;

    onValidated.mockClear();
    await emitToLaunchListener();
    expect(onValidated).toHaveBeenCalled();
  });
});

describe('ensureConnection', () => {
  let iap: typeof import('../iap.native');

  beforeEach(async () => {
    jest.resetModules();
    mockListeners.purchase = [];
    mockListeners.error = [];
    mockInitCalls = 0;
    mockInitImpl = async () => true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iap = require('../iap.native');
  });

  it('concurrent callers share one initConnection', async () => {
    // the paywall does exactly this on open: prices and intro-offer eligibility at once
    await Promise.all([iap.fetchLocalizedPrices(), iap.fetchLocalizedPrices(), iap.fetchLocalizedPrices()]);
    expect(mockInitCalls).toBe(1);
  });

  it('a failed connect can be retried rather than cached forever', async () => {
    // no sandbox account at launch, signed in a minute later: the second attempt has
    // to actually reach the store instead of replaying the first failure.
    mockInitImpl = async () => {
      throw new Error('no store');
    };
    await iap.fetchLocalizedPrices();
    expect(mockInitCalls).toBe(1);

    mockInitImpl = async () => true;
    await iap.fetchLocalizedPrices();
    expect(mockInitCalls).toBe(2);
  });
});
