import type { User } from './user';

export interface LoginRequest {
    email: string;
    password: string;
}

// A API não devolve mais token no corpo — access e refresh viajam em cookies
// httpOnly separados (domusapp_token e domusapp_refresh).
export interface LoginResponse {
    user: User;
}

export interface SessionResponse {
    user: User;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface ResetPasswordRequest {
    token: string;
    password: string;
}
