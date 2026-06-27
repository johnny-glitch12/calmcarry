import { type AudioSource } from 'expo-audio';
import { Platform } from 'react-native';

import { audioSources } from '@/content/audio';
import { type Track } from '@/content/library';
import { api } from './api';

/**
 * Resolve the AudioSource to play for a track (build plan §11 — CMS/CDN delivery).
 *
 * Streams from the backend's signed CDN URL when one is available AND reachable,
 * otherwise falls back to the BUNDLED asset. The bundled require() asset is the
 * guaranteed-present fallback so offline / CDN-down nights still play — all-night
 * reliability (§12) must never depend on the network.
 *
 * Resolve happens BEFORE the first play() and the result is cached per track for
 * the session, so there is never a mid-night source swap.
 */

// session-scoped memo — cleared only on cold start or sign-out (clearAudioSourceCache)
const cache = new Map<string, AudioSource>();

function bundled(track: Track): AudioSource {
  return audioSources[track.audio]; // numeric assetId — always present, offline-safe
}

// Only an ABSOLUTE http(s) URL flagged signed:true is streamable. The dev backend
// (no CDN keys) returns a relative, unsigned path which is NOT playable → fall back.
function usableRemote(r: { url: string; signed: boolean }): boolean {
  return r.signed === true && /^https?:\/\//i.test(r.url);
}

export async function resolveAudioSource(track: Track, token: string | null): Promise<AudioSource> {
  // Web is preview-only and the CDN may not send CORS headers — keep web on the
  // bundled asset (the original no-CORS design) so preview playback never breaks.
  if (Platform.OS === 'web') return bundled(track);

  const cached = cache.get(track.id);
  if (cached !== undefined) return cached;

  // the signed-url endpoint is JWT-guarded; an anonymous/offline session would 401.
  // Don't cache this fallback — a later signed-in attempt may upgrade to streaming.
  if (!token || token === 'local') return bundled(track);

  try {
    const r = await api.signedUrl(token, track.id);
    if (usableRemote(r)) {
      const remote: AudioSource = { uri: r.url };
      cache.set(track.id, remote);
      return remote;
    }
  } catch {
    /* offline / 401 / 403 (locked + not premium) / 404 / 503 → bundled */
  }
  return bundled(track); // do NOT cache the fallback
}

/** Drop the session memo (e.g. on sign-out) so a new account re-resolves cleanly. */
export function clearAudioSourceCache(): void {
  cache.clear();
}
