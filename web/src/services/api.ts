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

// Response interceptor — handle 401 (unauthorized)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Só o perfil em cache mora no browser; o cookie quem apaga é a API.
            localStorage.removeItem('@domusapp:user');

            // Redirect to login if not already there
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
