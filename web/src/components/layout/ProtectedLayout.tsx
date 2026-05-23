import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPanelAccess } from '../../lib/access';
import Sidebar from './Sidebar';

export default function ProtectedLayout() {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Defesa em profundidade: backend já recusa o login de quem não tem acesso,
    // mas se um token antigo (pré-gate) ainda estiver no localStorage, redireciona.
    if (!hasPanelAccess(user)) {
        return <Navigate to="/login" replace />;
    }

    return (
        // `app-shell` class ativa o swap automático de .serif/.serif-it → Inter
        // dentro de todas as telas internas. Login está fora deste shell e
        // continua com Cormorant Garamond.
        <div className="app-shell" style={{ minHeight: '100vh', background: 'var(--color-ink-0)' }}>
            <Sidebar />
            {/* Offset by collapsed sidebar width (76px). Sidebar expands as overlay. */}
            <main style={{ marginLeft: 76, minHeight: '100vh' }}>
                <Outlet />
            </main>
        </div>
    );
}
