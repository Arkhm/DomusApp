import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';

export default function ProtectedLayout() {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex min-h-screen bg-bg-primary">
            <Sidebar />
            {/* Main content area — offset by sidebar width */}
            <main className="flex-1 ml-56 transition-all duration-200 min-h-screen overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
