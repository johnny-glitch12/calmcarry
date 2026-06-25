import { Alert, Linking } from 'react-native';

/**
 * Two purchase paths (definitive build plan):
 *  • The DIGITAL premium subscription is bought IN-APP via Apple/Google IAP
 *    ($12.99/mo or $69.99/yr) — see PRICING below + the paywall.
 *  • The PHYSICAL Glow Orb is hardware. Apple & Google forbid IAP for physical
 *    goods, so the device is sold via external secure web checkout (this file).
 * Device price/currency/shipping are shown at checkout — we don't hard-code them.
 */
export const STORE_URL = 'https://www.theglowcompany.co';

/** Product page for the device. Point this at the real listing when it's live. */
export const DEVICE_CHECKOUT_URL = `${STORE_URL}/products/calmcarry-glow-orb`;

/** OS subscription management (honest billing: one-tap cancel routes here). */
export const SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions';

/** Support / legal pages — placeholders; swap for the real Glow Company URLs. */
export const SUPPORT_URL = `${STORE_URL}/pages/contact`;
export const PRIVACY_URL = `${STORE_URL}/pages/privacy-policy`;
export const TERMS_URL = `${STORE_URL}/pages/terms-of-service`;

export const DEVICE_NAME = 'CalmCarry Glow Orb';

/**
 * Premium subscription pricing (locked decision: subscription only, via Apple/
 * Google IAP, annual-leading, NO free trial). Shown in-app — that's the compliant
 * path for digital subscriptions (IAP), unlike the physical device (external).
 */
export const PRICING = {
  annual: {
    id: 'annual',
    label: 'Annual',
    price: '$69.99',
    per: '/year',
    note: 'Best value · save 55%',
    sub: 'Just $5.83/mo, billed yearly',
  },
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    price: '$12.99',
    per: '/month',
    note: null,
    sub: 'Billed monthly',
  },
} as const;

export type PlanId = keyof typeof PRICING;

/** Why it's worth having more than one. */
export const DEVICE_BENEFITS = [
  'Works the moment you hold it — no app, no setup, nothing to charge',
  'One for every bedside — partner, guest room, or each child',
  'Every Orb is authentic and covered by a 24-month warranty',
] as const;

export type PurchaseReason = 'extra' | 'replacement';

/** Open the web store / checkout. Optionally tag the reason so analytics (and a
 *  future deep-linked product page) can tell an extra from a replacement. */
export function openCheckout(reason?: PurchaseReason) {
  const url = reason ? `${DEVICE_CHECKOUT_URL}?ref=app-${reason}` : DEVICE_CHECKOUT_URL;
  // never fail silently — if the browser can't open, tell the user where to go
  return Linking.openURL(url).catch(() =>
    Alert.alert('Couldn’t open the store', 'Visit theglowcompany.co to get your Glow Orb.')
  );
}
