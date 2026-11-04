import type { User } from './user';

export interface LoginRequest {
    email: string;
    password: string;
}

// A API não devolve mais token no corpo — ele viaja em cookie httpOnly.
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

// RF-007 — recuperação de senha.
export interface ForgotPasswordRequest {
    email: string;
}

export interface ResetPasswordRequest {
    token: string;
    newPassword: string;
}

export interface MessageResponse {
    message: string;
}
