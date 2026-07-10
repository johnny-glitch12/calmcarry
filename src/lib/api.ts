/**
 * Thin client for the CalmCarry NestJS API (server/, port 4000).
 * Every call has a short timeout and throws on any failure so callers can fall
 * back to local/offline behaviour — the app must stay usable if the backend is
 * not running.
 */
import { Platform } from 'react-native';

// Configurable via EXPO_PUBLIC_API_BASE (set to the deployed https URL for native
// builds). Defaults to the local API for the web/dev target.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:4000';

const TIMEOUT_MS = 8000; // was 3500 — too aggressive on real cellular; the server keeps running after the client aborts
const MONEY_TIMEOUT_MS = 20000; // receipt validation round-trips to Apple/Google server-side, so give it real headroom

/** A failed HTTP response (has .status). Network/timeout errors are plain Errors
 *  (no .status) so callers can tell "rejected by server" from "couldn't reach server". */
export class ApiError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
    this.name = 'ApiError';
  }
}

async function req<T>(path: string, opts: RequestInit = {}, token?: string | null, timeoutMs: number = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
    if (!res.ok) throw new ApiError(res.status);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export type ApiUser = { id?: string; email: string; name: string; emailVerified?: boolean };
export type ApiEntitlement = {
  tier: 'free' | 'calm_plan';
  status: 'active' | 'revoked';
  // ISO expiry of a calm_plan. Enforced client-side so a cached premium self-expires
  // even offline (can't buy one month, go offline, and keep premium forever). Absent =
  // no expiry (e.g. the dev/preview comp session).
  expiresAt?: string | null;
};

export const api = {
  base: API_BASE,
  platformNote: Platform.OS,
  health: () => req<{ ok: boolean }>('/health'),
  login: (email: string, password: string) =>
    req<{ token: string; refreshToken?: string; user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name: string) =>
    req<{ token: string; refreshToken?: string; user: ApiUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  // Sign in with Apple / Google — backend verifies the identity token (§6/§8)
  social: (provider: 'apple' | 'google', idToken: string, authorizationCode?: string) =>
    req<{ token: string; refreshToken?: string; user: ApiUser }>('/auth/social', {
      method: 'POST',
      body: JSON.stringify({ provider, idToken, authorizationCode }),
    }),
  // Password reset (emailed 6-digit code; server never reveals whether an email exists)
  forgotPassword: (email: string) =>
    req<{ ok: boolean }>('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    req<{ token: string; refreshToken?: string; user: ApiUser }>('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    }),
  // Change password while signed in (server revokes every other session)
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    req<{ token: string; refreshToken?: string; user: ApiUser }>('/auth/password/change', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, token),
  // Rotating session refresh + server-side logout (revokes the refresh token)
  refresh: (refreshToken: string) =>
    req<{ token: string; refreshToken?: string; user: ApiUser }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  logout: (refreshToken: string) =>
    req<{ ok: boolean }>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  // Email verification (soft gate)
  sendEmailVerification: (token: string) =>
    req<{ ok: boolean }>('/auth/email/send-verification', { method: 'POST' }, token),
  verifyEmail: (token: string, code: string) =>
    req<{ ok: boolean; emailVerified: boolean }>('/auth/email/verify', { method: 'POST', body: JSON.stringify({ code }) }, token),
  // App Store UGC 1.2 — report an objectionable community post
  communityReport: (token: string, postId: string) =>
    req<{ ok: boolean }>('/community/report', { method: 'POST', body: JSON.stringify({ postId }) }, token),
  me: (token: string) => req<{ user: ApiUser; entitlement: ApiEntitlement }>('/me', {}, token),
  // permanent account + data deletion (Apple 5.1.1(v) / COPPA / GDPR)
  deleteAccount: (token: string) => req<{ ok: boolean; deleted: boolean }>('/me', { method: 'DELETE' }, token),
  // GDPR/UK-GDPR/AU-APP12 data-access export (the caller's own data as JSON)
  exportMe: (token: string) => req<Record<string, unknown>>('/me/export', {}, token),
  // cross-device preference sync — allow-listed keys only; feeling is NEVER synced
  getPrefs: (token: string) => req<Record<string, unknown>>('/me/prefs', {}, token),
  putPrefs: (token: string, prefs: Record<string, unknown>) =>
    req<Record<string, unknown>>('/me/prefs', { method: 'PUT', body: JSON.stringify(prefs) }, token),
  content: () => req<{ tracks: unknown[]; programs: unknown[]; newThisMonth?: string[] }>('/content'),
  devices: (token: string) => req<unknown[]>('/devices', {}, token),
  registerDevice: (token: string, data: { serial: string; purchaseDate?: string; retailer?: string }) =>
    req<unknown>('/devices', { method: 'POST', body: JSON.stringify(data) }, token),
  createClaim: (token: string, deviceId: string, data: { type: string; description: string }) =>
    req<{ reference: string }>(`/devices/${deviceId}/claims`, { method: 'POST', body: JSON.stringify(data) }, token),
  log: (token: string, data: { contentId?: string; deviceId?: string }) =>
    req<unknown>('/logs', { method: 'POST', body: JSON.stringify(data) }, token),

  // ---- subscription / IAP ----
  billingValidate: (token: string, data: { store: 'apple' | 'google'; receipt: string; productId?: string }) =>
    req<{ tier: string; isPremium: boolean; plan: string | null; expiresAt: string | null }>(
      '/billing/validate',
      { method: 'POST', body: JSON.stringify(data) },
      token,
      MONEY_TIMEOUT_MS,
    ),
  billingStatus: (token: string) =>
    req<{
      tier: string;
      isPremium: boolean;
      plan?: string | null;
      source?: string | null;
      expiresAt?: string | null;
      status?: string;
    }>('/billing/status', {}, token),

  // ---- household profiles ----
  profiles: (token: string) =>
    req<{ id: string; name: string; type: 'adult' | 'kids'; isPrimary: boolean }[]>('/profiles', {}, token),
  createProfile: (token: string, data: { name: string; type: 'adult' | 'kids'; ageBand?: string }) =>
    req<unknown>('/profiles', { method: 'POST', body: JSON.stringify(data) }, token),
  updateProfile: (token: string, id: string, data: { name?: string; ageBand?: string }) =>
    req<unknown>(`/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),
  deleteProfile: (token: string, id: string) =>
    req<unknown>(`/profiles/${id}`, { method: 'DELETE' }, token),

  // ---- community wins wall (+ optional anonymous shared sound-machine mix) ----
  communityPosts: (token: string) =>
    req<{
      presence: number;
      posts: {
        id: string;
        handle: string;
        text: string;
        mix?: { name: string; levels: Record<string, number> } | null;
        createdAt: string;
      }[];
    }>('/community/posts', {}, token),
  createPost: (token: string, text: string, mix?: { name: string; levels: Record<string, number> }) =>
    req<{ id: string; handle: string; text: string; status: string }>(
      '/community/posts',
      { method: 'POST', body: JSON.stringify({ text, mix }) },
      token,
    ),

  // ---- ephemeral check-in recommendation ----
  recommend: (intent: string, profileType?: string) =>
    req<{ contentId: string }>('/checkin/recommend', {
      method: 'POST',
      body: JSON.stringify({ intent, profileType }),
    }),

  // ---- ownership (Shopify) — matches ONLY the signed-in account's own email
  //      (the server ignores any client-supplied address) ----
  ownershipMatch: (token: string) =>
    req<{ verifiedOwner: boolean; ownsBundle: boolean; orderId: string | null }>(
      '/ownership/match',
      { method: 'POST', body: JSON.stringify({}) },
      token,
    ),

  // ---- push reminders ----
  registerPush: (token: string, data: { token: string; platform: 'ios' | 'android' | 'web' }) =>
    req<{ ok: boolean }>('/notifications/register', { method: 'POST', body: JSON.stringify(data) }, token),
  // opt-out parity: disable this device's token server-side (no more pushes to it)
  unregisterPush: (token: string, deviceToken: string) =>
    req<{ ok: boolean }>('/notifications/unregister', { method: 'POST', body: JSON.stringify({ token: deviceToken }) }, token),

  // ---- signed CDN url for an item's audio ----
  signedUrl: (token: string, id: string) =>
    req<{ url: string; expiresAt: number | null; signed: boolean }>(`/content/${id}/signed-url`, {}, token),

  // ---- shared caregivers (one household, whole family) ----
  caregivers: (token: string) =>
    req<{ caregivers: { id: string; name: string; email: string }[]; memberOf: { householdOwnerId: string; name: string } | null }>(
      '/caregivers',
      {},
      token,
    ),
  inviteCaregiver: (token: string) =>
    req<{ code: string; expiresAt: string }>('/caregivers/invite', { method: 'POST' }, token),
  redeemCaregiver: (token: string, code: string) =>
    req<{ ok: boolean }>('/caregivers/redeem', { method: 'POST', body: JSON.stringify({ code }) }, token),
  removeCaregiver: (token: string, id: string) =>
    req<{ ok: boolean }>(`/caregivers/${id}`, { method: 'DELETE' }, token),

  // ---- first-party analytics (anonymous funnel events, §15) ----
  trackEvent: (name: string, anonId: string, props?: Record<string, unknown>) =>
    req<{ ok: boolean }>('/events', { method: 'POST', body: JSON.stringify({ name, anonId, props }) }),
  // batched intake — the client buffers events and flushes a small batch at a time
  trackEvents: (
    anonId: string,
    events: { name: string; props?: Record<string, unknown>; at: string }[],
  ) =>
    req<{ ok: boolean; accepted: number }>('/events/batch', {
      method: 'POST',
      body: JSON.stringify({ anonId, events }),
    }),
};
