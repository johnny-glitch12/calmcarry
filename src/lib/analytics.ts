import * as Crypto from 'expo-crypto';

import { api } from './api';
import { getJSON, setJSON } from './store';

/**
 * First-party, anonymous analytics for the build-plan §15 funnel
 * (install → sign-in → first session → conversion → retention → churn).
 * Keyed by a per-install anon id (no PII). Fire-and-forget — never throws, never
 * blocks the UI, silently no-ops if the backend is unreachable.
 */
let anonIdCache: string | null = null;

async function anonId(): Promise<string> {
  if (anonIdCache) return anonIdCache;
  let id = await getJSON<string | null>('cc.anonId', null);
  if (!id) {
    id = Crypto.randomUUID();
    await setJSON('cc.anonId', id);
  }
  anonIdCache = id;
  return id;
}

export async function track(name: string, props?: Record<string, unknown>): Promise<void> {
  try {
    const id = await anonId();
    api.trackEvent(name, id, props).catch(() => {});
  } catch {
    /* never let analytics affect the app */
  }
}
