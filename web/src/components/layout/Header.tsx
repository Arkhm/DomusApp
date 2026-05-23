import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Lock, User as UserIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import LiveClock from '../luxury/LiveClock';
import { getInitials } from '../luxury/formatters';
import { useGeoCity } from '../../hooks/useGeoCity';

interface HeaderProps {
    title: string;
    eyebrow?: string;
}

export default function Header({ title, eyebrow }: HeaderProps) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const geo = useGeoCity();
    const cityLabel = geo?.city || 'Localizando…';

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [menuOpen]);

    const handleLogout = () => {
        setMenuOpen(false);
        logout();
        navigate('/login');
    };

    const handleComingSoon = (label: string) => {
        setMenuOpen(false);
        toast(`${label} — em breve!`, {
            icon: '🚧',
            duration: 3000,
            position: 'top-right',
        });
    };

    return (
        <header
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                height: 88,
                background: 'color-mix(in srgb, var(--color-ink-0) 88%, transparent)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: '1px solid var(--color-line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 48px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div className="deco-mark" />
                <div>
                    {eyebrow && (
                        <div
                            className="tracking-luxe"
                            style={{ fontSize: 9, color: 'var(--color-metal-1)', marginBottom: 4 }}
                        >
                            {eyebrow}
                        </div>
                    )}
                    <h1
                        className="serif"
                        style={{
                            fontSize: 30,
                            fontWeight: 400,
                            letterSpacing: '-0.01em',
                            color: 'var(--color-bone)',
                            lineHeight: 1,
                        }}
                    >
                        {title}
                    </h1>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {/* Clock — concierge feel */}
                <div style={{ textAlign: 'right' }}>
                    <div
                        className="tracking-luxe"
                        style={{ fontSize: 9, color: 'var(--color-bone-muted)', marginBottom: 2 }}
                        title={geo?.region ? `${geo.city} · ${geo.region}` : undefined}
                    >
                        {cityLabel}
                    </div>
                    <div
                        className="mono"
                        style={{ fontSize: 13, color: 'var(--color-bone-soft)', letterSpacing: '0.04em' }}
                    >
                        <LiveClock />
                    </div>
                </div>

                <div style={{ width: 1, height: 32, background: 'var(--color-line-strong)' }} />

                {/* Bell */}
                <button
                    title="Notificações"
                    style={{
                        position: 'relative',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-bone-dim)',
                        cursor: 'pointer',
                        padding: 8,
                    }}
                >
                    <Bell size={18} strokeWidth={1.4} />
                    <span
                        style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'var(--color-metal-1)',
                            boxShadow: '0 0 6px var(--color-metal-1)',
                        }}
                    />
                </button>

                <div style={{ width: 1, height: 32, background: 'var(--color-line-strong)' }} />

                {/* User dropdown */}
                <div style={{ position: 'relative' }} ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 6,
                        }}
                    >
                        <div className="avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
                            {getInitials(user?.name)}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 13, color: 'var(--color-bone)', fontWeight: 500 }}>
                                {user?.name?.split(' ').slice(0, 2).join(' ') || 'Administração'}
                            </div>
                            <div
                                className="tracking-luxe"
                                style={{ fontSize: 8, color: 'var(--color-metal-1)', marginTop: 2 }}
                            >
                                {user?.role === 'ADMIN' ? 'Administração' : user?.isSyndic ? 'Síndico' : 'Residente'}
                            </div>
                        </div>
                        <ChevronDown
                            size={14}
                            style={{
                                color: 'var(--color-bone-muted)',
                                marginLeft: 4,
                                transform: menuOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                            }}
                        />
                    </button>

                    <AnimatePresence>
                        {menuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                transition={{ duration: 0.15 }}
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    marginTop: 12,
                                    width: 220,
                                    background: 'var(--color-ink-1)',
                                    border: '1px solid var(--color-line-strong)',
                                    borderRadius: 3,
                                    overflow: 'hidden',
                                    boxShadow: '0 12px 32px color-mix(in srgb, var(--color-bone) 18%, transparent)',
                                    zIndex: 50,
                                }}
                            >
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-line)' }}>
                                    <div style={{ fontSize: 13, color: 'var(--color-bone)', fontWeight: 500 }}>
                                        {user?.name || 'Administração'}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--color-bone-muted)', marginTop: 2 }}>
                                        {user?.email || 'admin@domusapp.com'}
                                    </div>
                                </div>
                                <div style={{ padding: 4 }}>
                                    <DropdownItem icon={<UserIcon size={14} />} label="Meu perfil" onClick={() => handleComingSoon('Meu perfil')} />
                                    <DropdownItem icon={<Lock size={14} />} label="Alterar senha" onClick={() => handleComingSoon('Alterar senha')} />
                                </div>
                                <div style={{ borderTop: '1px solid var(--color-line)', padding: 4 }}>
                                    <DropdownItem
                                        icon={<LogOut size={14} />}
                                        label="Sair"
                                        onClick={handleLogout}
                                        danger
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}

function DropdownItem({
    icon,
    label,
    onClick,
    danger,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: danger ? 'var(--color-err)' : 'var(--color-bone-soft)',
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
                transition: 'background 0.15s ease, color 0.15s ease',
                borderRadius: 2,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = danger
                    ? 'color-mix(in srgb, var(--color-err) 8%, transparent)'
                    : 'var(--color-ink-2)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
            }}
        >
            {icon}
            {label}
        </button>
    );
}
