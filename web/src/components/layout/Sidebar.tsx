import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    LayoutDashboard,
    Users,
    Building2,
    Megaphone,
    CalendarDays,
    Vote,
    TreePalm,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Shield,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/usuarios', label: 'Usuários', icon: Users },
    { to: '/unidades', label: 'Unidades', icon: Building2 },
    { to: '/comunicados', label: 'Comunicados', icon: Megaphone },
    { to: '/eventos', label: 'Eventos', icon: CalendarDays },
    { to: '#', label: 'Votações', icon: Vote, disabled: true },
    { to: '#', label: 'Áreas Comuns', icon: TreePalm, disabled: true },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? 72 : 224 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="h-screen bg-sidebar-bg border-r border-border-primary flex flex-col fixed left-0 top-0 z-30"
        >
            {/* Logo area */}
            <div className="flex items-center gap-3 px-5 h-16 border-b border-border-primary flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-gradient-start to-accent-gradient-end flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-white" />
                </div>
                <AnimatePresence>
                    {!collapsed && (
                        <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.15 }}
                            className="text-lg font-bold text-text-primary whitespace-nowrap overflow-hidden"
                        >
                            DomusApp
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;

                    if (item.disabled) {
                        return (
                            <div
                                key={item.label}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-muted cursor-not-allowed opacity-50"
                                title={collapsed ? item.label : undefined}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <AnimatePresence>
                                    {!collapsed && (
                                        <motion.span
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: 'auto' }}
                                            exit={{ opacity: 0, width: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="text-sm whitespace-nowrap overflow-hidden"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    }

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            title={collapsed ? item.label : undefined}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${isActive
                                    ? 'bg-sidebar-active text-sidebar-active-text'
                                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
                                }`
                            }
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            <AnimatePresence>
                                {!collapsed && (
                                    <motion.span
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 'auto' }}
                                        exit={{ opacity: 0, width: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Collapse toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="mx-3 mb-2 flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-sidebar-hover transition-colors"
            >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* User section + Logout */}
            <div className="border-t border-border-primary p-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-gradient-start to-accent-gradient-end flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-white">
                            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                        </span>
                    </div>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.div
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1 min-w-0 overflow-hidden"
                            >
                                <p className="text-sm font-medium text-text-primary truncate">
                                    {user?.name || 'Admin'}
                                </p>
                                <p className="text-xs text-text-muted truncate">
                                    {user?.email || 'admin@domusapp.com'}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={handleLogout}
                                className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-bg transition-colors flex-shrink-0"
                                title="Sair"
                            >
                                <LogOut className="w-4 h-4" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.aside>
    );
}
