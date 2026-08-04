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
