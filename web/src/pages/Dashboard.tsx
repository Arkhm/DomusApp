import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, CalendarDays, ArrowRight, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import PageBody from '../components/luxury/PageBody';
import SectionHeader from '../components/luxury/SectionHeader';
import Tag from '../components/luxury/Tag';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { noticeService } from '../services/noticeService';
import { unitService } from '../services/unitService';
import { eventService } from '../services/eventService';
import type { Notice } from '../types/notice';
import type { Event as EventItem } from '../types/event';
import type { User } from '../types/user';
import { timeAgo } from '../components/luxury/formatters';

interface DashboardStats {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    residents: number;
    employees: number;
    units: number;
    notices: number;
}

const initialStats: DashboardStats = {
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    residents: 0,
    employees: 0,
    units: 0,
    notices: 0,
};

export default function Dashboard() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>(initialStats);
    const [recentNotices, setRecentNotices] = useState<Notice[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const [usersR, noticesR, unitsR, eventsR] = await Promise.allSettled([
                userService.getAll(),
                noticeService.getAll(),
                unitService.getAll(),
                eventService.getAll(),
            ]);

            const users: User[] = usersR.status === 'fulfilled' ? usersR.value : [];
            const notices: Notice[] = noticesR.status === 'fulfilled' ? noticesR.value : [];
            const unitsCount = unitsR.status === 'fulfilled' ? unitsR.value.length : 0;
            const events: EventItem[] = eventsR.status === 'fulfilled' ? eventsR.value : [];

            setStats({
                totalUsers: users.length,
                activeUsers: users.filter((u) => u.status === 'ACTIVE').length,
                adminUsers: users.filter((u) => u.role === 'ADMIN').length,
                residents: users.filter((u) => u.role === 'MORADOR').length,
                employees: users.filter((u) => u.role === 'FUNCIONARIO').length,
                units: unitsCount,
                notices: notices.length,
            });
            // Defensivo: ordena por createdAt desc antes de cortar. Não assume
            // que a API devolve em ordem cronológica reversa — se mudar o default
            // do backend, "recentes" deixaria de ser recente silenciosamente.
            setRecentNotices(
                notices
                    .slice()
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 3),
            );
            setUpcomingEvents(
                events
                    .filter((e) => new Date(e.eventDate) > new Date())
                    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
                    .slice(0, 3),
            );
            setIsLoading(false);

            const failedCalls = [usersR, noticesR, unitsR, eventsR].filter((r) => r.status === 'rejected').length;
            if (failedCalls > 0) {
                toast('Alguns indicadores não puderam ser carregados com o seu perfil atual.', {
                    icon: 'ℹ️',
                    duration: 3000,
                });
            }
        };
        load();
    }, []);

    const occupancy = useMemo(() => {
        if (!stats.units) return 0;
        return Math.min(100, Math.round((stats.residents / stats.units) * 100));
    }, [stats.residents, stats.units]);

    const firstName = user?.name?.split(' ')[0] || 'Administração';
    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 12) return 'Bom dia';
        if (h < 19) return 'Boa tarde';
        return 'Boa noite';
    }, []);

    return (
        <div>
            <Header title="Painel" eyebrow={`Visão geral · ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`} />

            <PageBody>
                {/* ============ HERO ============ */}
                <section
                    className="fade-up"
                    style={{
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 6,
                        border: '1px solid var(--metal-line)',
                        background:
                            'linear-gradient(135deg, var(--color-ink-1) 0%, var(--color-ink-2) 60%, color-mix(in srgb, var(--color-purple) 18%, transparent) 130%)',
                        padding: '56px 56px 48px',
                        marginBottom: 56,
                    }}
                >
                    <div className="aurora" />

                    {/* Watermark D — brand-mark mantém Cormorant mesmo no app-shell */}
                    <div
                        aria-hidden
                        className="serif brand-mark"
                        style={{
                            position: 'absolute',
                            right: -40,
                            top: -120,
                            fontSize: 460,
                            lineHeight: 1,
                            color: 'transparent',
                            WebkitTextStroke: '1px var(--watermark-stroke)',
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                    >
                        D
                    </div>

                    <div
                        style={{
                            position: 'relative',
                            display: 'grid',
                            gridTemplateColumns: '1.4fr 1fr',
                            gap: 64,
                            alignItems: 'end',
                        }}
                    >
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                                <div className="gold-rule short" style={{ width: 60 }} />
                                <div className="tracking-luxe" style={{ fontSize: 10, color: 'var(--color-metal-1)' }}>
                                    {new Date().toLocaleDateString('pt-BR', {
                                        weekday: 'long',
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </div>
                            </div>

                            <h2
                                className="serif"
                                style={{
                                    fontSize: 64,
                                    // weight 400 (era 300) — Inter Light em 64px ficava
                                    // anêmico; 400 mantém a presença sem virar pesado.
                                    fontWeight: 400,
                                    lineHeight: 1,
                                    letterSpacing: '-0.02em',
                                    color: 'var(--color-bone)',
                                    marginBottom: 12,
                                }}
                            >
                                {greeting}, {firstName}.
                            </h2>
                            <p
                                // brand-mark: pull-quote editorial mantém Cormorant italic.
                                className="serif-it brand-mark"
                                style={{
                                    fontSize: 22,
                                    color: 'var(--color-metal-1)',
                                    fontWeight: 400,
                                    marginBottom: 32,
                                }}
                            >
                                Tudo em ordem no condomínio hoje.
                            </p>

                            <p
                                style={{
                                    fontSize: 15,
                                    color: 'var(--color-bone-dim)',
                                    lineHeight: 1.7,
                                    maxWidth: 540,
                                }}
                            >
                                {stats.residents} residentes ativos em {stats.units} unidades.{' '}
                                {upcomingEvents.length} eventos próximos na programação e {stats.notices} comunicados
                                publicados.
                            </p>

                            <div style={{ display: 'flex', gap: 16, marginTop: 36, flexWrap: 'wrap' }}>
                                <Link to="/comunicados" className="btn-gold" style={{ textDecoration: 'none' }}>
                                    <Megaphone size={13} />
                                    Publicar comunicado
                                </Link>
                                <Link to="/eventos" className="btn-ghost" style={{ textDecoration: 'none' }}>
                                    <CalendarDays size={13} />
                                    Programação
                                </Link>
                            </div>
                        </div>

                        {/* Health card */}
                        <HealthCard occupancy={occupancy} stats={stats} />
                    </div>
                </section>

                {/* ============ STATS ============ */}
                <SectionHeader
                    eyebrow="Indicadores"
                    title="Visão geral"
                    subtitle="Painel atualizado em tempo real"
                />

                <section
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 20,
                        marginBottom: 64,
                    }}
                >
                    <StatCard
                        eyebrow="Residentes"
                        value={isLoading ? '—' : stats.residents}
                        footnote={`${stats.activeUsers} contas ativas`}
                    />
                    <StatCard
                        eyebrow="Unidades"
                        value={isLoading ? '—' : stats.units}
                        footnote="No empreendimento"
                    />
                    <StatCard
                        eyebrow="Ocupação"
                        value={isLoading ? '—' : `${occupancy}%`}
                        footnote="Residentes vinculados"
                    />
                    <StatCard
                        eyebrow="Comunicados"
                        value={isLoading ? '—' : stats.notices}
                        footnote="Publicações registradas"
                    />
                </section>

                {/* ============ BULLETIN + EVENTS ============ */}
                <section
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1.3fr 1fr',
                        gap: 24,
                        marginBottom: 64,
                    }}
                >
                    <div className="luxe-card" style={{ padding: 40 }}>
                        <SectionHeader
                            inset
                            eyebrow="Boletim"
                            title="Comunicados recentes"
                            action={
                                <Link
                                    to="/comunicados"
                                    className="btn-ghost"
                                    style={{ padding: '6px 14px', fontSize: 10, textDecoration: 'none' }}
                                >
                                    Ver todos <ArrowRight size={12} />
                                </Link>
                            }
                        />

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => <NoticeSkeleton key={i} />)
                            ) : recentNotices.length === 0 ? (
                                <EmptyState
                                    icon={<Megaphone size={28} strokeWidth={1.2} />}
                                    text="Nenhum comunicado publicado."
                                />
                            ) : (
                                recentNotices.map((n, i) => (
                                    <NoticeRow key={n.id} notice={n} last={i === recentNotices.length - 1} />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="luxe-card" style={{ padding: 40 }}>
                        <SectionHeader
                            inset
                            eyebrow="Programação"
                            title="Próximos eventos"
                            action={
                                <Link
                                    to="/eventos"
                                    className="btn-ghost"
                                    style={{ padding: '6px 14px', fontSize: 10, textDecoration: 'none' }}
                                >
                                    Ver todos <ArrowRight size={12} />
                                </Link>
                            }
                        />

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => <EventSkeleton key={i} />)
                            ) : upcomingEvents.length === 0 ? (
                                <EmptyState
                                    icon={<CalendarDays size={28} strokeWidth={1.2} />}
                                    text="Nenhum evento próximo."
                                />
                            ) : (
                                upcomingEvents.map((e, i) => (
                                    <EventTile key={e.id} event={e} last={i === upcomingEvents.length - 1} />
                                ))
                            )}
                        </div>
                    </div>
                </section>

                {/* ============ DISTRIBUTION + MODULE STATUS ============ */}
                <SectionHeader eyebrow="Demografia" title="Distribuição da comunidade" />

                <section
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 24,
                        marginBottom: 32,
                    }}
                >
                    <DistributionCard stats={stats} />
                    <ModuleStatusCard />
                </section>
            </PageBody>
        </div>
    );
}

// ============================================================
// Sub-components
// ============================================================

function HealthCard({ occupancy, stats }: { occupancy: number; stats: DashboardStats }) {
    return (
        <div
            style={{
                position: 'relative',
                background: 'var(--color-ink-1)',
                border: '1px solid var(--metal-line)',
                borderRadius: 4,
                padding: 32,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 24,
                }}
            >
                <div className="tracking-luxe" style={{ fontSize: 9, color: 'var(--color-metal-1)' }}>
                    Saúde do sistema
                </div>
                <Tag tone="ok" dot>Operacional</Tag>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div
                    className="serif"
                    style={{
                        fontSize: 72,
                        fontWeight: 300,
                        lineHeight: 1,
                        color: 'var(--color-bone)',
                        letterSpacing: '-0.02em',
                    }}
                >
                    {occupancy}
                </div>
                <div className="serif" style={{ fontSize: 28, color: 'var(--color-metal-1)', fontWeight: 300 }}>
                    %
                </div>
                <div
                    className="tracking-luxe"
                    style={{ fontSize: 9, color: 'var(--color-bone-muted)', marginLeft: 12 }}
                >
                    Ocupação
                </div>
            </div>

            {/* Gauge */}
            <div style={{ marginTop: 28 }}>
                <div
                    style={{
                        height: 2,
                        background: 'var(--color-ink-3)',
                        borderRadius: 1,
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${occupancy}%`,
                            background:
                                'linear-gradient(90deg, var(--color-purple) 0%, var(--color-metal-1) 100%)',
                            boxShadow: '0 0 12px color-mix(in srgb, var(--color-metal-1) 40%, transparent)',
                            transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                    />
                </div>
            </div>

            <div className="gold-rule" style={{ margin: '28px 0 20px' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Stat value={stats.residents} label="Residentes" />
                <Stat value={stats.units} label="Unidades" />
                <Stat value={stats.employees} label="Equipe" />
                <Stat value="24/7" label="Concierge" accent />
            </div>
        </div>
    );
}

function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
    return (
        <div>
            <div
                className="serif"
                style={{
                    fontSize: 28,
                    color: accent ? 'var(--color-metal-1)' : 'var(--color-bone)',
                    fontWeight: 400,
                }}
            >
                {value}
            </div>
            <div
                className="tracking-luxe"
                style={{ fontSize: 8, color: 'var(--color-bone-muted)', marginTop: 4 }}
            >
                {label}
            </div>
        </div>
    );
}

function StatCard({
    eyebrow,
    value,
    footnote,
}: {
    eyebrow: string;
    value: number | string;
    footnote: string;
}) {
    return (
        <div className="luxe-card fade-up" style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div
                className="tracking-luxe"
                style={{ fontSize: 9, color: 'var(--color-bone-muted)', marginBottom: 16 }}
            >
                {eyebrow}
            </div>
            <div
                className="serif"
                style={{
                    fontSize: 56,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: 'var(--color-bone)',
                    letterSpacing: '-0.02em',
                }}
            >
                {value}
            </div>
            <div
                style={{
                    marginTop: 16,
                    fontSize: 12,
                    color: 'var(--color-bone-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}
            >
                <span style={{ width: 16, height: 1, background: 'var(--metal-line-strong)' }} />
                {footnote}
            </div>
        </div>
    );
}

function NoticeRow({ notice, last }: { notice: Notice; last: boolean }) {
    const d = new Date(notice.createdAt);
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '64px 1fr auto',
                gap: 20,
                padding: '20px 0',
                borderBottom: last ? 'none' : '1px solid var(--color-line)',
                alignItems: 'start',
            }}
        >
            <div style={{ textAlign: 'right' }}>
                <div
                    className="serif"
                    style={{
                        fontSize: 28,
                        color: 'var(--color-metal-1)',
                        lineHeight: 1,
                        fontWeight: 400,
                    }}
                >
                    {d.toLocaleDateString('pt-BR', { day: '2-digit' })}
                </div>
                <div
                    className="tracking-luxe"
                    style={{ fontSize: 8, color: 'var(--color-bone-muted)', marginTop: 4 }}
                >
                    {d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                </div>
            </div>

            <div style={{ minWidth: 0 }}>
                <h4
                    className="serif"
                    style={{
                        fontSize: 17,
                        fontWeight: 500,
                        color: 'var(--color-bone)',
                        marginBottom: 6,
                        lineHeight: 1.25,
                    }}
                >
                    {notice.title}
                </h4>
                <p
                    style={{
                        fontSize: 13,
                        color: 'var(--color-bone-dim)',
                        lineHeight: 1.55,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {notice.content}
                </p>
                <div style={{ display: 'flex', gap: 14, marginTop: 10, alignItems: 'center' }}>
                    <span
                        className="tracking-luxe"
                        style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}
                    >
                        {notice.author?.name?.split(' ').slice(0, 2).join(' ') || '—'}
                    </span>
                    <span
                        style={{
                            width: 3,
                            height: 3,
                            borderRadius: '50%',
                            background: 'var(--color-bone-muted)',
                        }}
                    />
                    <span
                        className="tracking-luxe"
                        style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}
                    >
                        {timeAgo(notice.createdAt)}
                    </span>
                </div>
            </div>

            <Tag tone={notice.targetType === 'ALL' ? 'gold' : 'purple'}>
                {notice.targetType === 'ALL' ? 'Geral' : 'Direcionado'}
            </Tag>
        </div>
    );
}

function EventTile({ event, last }: { event: EventItem; last: boolean }) {
    const d = new Date(event.eventDate);
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '76px 1fr',
                gap: 20,
                padding: '20px 0',
                borderBottom: last ? 'none' : '1px solid var(--color-line)',
                alignItems: 'start',
            }}
        >
            <div
                style={{
                    border: '1px solid var(--metal-line)',
                    borderRadius: 3,
                    padding: '10px 6px',
                    textAlign: 'center',
                    background: 'color-mix(in srgb, var(--color-metal-1) 6%, transparent)',
                }}
            >
                <div className="tracking-luxe" style={{ fontSize: 8, color: 'var(--color-metal-1)' }}>
                    {d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                </div>
                <div
                    className="serif"
                    style={{
                        fontSize: 28,
                        color: 'var(--color-bone)',
                        lineHeight: 1.1,
                        fontWeight: 400,
                    }}
                >
                    {d.toLocaleDateString('pt-BR', { day: '2-digit' })}
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--color-bone-dim)', marginTop: 2 }}>
                    {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>

            <div style={{ minWidth: 0 }}>
                <h4
                    className="serif"
                    style={{
                        fontSize: 17,
                        fontWeight: 500,
                        color: 'var(--color-bone)',
                        marginBottom: 6,
                        lineHeight: 1.25,
                    }}
                >
                    {event.title}
                </h4>
                {event.location && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            color: 'var(--color-bone-dim)',
                            fontSize: 12,
                            marginBottom: 8,
                        }}
                    >
                        <MapPin size={12} color="var(--color-metal-1)" />
                        {event.location}
                    </div>
                )}
                <p
                    style={{
                        fontSize: 12,
                        color: 'var(--color-bone-muted)',
                        lineHeight: 1.55,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {event.content}
                </p>
            </div>
        </div>
    );
}

function DistributionCard({ stats }: { stats: DashboardStats }) {
    const rows = [
        { label: 'Residentes', value: stats.residents, color: 'var(--color-purple)' },
        { label: 'Equipe', value: stats.employees, color: 'var(--color-metal-1)' },
        { label: 'Administração', value: stats.adminUsers, color: 'var(--color-purple-bright)' },
    ];
    const max = Math.max(...rows.map((r) => r.value), 1);

    return (
        <div className="luxe-card" style={{ padding: 40 }}>
            <SectionHeader inset eyebrow="Perfis" title="Por categoria" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {rows.map((r) => (
                    <div key={r.label}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                marginBottom: 8,
                            }}
                        >
                            <span
                                className="tracking-luxe"
                                style={{ fontSize: 9, color: 'var(--color-bone-dim)' }}
                            >
                                {r.label}
                            </span>
                            <span
                                className="serif"
                                style={{ fontSize: 24, color: 'var(--color-bone)', fontWeight: 400 }}
                            >
                                {r.value}
                            </span>
                        </div>
                        <div
                            style={{
                                height: 1,
                                background: 'var(--color-ink-3)',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    height: '100%',
                                    width: `${(r.value / max) * 100}%`,
                                    background: r.color,
                                    boxShadow: `0 0 8px ${r.color}`,
                                    transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="gold-rule" style={{ margin: '32px 0 20px' }} />

            <div
                className="serif-it brand-mark"
                style={{ fontSize: 14, color: 'var(--color-bone-dim)', lineHeight: 1.5 }}
            >
                “Em uma residência refinada, cada vínculo conta — e cada detalhe é registrado.”
            </div>
        </div>
    );
}

function ModuleStatusCard() {
    const mods = [
        { label: 'Residentes', status: 'ok' as const, note: 'Operacional' },
        { label: 'Unidades', status: 'ok' as const, note: 'Operacional' },
        { label: 'Comunicados', status: 'ok' as const, note: 'Operacional' },
        { label: 'Programação', status: 'ok' as const, note: 'Operacional' },
        { label: 'Deliberações', status: 'soon' as const, note: 'Em desenvolvimento' },
        { label: 'Áreas Comuns', status: 'soon' as const, note: 'Em desenvolvimento' },
    ];

    return (
        <div className="luxe-card" style={{ padding: 40 }}>
            <SectionHeader inset eyebrow="Módulos" title="Status do painel" />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {mods.map((m, i) => (
                    <div
                        key={m.label}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 0',
                            borderBottom: i === mods.length - 1 ? 'none' : '1px solid var(--color-line)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span
                                className="status-dot"
                                style={{
                                    background: m.status === 'ok' ? 'var(--color-ok)' : 'var(--color-metal-3)',
                                }}
                            />
                            <span style={{ fontSize: 14, color: 'var(--color-bone)', fontWeight: 400 }}>
                                {m.label}
                            </span>
                        </div>
                        <span
                            className="tracking-luxe"
                            style={{
                                fontSize: 9,
                                color: m.status === 'ok' ? 'var(--color-ok)' : 'var(--color-bone-muted)',
                            }}
                        >
                            {m.note}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function NoticeSkeleton() {
    return (
        <div
            style={{
                padding: '20px 0',
                borderBottom: '1px solid var(--color-line)',
                display: 'grid',
                gridTemplateColumns: '64px 1fr auto',
                gap: 20,
            }}
        >
            <div style={{ height: 36, background: 'var(--color-ink-2)' }} />
            <div>
                <div style={{ height: 16, width: '70%', background: 'var(--color-ink-2)', marginBottom: 8 }} />
                <div style={{ height: 12, width: '100%', background: 'var(--color-ink-2)' }} />
            </div>
            <div style={{ width: 60, height: 18, background: 'var(--color-ink-2)' }} />
        </div>
    );
}

function EventSkeleton() {
    return (
        <div
            style={{
                padding: '20px 0',
                borderBottom: '1px solid var(--color-line)',
                display: 'grid',
                gridTemplateColumns: '76px 1fr',
                gap: 20,
            }}
        >
            <div style={{ height: 70, background: 'var(--color-ink-2)' }} />
            <div>
                <div style={{ height: 16, width: '60%', background: 'var(--color-ink-2)', marginBottom: 8 }} />
                <div style={{ height: 12, width: '40%', background: 'var(--color-ink-2)' }} />
            </div>
        </div>
    );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div
            style={{
                padding: '40px 0',
                textAlign: 'center',
                color: 'var(--color-bone-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
            }}
        >
            <span style={{ opacity: 0.4 }}>{icon}</span>
            <span className="serif-it" style={{ fontSize: 14 }}>
                {text}
            </span>
        </div>
    );
}
