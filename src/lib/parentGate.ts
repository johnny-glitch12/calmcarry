import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

import { secureDelete, secureGet, secureSet } from './secureStore';

/**
 * Parent gate (build plan §13 + §9 - non-negotiable child safety). Required to
 * leave a child profile OR reach any adult area (community, settings, billing,
 * store). The plan models it as "PIN hash OR biometric flag" - so we support
 * BOTH: a salted SHA-256 PIN (expo-crypto) stored in the Keychain/Keystore
 * (expo-secure-store), and device biometrics (Face ID / Touch ID via
 * expo-local-authentication) where available.
 *
 * Threat model: a curious CHILD with the device. The hash is non-reversible
 * (a kid reading storage can't recover the PIN) and salted; a 5-try lockout
 * stops brute-forcing all 10,000 PINs. On web (preview only) SecureStore falls
 * back to AsyncStorage and biometrics are unavailable → PIN only.
 */
const KEY = 'cc.parentPin';
const MAX_FAILS = 5;
const LOCK_MS = 60_000; // 1-minute cooldown after MAX_FAILS wrong tries

type PinRecord = { hash: string; salt: string; fails: number; lockedUntil: number };

function isRecord(v: unknown): v is PinRecord {
  return (
    !!v &&
    typeof (v as PinRecord).hash === 'string' &&
    typeof (v as PinRecord).salt === 'string'
  );
}

async function readRecord(): Promise<PinRecord | null> {
  const raw = await secureGet(KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return isRecord(v) ? v : null;
  } catch {
    return null;
  }
}

async function writeRecord(rec: PinRecord): Promise<void> {
  await secureSet(KEY, JSON.stringify(rec));
}

async function makeSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Salted, non-reversible SHA-256 (expo-crypto: native + web on secure origins).
function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}|${pin}`);
}

export async function hasParentPin(): Promise<boolean> {
  return (await readRecord()) !== null;
}

export async function setParentPin(pin: string): Promise<void> {
  const salt = await makeSalt();
  const hash = await hashPin(pin, salt);
  await writeRecord({ hash, salt, fails: 0, lockedUntil: 0 });
}

/** Remove the PIN record entirely. The Keychain outlives BOTH app uninstall and
 *  AsyncStorage.clear(), so "delete account" must call this explicitly - otherwise
 *  the previous household's PIN gates the next account on this device forever. */
export async function clearParentPin(): Promise<void> {
  await secureDelete(KEY);
}

/** Seconds remaining on a lockout (0 if not locked). */
export async function parentPinLockSeconds(): Promise<number> {
  const rec = await readRecord();
  if (!rec) return 0;
  const remaining = rec.lockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export interface PinCheckResult {
  ok: boolean;
  /** >0 when the gate is locked and the caller should make the user wait */
  lockedSeconds: number;
}

export async function checkParentPin(pin: string): Promise<PinCheckResult> {
  const rec = await readRecord();
  if (!rec) return { ok: false, lockedSeconds: 0 };

  const now = Date.now();
  if (rec.lockedUntil > now) {
    return { ok: false, lockedSeconds: Math.ceil((rec.lockedUntil - now) / 1000) };
  }

  if ((await hashPin(pin, rec.salt)) === rec.hash) {
    await writeRecord({ ...rec, fails: 0, lockedUntil: 0 });
    return { ok: true, lockedSeconds: 0 };
  }

  const fails = rec.fails + 1;
  if (fails >= MAX_FAILS) {
    await writeRecord({ ...rec, fails: 0, lockedUntil: now + LOCK_MS });
    return { ok: false, lockedSeconds: Math.ceil(LOCK_MS / 1000) };
  }
  await writeRecord({ ...rec, fails });
  return { ok: false, lockedSeconds: 0 };
}

/**
 * Short-lived "a grown-up just passed the gate" window (in-memory, session only).
 * Lets the gate be a single chokepoint for purchases & account deletion without
 * re-prompting on the very next tap or a navigation round-trip. Resets on app
 * restart by design - it never weakens the persistent PIN, only avoids nagging
 * an adult who authenticated seconds ago.
 */
const VERIFY_WINDOW_MS = 3 * 60_000;
// INTENT-SCOPED: a pass for one action (e.g. exiting Kids mode) must NOT authorize a
// different, higher-consequence action (purchase / account deletion). Only set this
// after a real EXISTING-PIN entry - never on PIN *creation* (see ParentGate).
let lastVerified: { intent: string; at: number } | null = null;
export function markParentVerified(intent: string): void {
  lastVerified = { intent, at: Date.now() };
}
export function parentRecentlyVerified(intent: string, windowMs: number = VERIFY_WINDOW_MS): boolean {
  return !!lastVerified && lastVerified.intent === intent && Date.now() - lastVerified.at < windowMs;
}

/** Whether device biometrics (Face ID / Touch ID) can be used as the gate. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Prompt for Face ID / Touch ID. Resolves true only on a successful scan. */
export async function authenticateBiometric(promptMessage: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage,
      // BIOMETRICS ONLY. Without disableDeviceFallback, iOS uses
      // LAPolicyDeviceOwnerAuthentication, which offers the DEVICE PASSCODE when a
      // face or fingerprint fails - so the parent gate was satisfied by the same code
      // that unlocks the phone. On a family iPad, or any phone whose passcode a child
      // has watched being typed, that is not a gate at all. It defeated the entire
      // point on the one surface where the child is the adversary.
      disableDeviceFallback: true,
      // no OS fallback button either; our own PIN keypad is the fallback and it is
      // already on screen behind this prompt.
      fallbackLabel: '',
    });
    return r.success === true;
  } catch {
    return false;
  }
}
