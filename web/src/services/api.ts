import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Os tokens de sessão vivem em cookies httpOnly emitidos pela API. O browser
    // os anexa sozinho — não há (e não deve haver) token legível por JS aqui.
    withCredentials: true,
});

// Rotas que não devem disparar a renovação: se o próprio /auth/refresh devolve
// 401, a sessão acabou de verdade; e um 401 do /auth/login é senha errada, não
// sessão expirada.
const NO_RETRY = ['/auth/refresh', '/auth/login', '/auth/logout'];

// O access token dura 15 minutos, então um 401 por expiração é rotina. Uma
// requisição só pode ser repetida uma vez para não virar laço infinito quando a
// sessão realmente morreu.
type RetriableRequest = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * Quando várias telas carregam ao mesmo tempo e o token expira, todas levam 401
 * juntas. Sem esta trava cada uma chamaria /auth/refresh, e as chamadas
 * concorrentes rotacionariam o refresh token umas por cima das outras — a
 * última venceria e as demais receberiam um token já substituído. Com a
 * promessa compartilhada, a renovação acontece uma vez e todo mundo espera.
 */
let refreshing: Promise<void> | null = null;

const refreshSession = () => {
    refreshing ??= api
        .post('/auth/refresh')
        .then(() => undefined)
        .finally(() => {
            refreshing = null;
        });
    return refreshing;
};

const redirectToLogin = () => {
    // Só o perfil em cache mora no browser; os cookies quem apaga é a API.
    localStorage.removeItem('@domusapp:user');

    if (window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
};

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const request = error.config as RetriableRequest | undefined;

        const shouldTryRefresh =
            error.response?.status === 401 &&
            request &&
            !request._retried &&
            !NO_RETRY.some((path) => request.url?.includes(path));

        if (shouldTryRefresh) {
            request._retried = true;
            try {
                await refreshSession();
                // Sessão renovada: repete a requisição original com o cookie novo.
                return await api(request);
            } catch {
                redirectToLogin();
                return Promise.reject(error);
            }
        }

        if (error.response?.status === 401 && !request?.url?.includes('/auth/login')) {
            redirectToLogin();
        }

        return Promise.reject(error);
    }
);

export default api;
