/**
 * In-app purchase facade — DEFAULT / WEB build (no native store). Metro picks
 * `iap.native.ts` on iOS/Android; web/SSR uses this no-op so the bundle never
 * imports react-native-iap (which has no web support).
 */
export type IapResult = { ok: boolean; reason?: string };

/** True only where a real store (StoreKit / Play Billing) is available. */
export const iapSupported = false;

export async function purchaseSubscription(_plan: 'monthly' | 'annual', _token: string): Promise<IapResult> {
  return { ok: false, reason: 'unavailable' };
}

export async function restoreSubscription(_token: string): Promise<IapResult> {
  return { ok: false, reason: 'unavailable' };
}

/** No native store on web — the paywall falls back to the static PRICING. */
export async function fetchLocalizedPrices(): Promise<Partial<Record<'monthly' | 'annual', string>>> {
  return {};
}
