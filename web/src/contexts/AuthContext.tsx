import { useState, useCallback, type ReactNode } from 'react';
import { AuthContext } from './authStore';
import { authService } from '../services/authService';
import type { User } from '../types/user';
import type { LoginRequest } from '../types/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
    // Lazy initializer: lê localStorage **uma vez** durante o primeiro render,
    // sem disparar setState dentro de useEffect (que o React 19 marca como
    // cascading render). Resultado: zero hidratação assíncrona, gate de
    // `ProtectedLayout` já avalia o token correto no primeiro frame.
    const [token, setToken] = useState<string | null>(() => authService.getStoredToken());
    const [user, setUser] = useState<User | null>(() => authService.getStoredUser());

    const login = useCallback(async (data: LoginRequest) => {
        const response = await authService.login(data);
        setUser(response.user);
        setToken(response.token);
        authService.saveAuth(response.token, response.user);
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        authService.logout();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!token,
                isLoading: false,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
