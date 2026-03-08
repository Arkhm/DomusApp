import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, Lock, LogOut, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
    title: string;
}

export default function Header({ title }: HeaderProps) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const handleLogout = () => {
        setMenuOpen(false);
        logout();
        navigate('/login');
    };

    const handleComingSoon = (label: string) => {
        setMenuOpen(false);
        toast(label + ' — em breve!', {
            icon: '🚧',
            duration: 3000,
            position: 'top-right',
            style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #2a2a3d' },
        });
    };

    return (
        <header className="h-16 bg-bg-secondary border-b border-border-primary flex items-center justify-between px-8 flex-shrink-0">
            <h1 className="text-xl font-semibold text-text-primary">{title}</h1>

            <div className="flex items-center gap-5">
                {/* Notifications */}
                <button className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-accent-primary rounded-full" />
                </button>

                {/* Divider */}
                <div className="w-px h-8 bg-border-primary" />

                {/* User avatar + name + dropdown */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="flex items-center gap-3 p-1.5 pr-3 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gradient-start to-accent-gradient-end flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-white">
                                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                            </span>
                        </div>
                        <span className="text-sm text-text-secondary hidden md:block">
                            {user?.name?.split(' ')[0] || 'Admin'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 hidden md:block ${menuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown menu */}
                    <AnimatePresence>
                        {menuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className="absolute right-0 top-full mt-2 w-52 bg-bg-card border border-border-primary rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
                            >
                                {/* User info header */}
                                <div className="px-4 py-3 border-b border-border-primary">
                                    <p className="text-sm font-medium text-text-primary truncate">{user?.name || 'Admin'}</p>
                                    <p className="text-xs text-text-muted truncate mt-0.5">{user?.email || 'admin@domusapp.com'}</p>
                                </div>

                                <div className="py-1.5">
                                    <button
                                        onClick={() => handleComingSoon('Meu Perfil')}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                                    >
                                        <User className="w-4 h-4" />
                                        Meu Perfil
                                    </button>
                                    <button
                                        onClick={() => handleComingSoon('Alterar Senha')}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                                    >
                                        <Lock className="w-4 h-4" />
                                        Alterar Senha
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-border-primary" />

                                <div className="py-1.5">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-bg transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Sair
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
