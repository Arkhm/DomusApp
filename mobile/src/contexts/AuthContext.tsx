import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onUnauthorized, toApiFailure, type ApiFailure } from '../services/api';
import { secureStorage, STORAGE_KEYS } from '../services/secureStorage';
import {
  fetchSessionProfile,
  login as loginRequest,
  withResolvedUnit,
} from '../services/authService';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  /** true enquanto restauramos a sessão salva no boot do app. */
  isRestoring: boolean;
  /** true durante uma tentativa de login. */
  isAuthenticating: boolean;
  signIn: (email: string, password: string) => Promise<ApiFailure | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseStoredUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const clearSession = useCallback(async () => {
    await Promise.all([
      secureStorage.remove(STORAGE_KEYS.token),
      secureStorage.remove(STORAGE_KEYS.user),
    ]);
    if (isMounted.current) setUser(null);
  }, []);

  // Restaura a sessão persistida. Se a API estiver fora, mantemos o usuário
  // salvo em vez de deslogar — quem derruba a sessão é um 401 explícito.
  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      const [token, storedUser] = await Promise.all([
        secureStorage.get(STORAGE_KEYS.token),
        secureStorage.get(STORAGE_KEYS.user),
      ]);

      const cached = parseStoredUser(storedUser);
      if (!token || !cached) {
        if (!cancelled) setIsRestoring(false);
        return;
      }

      try {
        await fetchSessionProfile();
        const enriched = await withResolvedUnit(cached);
        if (!cancelled) setUser(enriched);
      } catch (error) {
        const failure = toApiFailure(error, 'Falha ao restaurar a sessão.');
        if (failure.kind === 'credentials') {
          await clearSession();
        } else if (!cancelled) {
          setUser(cached);
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // Um 401 em qualquer requisição encerra a sessão.
  useEffect(() => onUnauthorized(() => void clearSession()), [clearSession]);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    setIsAuthenticating(true);
    try {
      const { user: loggedUser, token } = await loginRequest(email, password);

      await Promise.all([
        secureStorage.set(STORAGE_KEYS.token, token),
        secureStorage.set(STORAGE_KEYS.user, JSON.stringify(loggedUser)),
      ]);

      const enriched = await withResolvedUnit(loggedUser);
      if (isMounted.current) setUser(enriched);
      return null;
    } catch (error) {
      return toApiFailure(error, 'Não foi possível entrar. Tente novamente.');
    } finally {
      if (isMounted.current) setIsAuthenticating(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isRestoring, isAuthenticating, signIn, signOut }),
    [user, isRestoring, isAuthenticating, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }
  return context;
}
