import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Login from '../pages/Login';
import ForgotPassword from '../pages/Auth/ForgotPassword';
import ResetPassword from '../pages/Auth/ResetPassword';
import ProtectedLayout from '../components/layout/ProtectedLayout';
import UsersList from '../pages/Users/UsersList';
import NoticesList from '../pages/Notices/NoticesList';
import Dashboard from '../pages/Dashboard';
import UnitsList from '../pages/Units/UnitsList';
import EventsList from '../pages/Events/EventsList';
import VotingsList from '../pages/Votings/VotingsList';

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
            <Route
                path="/login"
                element={
                    isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
                }
            />

            {/* RF-007 — recuperação de senha. Públicas: quem chega aqui, por
                definição, não consegue entrar. Um usuário já autenticado é
                mandado para o painel em vez de redefinir a senha por engano. */}
            <Route
                path="/esqueci-senha"
                element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
            />
            <Route path="/redefinir-senha" element={<ResetPassword />} />

            <Route element={<ProtectedLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/usuarios" element={<UsersList />} />
                <Route path="/unidades" element={<UnitsList />} />
                <Route path="/comunicados" element={<NoticesList />} />
                <Route path="/eventos" element={<EventsList />} />
                <Route path="/votacoes" element={<VotingsList />} />
            </Route>

            <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
    );
}