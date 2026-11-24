import { hasPanelAccess } from '../lib/access';
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AuthContext } from './authStore';
import { authService } from '../services/authService';
import type { User } from '../types/user';
import type { LoginRequest } from '../types/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
    // O perfil só autentica o painel depois da validação no servidor.
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Um login/logout concorrente com a revalidação inicial não pode ser
    // sobrescrito pela resposta atrasada do /auth/me.
    const settledByUser = useRef(false);

    useEffect(() => {
        let active = true;

        authService
            .me()
            .then((freshUser) => {
                if (!active || settledByUser.current) return;
                if (hasPanelAccess(freshUser)) {
                    setUser(freshUser);
                    authService.cacheUser(freshUser);
                } else {
                    setUser(null);
                    authService.clearCachedUser();
                }
            })
            .catch(() => {
                // Cookie ausente, expirado ou conta sem acesso: derruba o cache.
                if (!active || settledByUser.current) return;
                setUser(null);
                authService.clearCachedUser();
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const login = useCallback(async (data: LoginRequest) => {
        const response = await authService.login(data);
        settledByUser.current = true;
        if (!hasPanelAccess(response.user)) {
            setUser(null);
            authService.clearCachedUser();
            throw new Error('Seu perfil deve acessar o aplicativo do morador.');
        }
        setUser(response.user);
        authService.cacheUser(response.user);
    }, []);

    const logout = useCallback(async () => {
        settledByUser.current = true;
        setUser(null);
        await authService.logout();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
