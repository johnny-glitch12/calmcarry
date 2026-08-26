/**
 * In-app purchase facade - DEFAULT / WEB build (no native store). Metro picks
 * `iap.native.ts` on iOS/Android; web/SSR uses this no-op so the bundle never
 * imports react-native-iap (which has no web support).
 */
export type IapResult = { ok: boolean; reason?: string; expiresAt?: string | null };

/** See iap.native.ts - on web there is no store, so the verdict is always 'none'. */
export type StoreEntitlement = { verdict: 'active' | 'none' | 'unknown'; expiresAt: string | null };

/** True only where a real store (StoreKit / Play Billing) is available. */
export const iapSupported = false;

export async function purchaseSubscription(_plan: 'monthly' | 'annual', _token: string | null): Promise<IapResult> {
  return { ok: false, reason: 'unavailable' };
}

export async function restoreSubscription(_token: string | null): Promise<IapResult> {
  return { ok: false, reason: 'unavailable' };
}

/** No native store on web - the paywall falls back to the static PRICING. */
export async function fetchLocalizedPrices(): Promise<Partial<Record<'monthly' | 'annual', string>>> {
  return {};
}

/** No store queue on web - nothing to listen for. */
export function initIapListener(_getToken: () => string | null | undefined, _onValidated: (expiresAt?: string | null) => void): void {}

/** No store on web - nothing can be owned. */
export async function currentStoreEntitlement(): Promise<StoreEntitlement> {
  return { verdict: 'none', expiresAt: null };
}

/** No StoreKit on web - keep the trial copy (the store is the final gate). */
export async function introOfferEligible(): Promise<boolean> {
  return true;
}
