import { createContext } from 'react';
import type { User } from '../types/user';
import type { LoginRequest } from '../types/auth';

export interface AuthContextData {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (data: LoginRequest) => Promise<void>;
    logout: () => void;
}

/**
 * Vive em arquivo dedicado (separado do provider) porque a regra
 * `react-refresh/only-export-components` exige que arquivos de componente
 * exportem **apenas** componentes para HMR funcionar.
 */
export const AuthContext = createContext<AuthContextData>({} as AuthContextData);
