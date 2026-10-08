import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { secureStorage, STORAGE_KEYS } from './secureStorage';

/** Lê `extra.apiUrl` definido em `app.config.ts`. */
function resolveBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return extra?.apiUrl ?? 'http://localhost:3333';
}

export const API_BASE_URL = resolveBaseUrl();
export const usesCookieSession = Platform.OS === 'web';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: usesCookieSession,
  headers: { 'Content-Type': 'application/json' },
});

// Anexa o JWT em toda requisição autenticada.
api.interceptors.request.use(async (config) => {
  if (usesCookieSession) return config;
  const token = await secureStorage.get(STORAGE_KEYS.token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Ouvintes de sessão expirada. O AuthContext se registra aqui para derrubar a
 * sessão quando a API responder 401 — evita que o serviço importe o contexto.
 */
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

type RetriableRequest = InternalAxiosRequestConfig & { _retried?: boolean };
let refreshing: Promise<void> | null = null;
const sessionEndpoints = ['/auth/login', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 401) {
      const request = error.config as RetriableRequest | undefined;
      if (sessionEndpoints.includes(request?.url ?? '')) return Promise.reject(error);
      if (usesCookieSession && request && !request._retried) {
        request._retried = true;
        try {
          refreshing ??= api.post('/auth/refresh').then(() => undefined).finally(() => {
            refreshing = null;
          });
          await refreshing;
          return api(request);
        } catch (refreshError) {
          // Uma falha de rede não invalida a sessão salva.
          if (!isAxiosError(refreshError) || refreshError.response?.status !== 401) {
            return Promise.reject(refreshError);
          }
        }
      }
      unauthorizedListeners.forEach((listener) => listener());
    }
    return Promise.reject(error);
  },
);

function isAxiosError(error: unknown): error is AxiosError<{ error?: string }> {
  return axios.isAxiosError(error);
}

/** Categorias de falha que a UI precisa distinguir. */
export type ApiFailureKind = 'credentials' | 'forbidden' | 'network' | 'server' | 'unknown';

export interface ApiFailure {
  kind: ApiFailureKind;
  message: string;
}

/**
 * Traduz qualquer erro de requisição em algo exibível.
 *
 * A API responde sempre `{ error: string }` com mensagens já em português
 * (ver `api/src/controllers/*`), então preferimos essa mensagem quando existe.
 */
export function toApiFailure(error: unknown, fallback: string): ApiFailure {
  if (!isAxiosError(error)) {
    return { kind: 'unknown', message: fallback };
  }

  if (error.code === 'ECONNABORTED' || error.message === 'Network Error' || !error.response) {
    return {
      kind: 'network',
      message: 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.',
    };
  }

  const apiMessage = error.response.data?.error;
  const status = error.response.status;

  if (status === 401) {
    return { kind: 'credentials', message: apiMessage ?? 'Credenciais inválidas.' };
  }
  if (status === 403) {
    return { kind: 'forbidden', message: apiMessage ?? 'Você não tem acesso a este recurso.' };
  }
  if (status >= 500) {
    return { kind: 'server', message: apiMessage ?? 'O servidor falhou. Tente novamente em instantes.' };
  }

  return { kind: 'unknown', message: apiMessage ?? fallback };
}
