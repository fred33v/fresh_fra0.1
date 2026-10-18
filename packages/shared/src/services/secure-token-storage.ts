/**
 * Token storage that keeps login tokens in the device's secure store
 * (iOS Keychain / Android Keystore via expo-secure-store) and everything
 * else in ordinary storage (AsyncStorage).
 *
 * Tokens saved by older app versions in ordinary storage are moved to the
 * secure store the first time they are read.
 */

import type { TokenStorage } from './api.service';

/** The subset of expo-secure-store this needs, so the shared package does not depend on Expo. */
export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const SECURE_TOKEN_KEYS = ['accessToken', 'refreshToken'] as const;

export function createSecureTokenStorage(
  secureStore: SecureStoreLike,
  fallback: TokenStorage,
  secureKeys: readonly string[] = SECURE_TOKEN_KEYS,
): TokenStorage {
  const isSecure = (key: string) => secureKeys.includes(key);

  return {
    async getItem(key) {
      if (!isSecure(key)) return fallback.getItem(key);

      const value = await secureStore.getItemAsync(key);
      if (value !== null) return value;

      // One-time move of a token left in ordinary storage by an older version
      const legacy = await fallback.getItem(key);
      if (legacy !== null) {
        await secureStore.setItemAsync(key, legacy);
        await fallback.removeItem(key);
      }
      return legacy;
    },

    async setItem(key, value) {
      if (!isSecure(key)) return fallback.setItem(key, value);
      await secureStore.setItemAsync(key, value);
    },

    async removeItem(key) {
      if (!isSecure(key)) return fallback.removeItem(key);
      // Clear both, so no copy is left behind in ordinary storage
      await Promise.all([secureStore.deleteItemAsync(key), fallback.removeItem(key)]);
    },
  };
}
