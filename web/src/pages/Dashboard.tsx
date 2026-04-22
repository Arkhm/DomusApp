import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Megaphone,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  Vote,
  TreePalm,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { noticeService } from '../services/noticeService';
import { unitService } from '../services/unitService';
import type { Notice } from '../types/notice';
import type { User } from '../types/user';

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

const moduleItems = [
  { label: 'Usuários', icon: Users, status: 'active' as const },
  { label: 'Comunicados', icon: Megaphone, status: 'active' as const },
  { label: 'Unidades', icon: Building2, status: 'planned' as const },
  { label: 'Eventos', icon: CalendarDays, status: 'planned' as const },
  { label: 'Votações', icon: Vote, status: 'planned' as const },
  { label: 'Áreas Comuns', icon: TreePalm, status: 'planned' as const },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);

      const [usersResult, noticesResult, unitsResult] = await Promise.allSettled([
        userService.getAll(),
        noticeService.getAll(),
        unitService.getAll(),
      ]);

      let users: User[] = [];
      let notices: Notice[] = [];
      let unitsCount = 0;

      if (usersResult.status === 'fulfilled') {
        users = usersResult.value;
      }

      if (noticesResult.status === 'fulfilled') {
        notices = noticesResult.value;
      }

      if (unitsResult.status === 'fulfilled') {
        unitsCount = unitsResult.value.length;
      }

      const nextStats: DashboardStats = {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.status === 'ACTIVE').length,
        adminUsers: users.filter((u) => u.role === 'ADMIN').length,
        residents: users.filter((u) => u.role === 'MORADOR').length,
        employees: users.filter((u) => u.role === 'FUNCIONARIO').length,
        units: unitsCount,
        notices: notices.length,
      };

      setStats(nextStats);
      setRecentNotices(notices.slice(0, 4));
      setIsLoading(false);

      const failedCalls = [usersResult, noticesResult, unitsResult].filter((r) => r.status === 'rejected').length;

      if (failedCalls > 0) {
        toast('Alguns indicadores não puderam ser carregados com o seu perfil atual.', {
          icon: 'ℹ️',
          duration: 3000,
          position: 'top-right',
          style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #2a2a3d' },
        });
      }
    };

    loadDashboard();
  }, []);

  const occupancyRate = useMemo(() => {
    if (!stats.units) return 0;
    return Math.min(100, Math.round((stats.residents / stats.units) * 100));
  }, [stats.residents, stats.units]);

  const userDistribution = useMemo(
    () => [
      { label: 'Moradores', value: stats.residents },
      { label: 'Funcionários', value: stats.employees },
      { label: 'Admins', value: stats.adminUsers },
    ],
    [stats.residents, stats.employees, stats.adminUsers]
  );

  const maxDistribution = Math.max(...userDistribution.map((item) => item.value), 1);

  const statCards = [
    {
      label: 'Usuários cadastrados',
      value: stats.totalUsers,
      helper: `${stats.activeUsers} ativos`,
      icon: Users,
    },
    {
      label: 'Comunicados',
      value: stats.notices,
      helper: 'Publicações registradas',
      icon: Megaphone,
    },
    {
      label: 'Unidades',
      value: stats.units,
      helper: 'Base condominial',
      icon: Building2,
    },
    {
      label: 'Taxa de ocupação',
      value: `${occupancyRate}%`,
      helper: `${stats.residents} moradores vinculados`,
      icon: TrendingUp,
    },
  ];

  const getNoticeAudience = (notice: Notice) => {
    if (notice.targetType === 'ALL') return 'Todos os moradores';
    if (!notice.targetUnit) return 'Unidade específica';
    return notice.targetUnit.block
      ? `Bloco ${notice.targetUnit.block} • Unidade ${notice.targetUnit.number}`
      : `Unidade ${notice.targetUnit.number}`;
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="bg-bg-primary min-h-screen">
      <Header title="Dashboard" />

      <div className="p-8 space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-border-primary bg-gradient-to-br from-bg-card via-bg-secondary to-bg-tertiary p-7"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(108,99,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_25%)]" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-primary/20 bg-accent-primary/10 px-3 py-1 text-xs font-medium text-accent-primary mb-4">
                <Shield className="w-3.5 h-3.5" />
                Painel administrativo DomusApp
              </div>

              <h2 className="text-3xl font-bold text-text-primary leading-tight">
                Olá, {user?.name?.split(' ')[0] || 'usuário'}.
              </h2>

              <p className="mt-3 text-sm md:text-base text-text-secondary leading-relaxed">
                Acompanhe os principais números do sistema, visualize os comunicados mais recentes e acesse rapidamente os módulos já disponíveis.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/usuarios"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-primary-hover transition-colors"
                >
                  Gerenciar usuários
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/comunicados"
                  className="inline-flex items-center gap-2 rounded-xl border border-border-primary bg-bg-card/60 px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-bg-hover transition-colors"
                >
                  Ver comunicados
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 min-w-[280px]">
              <div className="rounded-2xl border border-border-primary bg-bg-card/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-text-muted">Saúde do sistema</span>
                  <Activity className="w-4 h-4 text-success" />
                </div>
                <div className="text-2xl font-bold text-text-primary">Online</div>
                <p className="text-xs text-text-secondary mt-1">Base visual do painel carregada</p>
              </div>

              <div className="rounded-2xl border border-border-primary bg-bg-card/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-text-muted">Avisos recentes</span>
                  <BellRing className="w-4 h-4 text-accent-primary" />
                </div>
                <div className="text-2xl font-bold text-text-primary">{stats.notices}</div>
                <p className="text-xs text-text-secondary mt-1">Comunicados disponíveis</p>
              </div>

              <div className="rounded-2xl border border-border-primary bg-bg-card/70 p-4 col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-text-muted">Moradores x unidades</span>
                  <Building2 className="w-4 h-4 text-warning" />
                </div>

                <div className="w-full h-2 rounded-full bg-bg-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end"
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
                  <span>{stats.residents} moradores vinculados</span>
                  <span>{stats.units} unidades cadastradas</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl border border-border-primary bg-bg-card p-5 hover:border-border-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-secondary">{card.label}</p>
                    <div className="mt-3 text-3xl font-bold text-text-primary">
                      {isLoading ? '—' : card.value}
                    </div>
                    <p className="mt-2 text-xs text-text-muted">{card.helper}</p>
                  </div>

                  <div className="w-11 h-11 rounded-xl bg-accent-primary/10 text-accent-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-2xl border border-border-primary bg-bg-card p-6"
          >
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Comunicados recentes</h3>
                <p className="text-sm text-text-secondary mt-1">Últimas publicações disponíveis no sistema</p>
              </div>

              <Link
                to="/comunicados"
                className="text-sm text-accent-primary hover:text-accent-primary-hover font-medium"
              >
                Ver todos
              </Link>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-border-primary bg-bg-secondary/60 p-4 animate-pulse"
                  >
                    <div className="h-4 w-40 rounded bg-bg-hover mb-3" />
                    <div className="h-3 w-full rounded bg-bg-hover mb-2" />
                    <div className="h-3 w-3/4 rounded bg-bg-hover" />
                  </div>
                ))
              ) : recentNotices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-primary bg-bg-secondary/40 p-8 text-center text-text-muted">
                  <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  Nenhum comunicado encontrado.
                </div>
              ) : (
                recentNotices.map((notice) => (
                  <div
                    key={notice.id}
                    className="rounded-2xl border border-border-primary bg-bg-secondary/60 p-4 hover:border-border-secondary transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-2.5 py-1 text-[11px] font-medium text-accent-primary">
                            <Megaphone className="w-3 h-3" />
                            {getNoticeAudience(notice)}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-text-primary truncate">
                          {notice.title}
                        </h4>

                        <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                          {notice.content}
                        </p>

                        <div className="mt-3 flex items-center gap-4 text-xs text-text-muted flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            {notice.author.name}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="w-3.5 h-3.5" />
                            {formatDate(notice.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="rounded-2xl border border-border-primary bg-bg-card p-6"
            >
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Distribuição de usuários</h3>
                  <p className="text-sm text-text-secondary mt-1">Resumo por perfil cadastrado</p>
                </div>
                <FileText className="w-4 h-4 text-text-muted" />
              </div>

              <div className="space-y-4">
                {userDistribution.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="text-text-secondary">{item.label}</span>
                      <span className="text-text-primary font-semibold">
                        {isLoading ? '—' : item.value}
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end"
                        style={{ width: `${(item.value / maxDistribution) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="rounded-2xl border border-border-primary bg-bg-card p-6"
            >
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Status dos módulos</h3>
                  <p className="text-sm text-text-secondary mt-1">Visão geral do desenvolvimento</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>

              <div className="space-y-3">
                {moduleItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.status === 'active';

                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border border-border-primary bg-bg-secondary/50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            active ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div>
                          <p className="text-sm font-medium text-text-primary">{item.label}</p>
                          <p className="text-xs text-text-muted">
                            {active ? 'Disponível no painel' : 'Planejado para próxima etapa'}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          active ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
                        }`}
                      >
                        {active ? 'Ativo' : 'Em breve'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}