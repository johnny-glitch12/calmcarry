import { Alert, Linking, Platform } from 'react-native';

/**
 * Two purchase paths (definitive build plan):
 *  • The DIGITAL premium subscription is bought IN-APP via Apple/Google IAP
 *    ($12.99/mo or $69.99/yr) - see PRICING below + the paywall.
 *  • The PHYSICAL Glow Orb is hardware. Apple & Google forbid IAP for physical
 *    goods, so the device is sold via external secure web checkout (this file).
 * Device price/currency/shipping are shown at checkout - we don't hard-code them.
 */
export const STORE_URL = 'https://www.theglowcompany.co';

/**
 * Product page for the device.
 *
 * Was `/products/calmcarry-glow-orb`, which returns 404 on the live storefront - so
 * every "Get a Glow Orb" tap in the shipped app landed on a not-found page. The real
 * listing is `/products/calmcarry` (verified 200 on 2026-08-05).
 *
 * [MASON] Confirm this handle is canonical and will not be renamed. The storefront
 * calls the product "CalmCarry®" while the app copy says "Glow Orb"; if the product
 * is renamed, this constant and the in-app naming both need updating together.
 */
export const DEVICE_CHECKOUT_URL = `${STORE_URL}/products/calmcarry`;

/** OS subscription management (honest billing: one-tap cancel routes here). Must be
 *  store-correct per platform - an Apple URL on Android is a Play-review + ROSCA fail. */
export const SUBSCRIPTION_URL =
  Platform.OS === 'android'
    ? 'https://play.google.com/store/account/subscriptions'
    : 'https://apps.apple.com/account/subscriptions';

/** Support / legal pages.
 *  PRIVACY_URL is the app-specific policy, self-hosted on our own API domain (served
 *  by the NestJS LegalController at GET /legal/privacy) so it is a URL we control and
 *  does not depend on the Shopify storefront. It is intentionally the PROD URL in every
 *  build profile - the privacy policy must always resolve to the real published doc,
 *  never localhost. Canonical source: docs/legal/privacy-policy.public.html.
 *  TERMS_URL is Apple's STANDARD EULA (guideline 3.1.2): the app uses the standard
 *  License Agreement in App Store Connect, and the standard EULA is what actually
 *  covers an auto-renewable subscription (auto-renewal, cancellation, billing via the
 *  Apple ID). The previous target - the Shopify storefront's terms - governs PHYSICAL
 *  goods only and does not contain subscription terms, so a point-of-sale "Terms" link
 *  to it reads as a non-conforming EULA to a strict reviewer. SUPPORT_URL
 *  is unverified (the contact page returned a transient 5xx) - confirm it returns 200
 *  before submission. */
export const SUPPORT_URL = `${STORE_URL}/pages/contact`;
export const PRIVACY_URL = 'https://calmcarry-api-production.up.railway.app/legal/privacy';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export const DEVICE_NAME = 'CalmCarry Glow Orb';

/**
 * Premium subscription pricing (locked decision: subscription only, via Apple/
 * Google IAP, annual-leading). The ANNUAL plan opens with a short intro free trial
 * (TRIAL_DAYS) - see below. Shown in-app - that's the compliant path for digital
 * subscriptions (IAP), unlike the physical device (external).
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

/** Honest intro offer: the ANNUAL plan opens with a short free trial. The store
 *  (App Store Connect / Play) must carry the matching intro offer; the client just
 *  presents it and - unlike BetterSleep - schedules its OWN pre-charge reminder so a
 *  user is never surprise-charged when the trial ends (see lib/reminders.ts). */
export const TRIAL_DAYS = 3;

/** Why it's worth having more than one. */
export const DEVICE_BENEFITS = [
  'Ready the moment you hold it. No app, no setup, nothing to charge',
  'One for every bedside: partner, guest room, or each child',
  'Sold only by The Glow Company and covered by a 24-month warranty',
] as const;

export type PurchaseReason = 'extra' | 'replacement';

/** Open the web store / checkout. Optionally tag the reason so analytics (and a
 *  future deep-linked product page) can tell an extra from a replacement. */
export function openCheckout(reason?: PurchaseReason) {
  const url = reason ? `${DEVICE_CHECKOUT_URL}?ref=app-${reason}` : DEVICE_CHECKOUT_URL;
  // never fail silently - if the browser can't open, tell the user where to go
  return Linking.openURL(url).catch(() =>
    Alert.alert('Couldn’t open the store', 'Visit theglowcompany.co to get your Glow Orb.')
  );
}
