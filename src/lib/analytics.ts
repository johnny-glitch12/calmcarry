import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';

import { api } from './api';
import { secureGet, secureSet } from './secureStore';
import { getJSON, remove, setJSON } from './store';

/**
 * First-party, anonymous analytics for the build-plan §15 funnel
 * (install → sign-in → first completed session → conversion → retention → churn).
 *
 * Rules enforced HERE, never at call sites:
 *  - KIDS ARE NEVER TRACKED (COPPA): track() no-ops while a child profile is active.
 *    ProfileProvider publishes the active mode via setAnalyticsMode().
 *  - FIRST-PARTY + ANONYMOUS: keyed by a per-install random id in secure storage
 *    (no PII, no account id). No third-party SDK.
 *  - NEVER PII / MEDICAL / MOOD: props pass a strict ALLOW-LIST; anything else is
 *    dropped before it can leave the device.
 *  - OFFLINE-SAFE + BATCHED: events buffer in memory and flush in small batches on a
 *    timer, on app-background, or when the buffer fills — so an all-night session
 *    never spams the network. Unsent events are persisted only when a flush fails,
 *    and recovered on next launch.
 *  - track() never throws and never blocks the UI.
 */

/** The canonical funnel events (§15). track() also accepts a plain string. */
export type Ev =
  | 'app_open'
  | 'sign_up'
  | 'sign_in'
  | 'check_in_shown'
  | 'session_start'
  | 'session_complete'
  | 'paywall_view'
  | 'subscribe_success'
  | 'subscription_manage_open'
  | 'time_to_first_audio';

// ---- anonymous install id: secure-store, migrating any legacy AsyncStorage id ----
const ANON_KEY = 'cc.anonId'; // SecureStore-safe charset
let anonIdCache: string | null = null;
async function anonId(): Promise<string> {
  if (anonIdCache) return anonIdCache;
  let id = await secureGet(ANON_KEY);
  if (!id) {
    const legacy = await getJSON<string | null>(ANON_KEY, null); // previous (AsyncStorage) location
    id = legacy ?? Crypto.randomUUID();
    await secureSet(ANON_KEY, id);
  }
  anonIdCache = id;
  return id;
}

// ---- kids exclusion: ProfileProvider publishes the active mode ----
let kidsActive = false;
export function setAnalyticsMode(mode: 'adult' | 'kids'): void {
  kidsActive = mode === 'kids';
}

// ---- time-to-first-audio: THE app health metric (pre-mortem: the app's whole job
// is unlock -> audio playing in seconds; this measures it honestly). LAUNCH_AT is
// bundle-eval time, a fair approximation of JS cold start. Fires at most once per
// cold start, from the first surface that actually starts audio (Player/wind-down).
// Kids exclusion is automatic: track() no-ops while a kid profile is active. ----
const LAUNCH_AT = Date.now();
let firstAudioFired = false;
export function markFirstAudio(): void {
  if (firstAudioFired) return;
  firstAudioFired = true;
  track('time_to_first_audio', { durationSec: Math.round((Date.now() - LAUNCH_AT) / 1000) });
}

// ---- prop allow-list: ONLY these keys ever leave the device ----
const ALLOWED_PROP_KEYS = new Set([
  'method', // 'apple' | 'google'
  'plan', // 'monthly' | 'annual'
  'contentId', // catalog id (never user content)
  'category', // track category
  'first', // first-ever completed session (boolean)
  'durationSec', // number
  'completed', // boolean
  'reason', // store cancellation bucket (server only)
]);
function scrub(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    if (!ALLOWED_PROP_KEYS.has(k)) continue;
    const v = props[k];
    if (typeof v === 'string') out[k] = v.slice(0, 64);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

// ---- batching queue ----
type Queued = { name: string; props?: Record<string, unknown>; at: string };
const BUF_KEY = 'cc.analyticsQueue';
const MAX_BUFFER = 50; // hard cap (matches the server batch limit) so it can't grow unbounded
const FLUSH_AT = 10; // flush once this many events are buffered…
const FLUSH_MS = 15_000; // …or on this cadence
let buf: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let flushing = false; // single-flight guard so concurrent flush() calls never double-send a batch

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_MS);
}

export async function flush(): Promise<void> {
  if (flushing) return; // a flush is already in-flight — never send the same batch twice
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!buf.length) return;
  // claim the in-flight slot synchronously, BEFORE the first await, so a concurrent
  // track()-triggered flush() bails at the guard above
  flushing = true;
  const batch = buf.slice(0, MAX_BUFFER);
  try {
    const id = await anonId();
    await api.trackEvents(id, batch);
    buf = buf.slice(batch.length);
    if (buf.length) schedule();
    else await remove(BUF_KEY);
  } catch {
    // offline / rejected — keep the buffer for the next attempt
    await setJSON(BUF_KEY, buf.slice(-MAX_BUFFER));
    schedule();
  } finally {
    flushing = false;
  }
}

/** Boot the queue once: recover any unsent events, attach a background-flush hook. */
export function startAnalytics(): void {
  if (started) return;
  started = true;
  getJSON<Queued[]>(BUF_KEY, [])
    .then((saved) => {
      if (Array.isArray(saved) && saved.length) buf = saved.concat(buf);
      if (buf.length) flush();
    })
    .catch(() => {});
  AppState.addEventListener('change', (s) => {
    if (s !== 'active') flush();
  });
}

/**
 * Record a funnel event. Signature unchanged so existing call sites compile as-is.
 * No-ops in kids mode. Fire-and-forget.
 */
export async function track(name: Ev | string, props?: Record<string, unknown>): Promise<void> {
  try {
    if (kidsActive) return; // COPPA: never track a child profile
    buf.push({ name: String(name).slice(0, 60), props: scrub(props), at: new Date().toISOString() });
    if (buf.length > MAX_BUFFER) buf = buf.slice(-MAX_BUFFER);
    if (buf.length >= FLUSH_AT) flush();
    else schedule();
  } catch {
    /* analytics must never affect the app */
  }
}
