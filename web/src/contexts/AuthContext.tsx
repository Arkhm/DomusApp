import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { authService } from '../services/authService';
import { mockAuthService } from '../services/mockData';
import type { User } from '../types/user';
import type { LoginRequest } from '../types/auth';

const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true';

interface AuthContextData {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (data: LoginRequest) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load stored auth on mount
    useEffect(() => {
        const storedToken = authService.getStoredToken();
        const storedUser = authService.getStoredUser();

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(storedUser);
        }

        setIsLoading(false);
    }, []);

    const login = useCallback(async (data: LoginRequest) => {
        let response;

        if (isMockMode) {
            response = await mockAuthService.login(data.email, data.password);
        } else {
            response = await authService.login(data);
        }

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
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextData {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}
