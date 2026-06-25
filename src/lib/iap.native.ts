import { Platform } from 'react-native';
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
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

// PLACEHOLDER product ids — keep in sync with App Store Connect / Play + the
// backend PREMIUM_PRODUCT_IDS allowlist + content/store.ts PRICING.
const PRODUCT_IDS: Record<'monthly' | 'annual', string> = {
  monthly: 'calmcarry.premium.monthly',
  annual: 'calmcarry.premium.annual',
};
const STORE = Platform.OS === 'ios' ? 'apple' : 'google';

let connected = false;
async function ensureConnection(): Promise<void> {
  if (connected) return;
  await initConnection();
  connected = true;
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
  if (receipt) {
    try {
      const r = await api.billingValidate(token, { store: STORE, receipt, productId });
      ok = !!r.isPremium;
    } catch {
      ok = false;
    }
  }
  try {
    await finishTransaction({ purchase: p, isConsumable: false });
  } catch {
    /* already finished / not critical */
  }
  return ok;
}

export async function purchaseSubscription(plan: 'monthly' | 'annual', token: string): Promise<IapResult> {
  const productId = PRODUCT_IDS[plan];
  try {
    await ensureConnection();
    await fetchProducts({ skus: Object.values(PRODUCT_IDS), type: 'subs' } as never);

    return await new Promise<IapResult>((resolve) => {
      let settled = false;
      const done = (r: IapResult) => {
        if (settled) return;
        settled = true;
        up.remove();
        err.remove();
        resolve(r);
      };
      const up = purchaseUpdatedListener(async (p: Purchase) => {
        const ok = await validateAndFinish(p, token, (p as { productId?: string }).productId || productId);
        done({ ok, reason: ok ? undefined : 'validation_failed' });
      });
      const err = purchaseErrorListener((e: { code?: string }) => done({ ok: false, reason: e?.code || 'cancelled' }));
      Promise.resolve(
        requestPurchase({
          request: { apple: { sku: productId }, google: { skus: [productId] } },
          type: 'subs',
        } as never),
      ).catch(() => done({ ok: false, reason: 'request_failed' }));
    });
  } catch {
    return { ok: false, reason: 'iap_unavailable' };
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
