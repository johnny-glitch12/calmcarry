import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';
import { getJSON, setJSON } from './store';

/**
 * Opt-in remote push registration (build plan §12: gentle, opt-in, rare, never nag).
 *
 * The OS permission prompt is requested ONLY here, on an explicit user opt-in — never
 * on launch, never in kids mode. The achieved state is returned so the UI shows ON
 * only if a device token was actually registered (no phantom toggle). First-party
 * only: the Expo push token is sent solely to our own backend.
 */

/** Remote push is native-only; web (preview) is a no-op and the toggle is hidden. */
export const pushSupported = Platform.OS !== 'web';

const GRANT_KEY = 'cc.push'; // boolean: opted in AND a device token was registered

function platform(): 'ios' | 'android' | 'web' {
  return Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios';
}

/** EAS projectId is REQUIRED by getExpoPushTokenAsync on SDK 56. Read defensively. */
function projectId(): string | undefined {
  const extra = (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas
    ?.projectId;
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return extra || fromEas || undefined;
}

export async function hasPushOptIn(): Promise<boolean> {
  return getJSON<boolean>(GRANT_KEY, false);
}

/**
 * Enable/disable gentle remote reminders. Returns the state actually achieved
 * (true only if a device token was registered). Offline / permission-denied /
 * no-projectId all return false. Requires a signed-in backend account.
 */
export async function setPushOptIn(enabled: boolean, jwt: string | null): Promise<boolean> {
  if (!pushSupported) return false;
  if (!enabled) {
    await setJSON(GRANT_KEY, false);
    return false;
  }
  if (!jwt || jwt === 'local') return false; // registration needs a backend account
  // No EAS projectId → we can't mint an Expo push token. Bail BEFORE prompting, so
  // we never show an OS permission dialog that would lead nowhere.
  const id = projectId();
  if (!id) {
    await setJSON(GRANT_KEY, false);
    return false;
  }
  try {
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
    const { data: deviceToken } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.registerPush(jwt, { token: deviceToken, platform: platform() });
    await setJSON(GRANT_KEY, true);
    return true;
  } catch {
    await setJSON(GRANT_KEY, false);
    return false;
  }
}
