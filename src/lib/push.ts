import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';
import { ensureAndroidChannel } from './reminders';
import { getJSON, setJSON } from './store';

/**
 * Opt-in remote push registration (build plan §12: gentle, opt-in, rare, never nag).
 *
 * The OS permission prompt is requested ONLY here, on an explicit user opt-in - never
 * on launch, never in kids mode. The achieved state is returned so the UI shows ON
 * only if a device token was actually registered (no phantom toggle). First-party
 * only: the token is sent solely to our own backend.
 *
 * NOTE deliberately the RAW device push token (getDevicePushTokenAsync: the hex APNs
 * token on iOS, the FCM registration token on Android) - NOT an Expo push token. The
 * server (push.service.ts) sends directly to APNs/FCM with its own credentials, and
 * those transports reject Expo-format tokens. An Expo token was previously registered
 * here, which would have made every remote push bounce at the transport.
 */

/** Remote push is native-only; web (preview) is a no-op and the toggle is hidden. */
export const pushSupported = Platform.OS !== 'web';

const GRANT_KEY = 'cc.push'; // boolean: opted in AND a device token was registered

function platform(): 'ios' | 'android' | 'web' {
  return Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios';
}

async function deviceToken(): Promise<string> {
  const { data } = await Notifications.getDevicePushTokenAsync();
  return String(data);
}

export async function hasPushOptIn(): Promise<boolean> {
  return getJSON<boolean>(GRANT_KEY, false);
}

/**
 * Enable/disable gentle remote reminders. Returns the state actually achieved
 * (true only if a device token was registered). Offline / permission-denied all
 * return false. Requires a signed-in backend account.
 */
export async function setPushOptIn(enabled: boolean, jwt: string | null): Promise<boolean> {
  if (!pushSupported) return false;
  if (!enabled) {
    // opt-OUT must reach the server too - a locally-flipped flag with the token
    // still enabled server-side means pushes keep arriving (phantom toggle).
    await setJSON(GRANT_KEY, false);
    if (jwt && jwt !== 'local') {
      try {
        await api.unregisterPush(jwt, await deviceToken());
      } catch {
        /* best-effort - the local flag is already off */
      }
    }
    return false;
  }
  if (!jwt || jwt === 'local') return false; // registration needs a backend account
  try {
    // server FCM pushes target the quiet 'reminders-v2' channel by id - make sure it
    // exists even for users who never touched the local-reminder toggles
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    let granted = current.status === 'granted';
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.status === 'granted';
    }
    if (!granted) {
      await setJSON(GRANT_KEY, false);
      return false;
    }
    await api.registerPush(jwt, { token: await deviceToken(), platform: platform() });
    await setJSON(GRANT_KEY, true);
    return true;
  } catch {
    await setJSON(GRANT_KEY, false);
    return false;
  }
}
