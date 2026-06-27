import AsyncStorage from '@react-native-async-storage/async-storage';

/** Tiny typed AsyncStorage helpers for local persistence / offline fallback. */
export const KEYS = {
  token: 'cc.token',
  user: 'cc.user',
  entitlement: 'cc.entitlement',
  devices: 'cc.devices',
  claims: 'cc.claims',
  logs: 'cc.logs',
} as const;

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v != null ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export async function remove(...keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(keys);
  } catch {
    /* ignore */
  }
}

/** Wipe ALL local app data. Used on permanent account deletion so nothing personal
 *  (recents, mixes, profiles, consent, prefs) survives on the device. */
export async function clearAll(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch {
    /* ignore */
  }
}
