import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Monogram from '../luxury/Monogram';
import { getInitials } from '../luxury/formatters';

const navItems = [
    { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
    { to: '/usuarios', label: 'Residentes', icon: Users },
    { to: '/unidades', label: 'Unidades', icon: Building2 },
    { to: '/comunicados', label: 'Comunicados', icon: Megaphone },
    { to: '/eventos', label: 'Programação', icon: CalendarDays },
    { to: '/votacoes', label: 'Votações', icon: Vote },
];

const plannedItems = [
    { label: 'Áreas Comuns', icon: TreePalm },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(true);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const width = collapsed ? 76 : 240;

    return (
        <aside
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                width,
                height: '100vh',
                background: 'var(--color-obsidian)',
                borderRight: '1px solid var(--color-line)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 30,
                transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {/* Brand */}
            <div
                style={{
                    padding: collapsed ? '28px 0 24px' : '28px 24px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                }}
            >
                <Monogram size={collapsed ? 32 : 36} />
                {!collapsed && (
                    <div>
                        <div
                            className="serif"
                            style={{
                                fontSize: 20,
                                fontWeight: 500,
                                letterSpacing: '0.04em',
                                color: 'var(--color-bone)',
                                lineHeight: 1,
                            }}
                        >
                            Domus
                        </div>
                        <div
                            className="tracking-luxe"
                            style={{ fontSize: 8, color: 'var(--color-metal-2)', marginTop: 4 }}
                        >
                            Residence
                        </div>
                    </div>
                )}
            </div>

            <div className="gold-rule" style={{ margin: collapsed ? '0 18px' : '0 24px' }} />

            {/* Primary nav */}
            <nav
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: collapsed ? '20px 0' : '24px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}
            >
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            title={collapsed ? item.label : undefined}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            style={{
                                padding: collapsed ? '14px 0' : '12px 24px',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                            }}
                        >
                            <Icon size={18} strokeWidth={1.4} />
                            {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                    );
                })}

                {/* Subtle separator before planned items */}
                <div
                    style={{
                        height: 1,
                        background: 'var(--color-line)',
                        margin: collapsed ? '12px 22px' : '16px 24px',
                    }}
                />

                {plannedItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.label}
                            className="nav-item disabled"
                            title={`${item.label} · em breve`}
                            style={{
                                padding: collapsed ? '14px 0' : '12px 24px',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                            }}
                        >
                            <Icon size={18} strokeWidth={1.4} />
                            {!collapsed && <span>{item.label}</span>}
                        </div>
                    );
                })}
            </nav>

            {/* Footer — avatar + collapse toggle */}
            <div
                style={{
                    borderTop: '1px solid var(--color-line)',
                    padding: collapsed ? '16px 0' : '16px 20px',
                    display: 'flex',
                    flexDirection: collapsed ? 'column' : 'row',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <button
                    onClick={handleLogout}
                    title={user?.name ? `${user.name} · sair` : 'Sair'}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                    }}
                >
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                        {getInitials(user?.name)}
                    </div>
                </button>
                {!collapsed && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: 12,
                                color: 'var(--color-bone)',
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {user?.name?.split(' ').slice(0, 2).join(' ') || 'Administração'}
                        </div>
                        <div
                            className="tracking-luxe"
                            style={{ fontSize: 8, color: 'var(--color-metal-2)', marginTop: 2 }}
                        >
                            {user?.isSyndic ? 'Síndico' : user?.role === 'ADMIN' ? 'Administração' : 'Residente'}
                        </div>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? 'Expandir' : 'Recolher'}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-bone-muted)',
                        cursor: 'pointer',
                        padding: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>
        </aside>
    );
}
