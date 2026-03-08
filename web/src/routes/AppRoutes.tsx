import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Login from '../pages/Login';
import ProtectedLayout from '../components/layout/ProtectedLayout';
import UsersList from '../pages/Users/UsersList';

export default function AppRoutes() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-bg-primary">
                <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <Routes>
            {/* Public routes */}
            <Route
                path="/login"
                element={
                    isAuthenticated ? <Navigate to="/usuarios" replace /> : <Login />
                }
            />

            {/* Protected routes */}
            <Route element={<ProtectedLayout />}>
                <Route path="/usuarios" element={<UsersList />} />
                {/* Future routes will go here */}
                <Route path="/dashboard" element={
                    <div className="flex items-center justify-center h-full text-text-secondary">
                        <p className="text-lg">Dashboard — Em breve</p>
                    </div>
                } />
            </Route>

            {/* Default redirect */}
            <Route path="*" element={<Navigate to={isAuthenticated ? '/usuarios' : '/login'} replace />} />
        </Routes>
    );
}
