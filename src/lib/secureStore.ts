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
