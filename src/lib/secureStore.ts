import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Secure key/value storage for sensitive secrets (the auth token, the parent PIN
 * record). On iOS/Android these live in the Keychain / Keystore via
 * expo-secure-store. SecureStore has NO web support (Expo SDK 56), so on web -
 * which is preview-only; the product is native - we fall back to AsyncStorage
 * (localStorage). SecureStore keys may contain only [A-Za-z0-9._-].
 */
const useSecure = Platform.OS !== 'web';

export async function secureGet(key: string): Promise<string | null> {
  try {
    if (useSecure) return await SecureStore.getItemAsync(key);
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Like secureGet, but distinguishes "the key is absent" (returns null) from "the read
 * FAILED" (throws). secureGet collapses both to null, which is fine for a cache but
 * dangerous for a security decision: a swallowed Keychain error made hasParentPin()
 * report "no PIN set", and every gate that guards on it - exit Kids Mode, delete
 * account, remove a profile, purchase - then treated the household as ungated. A
 * caller that must fail CLOSED needs to see the error rather than a soft null.
 */
export async function secureGetStrict(key: string): Promise<string | null> {
  if (useSecure) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (useSecure) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch {
    /* ignore - best effort */
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    if (useSecure) await SecureStore.deleteItemAsync(key);
    else await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
