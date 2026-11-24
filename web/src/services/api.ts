import axios, { type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
});

const PUBLIC_PATHS = ['/login', '/esqueci-senha', '/redefinir-senha'];
const NO_REFRESH = ['/auth/login', '/auth/logout',
    '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];
let refreshPromise: Promise<unknown> | null = null;
let logoutPromise: Promise<void> | null = null;
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.request.use(async config => {
    if (config.url === '/auth/logout') await refreshPromise?.catch(() => undefined);
    return config;
});

function endSession() {
    if (!logoutPromise) {
        localStorage.removeItem('@domusapp:user');
        logoutPromise = api.post('/auth/logout').catch(() => undefined).then(() => {
            if (!PUBLIC_PATHS.includes(window.location.pathname)) window.location.href = '/login';
        }).finally(() => { logoutPromise = null; });
    }
    return logoutPromise;
}

api.interceptors.response.use(
    response => response,
    async error => {
        const config = error.config as RetryConfig | undefined;
        if (error.response?.status !== 401 || !config || NO_REFRESH.includes(config.url?.split('?')[0] ?? '')) {
            return Promise.reject(error);
        }
        if (config._retry) {
            await endSession();
            return Promise.reject(error);
        }
        config._retry = true;
        try {
            if (!refreshPromise) {
                refreshPromise = api.post('/auth/refresh').finally(() => { refreshPromise = null; });
            }
            await refreshPromise;
        } catch (refreshError) {
            // Só um 401 do refresh é rejeição definitiva. Rede fora ou 503 mantêm
            // os cookies (a API também os preserva) para a próxima tentativa.
            if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) await endSession();
            return Promise.reject(refreshError);
        }
        return api(config);
    },
);

export default api;
