/**
 * Ship-time feature flags.
 *
 * These are deliberately compile-time constants, not remote config: a flag that
 * gates a STORE-COMPLIANCE obligation must have the same value in the binary Apple
 * reviews and on every device, with no way to flip it after review.
 */

/**
 * The adults-only community wins wall.
 *
 * OFF for v1. Turning it on makes CalmCarry a user-generated-content app under App
 * Store Review Guideline 1.2, which obliges FOUR things. Three exist:
 *   1. a filter for objectionable material  - HOLD_PATTERNS in community.service.ts
 *   2. a way to report content             - POST /community/report (identity-bound,
 *                                             deduped per reporter, rate-limited)
 *   4. a published way to contact us       - the support URL
 * The fourth does NOT exist:
 *   3. the ability to BLOCK abusive users  - there is no block or mute anywhere in
 *                                            the app. Apple rejects on this.
 *
 * The wall is empty today (the fabricated seed posts were removed long ago), so
 * shipping without it costs nothing, removes the 1.2 obligation entirely, and keeps
 * the age rating at 4+ instead of pushing it to 12+.
 *
 * TO TURN IT ON: build user blocking first, then flip this, then update the User
 * Generated Content answer and the age rating in App Store Connect - in that order.
 * See docs/APP_STORE_QUESTIONNAIRES.md.
 */
export const COMMUNITY_ENABLED = false;

/**
 * The in-app Glow Orb store (the /shop screen + every "buy the device" entry point,
 * including About's "Visit The Glow Company" row).
 *
 * OFF for v1 - App Store Review Guideline 1.4.1. The external storefront page these
 * surfaces open (theglowcompany.co/products/calmcarry) is currently headlined
 * "The Natural Solution to Anxiety & Insomnia" with an acupressure/PC8 mechanism
 * claim. Apple treats an app that routes users to unsubstantiated medical/disease
 * claims as making those claims itself - the app's own carefully non-medical copy
 * and rendered wellness disclaimers do not cure it, because the app is the referral
 * path. Device REGISTRATION, warranty, and replacement flows stay on; only the
 * outbound purchase funnel is gated.
 *
 * TO TURN IT ON: the storefront copy must first be softened to non-disease wellness
 * language (owner/Mason), then flip this in a 1.0.x release. Same rule as
 * COMMUNITY_ENABLED: a store-compliance flag ships as a compile-time constant so the
 * binary Apple reviews behaves identically everywhere, forever.
 */
export const DEVICE_SHOP_ENABLED = false;
