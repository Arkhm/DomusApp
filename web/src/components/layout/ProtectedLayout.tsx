import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';

export default function ProtectedLayout() {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-ink-0)' }}>
            <Sidebar />
            {/* Offset by collapsed sidebar width (76px). Sidebar expands as overlay. */}
            <main style={{ marginLeft: 76, minHeight: '100vh' }}>
                <Outlet />
            </main>
        </div>
    );
}
