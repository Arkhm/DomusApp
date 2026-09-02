import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Persistência do token/sessão.
 *
 * Em iOS/Android usa `expo-secure-store` (Keychain / EncryptedSharedPreferences),
 * nunca AsyncStorage puro. O SecureStore não existe no target web, então lá
 * caímos para `localStorage` apenas para permitir rodar `npm run web` durante o
 * desenvolvimento — o alvo de entrega é o app nativo.
 */
const isWeb = Platform.OS === 'web';

function webStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  const candidate = (globalThis as { localStorage?: Storage }).localStorage;
  return candidate ?? null;
}

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      if (isWeb) return webStorage()?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      // Storage indisponível (device bloqueado, modo privado no browser…):
      // tratamos como "sem sessão" em vez de derrubar o app.
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (isWeb) {
        webStorage()?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silencioso de propósito: falhar em persistir não pode quebrar o login
      // da sessão corrente.
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (isWeb) {
        webStorage()?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // idem
    }
  },
};

export const STORAGE_KEYS = {
  token: 'domusapp.token',
  user: 'domusapp.user',
} as const;
