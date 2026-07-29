import { getJSON, remove, setJSON } from './store';

/**
 * COPPA verifiable-parental-consent record (build plan §13). Before any child
 * profile is created, a parent - already in the adult, parent-gated area of the
 * app - must give informed, affirmative consent to the minimal data collected
 * for a kid profile (just a first name, kept ON THIS DEVICE - never uploaded to
 * the server; ad-free; never sold; deletable any time). We record the consent
 * (timestamp + version) so it's auditable.
 *
 * NOTE: the FTC-approved verifiable method for production (e.g. a small payment
 * authorisation or signed form) is a launch decision for Glowco; this records
 * informed parental consent and gates collection behind it.
 */
const KEY = 'cc.coppaConsent';
const VERSION = 1;

export type ConsentRecord = { acceptedAt: number; version: number };

export async function hasCoppaConsent(): Promise<boolean> {
  const r = await getJSON<ConsentRecord | null>(KEY, null);
  return !!r && typeof r.version === 'number' && r.version >= VERSION;
}

export async function recordCoppaConsent(): Promise<void> {
  await setJSON(KEY, { acceptedAt: Date.now(), version: VERSION } satisfies ConsentRecord);
}

/** Consent is per-ACCOUNT, not per-device: clear it on sign-out / account switch so
 *  a second account can never inherit the first parent's consent and add a kid
 *  profile with no consent ever shown (COPPA). */
export async function clearCoppaConsent(): Promise<void> {
  await remove(KEY);
}
