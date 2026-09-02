import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AuthContext } from './authStore';
import { authService } from '../services/authService';
import type { User } from '../types/user';
import type { LoginRequest } from '../types/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
    // O token virou cookie httpOnly — invisível para o JS. O que sobra no
    // browser é um cache do perfil, lido uma única vez no primeiro render para
    // o gate do `ProtectedLayout` já avaliar a sessão certa no primeiro frame.
    // É um palpite otimista: quem dá a palavra final é o `/auth/me`.
    const [user, setUser] = useState<User | null>(() => authService.getCachedUser());

    // Com cache, renderiza otimista e revalida em background. Sem cache não dá
    // para saber se existe cookie (é httpOnly), então espera o /auth/me
    // responder antes de decidir entre painel e login.
    const [isLoading, setIsLoading] = useState<boolean>(() => authService.getCachedUser() === null);

    // Um login/logout concorrente com a revalidação inicial não pode ser
    // sobrescrito pela resposta atrasada do /auth/me.
    const settledByUser = useRef(false);

    useEffect(() => {
        let active = true;

        authService
            .me()
            .then((freshUser) => {
                if (!active || settledByUser.current) return;
                setUser(freshUser);
                authService.cacheUser(freshUser);
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
