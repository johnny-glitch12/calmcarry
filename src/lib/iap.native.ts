import { Platform } from 'react-native';
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isEligibleForIntroOfferIOS,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'react-native-iap';

import { api } from './api';

/**
 * Native in-app purchase flow (StoreKit / Play Billing via react-native-iap v15).
 * The PRODUCT IDS are placeholders that must match the subscriptions you create in
 * App Store Connect / Play Console. Receipts are validated SERVER-SIDE
 * (api.billingValidate → the backend's ReceiptValidation), never trusted locally.
 * Requires a dev/production build (not Expo Go) + the products configured.
 */
export type IapResult = { ok: boolean; reason?: string };

export const iapSupported = true;

// PLACEHOLDER product ids - keep in sync with App Store Connect / Play + the
// backend PREMIUM_PRODUCT_IDS allowlist + content/store.ts PRICING.
const PRODUCT_IDS: Record<'monthly' | 'annual', string> = {
  monthly: 'calmcarry.premium.monthly',
  annual: 'calmcarry.premium.annual',
};
const STORE = Platform.OS === 'ios' ? 'apple' : 'google';

let connected = false;
// The in-flight connect, so N concurrent callers share ONE initConnection() instead
// of each firing their own. The paywall opening does this routinely: it fetches
// localized prices and checks intro-offer eligibility at the same moment.
let connecting: Promise<void> | null = null;
async function ensureConnection(): Promise<void> {
  if (connected) return;
  if (!connecting) {
    connecting = initConnection()
      .then(() => {
        connected = true;
      })
      // clear on BOTH paths: a failed connect must not leave a rejected promise
      // cached here, or every later attempt replays the same old failure and the
      // store can never recover (no sandbox account at launch, signed in later).
      .finally(() => {
        connecting = null;
      });
  }
  await connecting;
}

function receiptOf(p: Purchase): string {
  const any = p as unknown as Record<string, string | undefined>;
  // v15/StoreKit2 → purchaseToken (JWS on iOS, purchase token on Android);
  // legacy fallbacks kept for older receipts.
  return any.purchaseToken || any.transactionReceipt || any.jwsRepresentationIOS || '';
}

async function validateAndFinish(p: Purchase, token: string, productId: string): Promise<boolean> {
  const receipt = receiptOf(p);
  let ok = false;
  let judged = false; // the server actually saw the receipt and answered
  if (receipt) {
    try {
      const r = await api.billingValidate(token, { store: STORE, receipt, productId });
      ok = !!r.isPremium;
      judged = true;
    } catch {
      /* network/server failure - NOT a verdict */
    }
  }
  // Finish (acknowledge) only once the server has judged the receipt. If
  // validation never happened - offline, backend down - the transaction stays
  // open in the store queue and is redelivered on the next launch to the
  // persistent listener below, so a charged user is never silently stranded
  // with an acknowledged-but-unvalidated purchase.
  if (judged) {
    try {
      await finishTransaction({ purchase: p, isConsumable: false });
    } catch {
      /* already finished / not critical */
    }
  }
  return ok;
}

// True while purchaseSubscription()'s own listener is wired up - the launch listener
// stands down so one store event isn't validated twice.
//
// This MUST always get back to false. It used to be cleared only from inside the
// purchase promise's done(), so a flow that never settled - the store sheet dismissed
// without emitting an event, the app backgrounded mid-checkout - latched it true for
// the rest of the process. From then on the launch listener ignored every transaction
// the store delivered, which is precisely the case it exists to catch: the user pays,
// nothing validates it, and they stay locked out of what they just bought.
let purchaseFlowActive = false;

/** Longest a foreground purchase may stay pending before we stop waiting on it.
 *  Not a normal path - it is the backstop for a flow the store never resolves.
 *  Giving up here is safe: the transaction stays in the store queue and the launch
 *  listener picks it up on the next open, which is why releasing the flag matters. */
const PURCHASE_FLOW_TIMEOUT_MS = 3 * 60_000;
let launchListener: { remove(): void } | null = null;

/**
 * Persistent purchase listener for transactions delivered OUTSIDE an active
 * purchase flow: SCA/Ask to Buy approvals that arrive later, or a purchase that
 * completed after the app was killed mid-checkout. Without this, those users
 * paid and stay locked out until they find "Restore purchases". Call once at
 * app start when a server session exists; safe to call repeatedly.
 */
export function initIapListener(getToken: () => string | null, onValidated: () => void): void {
  if (launchListener) return;
  ensureConnection()
    .then(() => {
      if (launchListener) return;
      launchListener = purchaseUpdatedListener(async (p: Purchase) => {
        if (purchaseFlowActive) return;
        const token = getToken();
        if (!token || token === 'local') return;
        const ok = await validateAndFinish(p, token, (p as { productId?: string }).productId || '');
        if (ok) onValidated();
      });
    })
    .catch(() => {
      /* store unavailable (e.g. no sandbox account) - purchase flows still init on demand */
    });
}

export async function purchaseSubscription(plan: 'monthly' | 'annual', token: string): Promise<IapResult> {
  const productId = PRODUCT_IDS[plan];
  try {
    await ensureConnection();
    await fetchProducts({ skus: Object.values(PRODUCT_IDS), type: 'subs' } as never);

    purchaseFlowActive = true;
    try {
      return await new Promise<IapResult>((resolve) => {
        let settled = false;
        const done = (r: IapResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          up.remove();
          err.remove();
          resolve(r);
        };
        const timer = setTimeout(() => done({ ok: false, reason: 'timeout' }), PURCHASE_FLOW_TIMEOUT_MS);
        const up = purchaseUpdatedListener(async (p: Purchase) => {
          const ok = await validateAndFinish(p, token, (p as { productId?: string }).productId || productId);
          done({ ok, reason: ok ? undefined : 'validation_failed' });
        });
        // v15 delivers user cancellation as ErrorCode.UserCancelled ('user-cancelled');
        // older androids used E_USER_CANCELLED. Normalize to 'cancelled' - and never
        // let an UNKNOWN error masquerade as a quiet cancel, or real failures show
        // the user nothing.
        const err = purchaseErrorListener((e: { code?: string }) => {
          const cancelled = e?.code === 'user-cancelled' || e?.code === 'E_USER_CANCELLED';
          done({ ok: false, reason: cancelled ? 'cancelled' : e?.code || 'purchase_failed' });
        });
        Promise.resolve(
          requestPurchase({
            request: { apple: { sku: productId }, google: { skus: [productId] } },
            type: 'subs',
          } as never),
        ).catch(() => done({ ok: false, reason: 'request_failed' }));
      });
    } finally {
      // the one guarantee that matters: however this flow ends - resolved, thrown,
      // or timed out - the launch listener goes back on duty.
      purchaseFlowActive = false;
    }
  } catch {
    return { ok: false, reason: 'iap_unavailable' };
  }
}

/**
 * Localized store prices for the paywall (e.g. "£5.99", "A$99.99") so UK/CA/AU
 * buyers never see a USD string that mismatches what StoreKit/Play actually charges.
 * Returns {} on any failure - the caller falls back to the static USD PRICING.
 */
export async function fetchLocalizedPrices(): Promise<Partial<Record<'monthly' | 'annual', string>>> {
  try {
    await ensureConnection();
    const products = (await fetchProducts({ skus: Object.values(PRODUCT_IDS), type: 'subs' } as never)) as unknown as Record<
      string,
      string
    >[];
    const out: Partial<Record<'monthly' | 'annual', string>> = {};
    for (const plan of ['monthly', 'annual'] as const) {
      const p = (products ?? []).find((x) => (x.id || x.productId) === PRODUCT_IDS[plan]);
      const price = p && (p.displayPrice || p.localizedPrice || p.price);
      if (price) out[plan] = String(price);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Whether THIS Apple ID is still eligible for the introductory offer (the 3-day
 * trial). Intro offers apply once per subscription group, so a lapsed subscriber who
 * resubscribes is charged immediately - promising them a trial breaks guideline 3.1.2
 * and our own honest-claims rule.
 *
 * The subscription-group id is REQUIRED to check this. It used to default to `true`
 * when the group id was unset, so a production build shipped without it promised the
 * trial to EVERYONE - including ineligible returning subscribers, who then got charged
 * $69.99 with no trial (a real surprise charge and a 3.1.2 rejection risk). That is
 * backwards: an unverifiable eligibility must NOT become a promise.
 *
 * So in a production build with no group id, we do NOT promise a trial. In dev we keep
 * it visible for testing, and a transient store error still defaults to eligible
 * (StoreKit is the final gate and most users are first-timers). Set
 * EXPO_PUBLIC_IOS_SUBSCRIPTION_GROUP to the App Store Connect subscription-group id and
 * the check becomes exact per Apple ID.
 */
const SUBSCRIPTION_GROUP = process.env.EXPO_PUBLIC_IOS_SUBSCRIPTION_GROUP ?? '';
export async function introOfferEligible(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true; // Play handles Android intro offers itself
  if (!SUBSCRIPTION_GROUP) {
    // Cannot verify. Don't promise a trial we can't stand behind in a shipped build.
    return __DEV__;
  }
  try {
    await ensureConnection();
    return (await isEligibleForIntroOfferIOS(SUBSCRIPTION_GROUP)) !== false;
  } catch {
    return true; // transient store error - most users are eligible; StoreKit is the gate
  }
}

export async function restoreSubscription(token: string): Promise<IapResult> {
  try {
    await ensureConnection();
    const purchases = (await getAvailablePurchases()) as Purchase[];
    const ids = Object.values(PRODUCT_IDS);
    const match = purchases.find((p) => ids.includes((p as { productId?: string }).productId || ''));
    if (!match) return { ok: false, reason: 'none' };
    const ok = await validateAndFinish(match, token, (match as { productId?: string }).productId || ids[0]);
    return { ok, reason: ok ? undefined : 'validation_failed' };
  } catch {
    return { ok: false, reason: 'iap_unavailable' };
  }
}
