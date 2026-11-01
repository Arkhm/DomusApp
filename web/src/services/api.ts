import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // O token de sessão vive em um cookie httpOnly emitido pela API. O browser
    // o anexa sozinho — não há (e não deve haver) token legível por JS aqui.
    withCredentials: true,
});

// Rotas que não exigem sessão. A AuthContext chama /auth/me em toda página pra
// saber se existe cookie válido — nas páginas daqui, um 401 dessa checagem é
// esperado (visitante deslogado abrindo "esqueci minha senha", por exemplo) e
// não deve disparar o redirect abaixo.
const PUBLIC_PATHS = ['/login', '/esqueci-senha', '/redefinir-senha'];

// Response interceptor — handle 401 (unauthorized)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Só o perfil em cache mora no browser; o cookie quem apaga é a API.
            localStorage.removeItem('@domusapp:user');

            // Redirect to login if not already there
            if (!PUBLIC_PATHS.includes(window.location.pathname)) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
