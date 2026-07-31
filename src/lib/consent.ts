import { getJSON, remove, setJSON } from './store';

/**
 * COPPA verifiable-parental-consent record (build plan §13). Before any child
 * profile is created, a parent - already in the adult, parent-gated area of the
 * app - must give informed, affirmative consent to the minimal data collected
 * for a kid profile (just a first name, kept ON THIS DEVICE - never uploaded to
 * the server; ad-free; never sold; deletable any time). We record the consent
 * (timestamp + version) so it's auditable.
 *
 * WHY THERE IS NO VERIFIABLE-CONSENT (VPC) FLOW HERE.
 * COPPA's consent duty is triggered by COLLECTING personal information FROM a child.
 * Kids mode does not transmit anything about a child to our servers: the first name
 * is device-local (ProfileProvider gates createProfile/updateProfile on an adult
 * type), nothing under features/kids/ touches the network, both logSession call
 * sites are gated on mode !== 'kids', analytics no-op in kids mode and crash
 * reporting is shut down. On the FTC's own reading (COPPA FAQ F.5; the 16 CFR 312.2
 * "collection" definition was left textually unchanged by the 2025 amendments),
 * information that stays on the device and is never transmitted is not collected -
 * so the duty does not attach and a VPC vendor is not warranted.
 *
 * That holds ONLY while the architecture holds, so it is pinned by
 * src/lib/__tests__/kidsPrivacy.test.ts, which fails the build on regression.
 *
 * OPEN, and counsel's call, not ours: nobody has yet captured a full kids session at
 * runtime. A background token refresh or update check during kids mode would send an
 * IP address, which is a persistent identifier under 312.2(7) and therefore passive
 * collection. If such traffic exists, the fallback is the 312.5(c)(7)
 * internal-operations exemption, which brings its own notice duty at 312.4(d)(3).
 * If real consent is ever required, the designated method is "email plus"
 * (312.5(b)(2)(viii)) - available only while we disclose nothing to third parties.
 * This module records informed parental consent and gates profile creation behind
 * it; it is deliberately NOT claimed to be verifiable consent.
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
