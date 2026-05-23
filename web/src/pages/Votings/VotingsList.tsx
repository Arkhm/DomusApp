import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Loader2, Vote as VoteIcon, Users, BarChart3, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import Tag from '../../components/luxury/Tag';
import { formatDateTimeBR, getInitials } from '../../components/luxury/formatters';
import { votingService } from '../../services/votingService';
import {
    getVotingStatus,
    totalVotes,
    type Voting,
    type VotingStatus,
} from '../../types/voting';
import VotingFormModal from './VotingFormModal';
import { ListMeta, IconBtn, EmptyTable, DeleteModal, FilterSelect } from '../Users/UsersList';

export default function VotingsList() {
    const [votings, setVotings] = useState<Voting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [deletingVoting, setDeletingVoting] = useState<Voting | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [filterStatus, setFilterStatus] = useState<VotingStatus | ''>('');

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await votingService.getAll();
            setVotings(Array.isArray(data) ? data : []);
        } catch {
            // Graceful degradation: backend may not exist yet
            setVotings([]);
            toast.error('Erro ao carregar votações.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const now = useMemo(() => new Date(), [votings]);

    const enriched = useMemo(
        () => votings.map((v) => ({ voting: v, status: getVotingStatus(v, now), total: totalVotes(v) })),
        [votings, now],
    );

    const filtered = useMemo(
        () => (filterStatus ? enriched.filter((e) => e.status === filterStatus) : enriched),
        [enriched, filterStatus],
    );

    // Metrics
    const totalCount = enriched.length;
    const activeCount = enriched.filter((e) => e.status === 'ACTIVE').length;
    const votesTotal = enriched.reduce((acc, e) => acc + e.total, 0);
    const avgParticipation = totalCount > 0 ? Math.round(votesTotal / totalCount) : 0;

    const handleDelete = async () => {
        if (!deletingVoting) return;
        setIsDeleting(true);
        try {
            await votingService.delete(deletingVoting.id);
            toast.success('Votação removida.');
            setDeletingVoting(null);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erro ao remover votação.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div>
            <Header title="Votações" eyebrow="Deliberações · Participação · Resultados" />

            <PageBody>
                {/* Editorial header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        marginBottom: 32,
                        gap: 24,
                        flexWrap: 'wrap',
                    }}
                >
                    <div style={{ maxWidth: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <span style={{ width: 24, height: 1, background: 'var(--color-metal-1)' }} />
                            <div
                                className="tracking-luxe"
                                style={{ fontSize: 9, color: 'var(--color-metal-1)' }}
                            >
                                Vida em comunidade
                            </div>
                        </div>
                        <h2
                            className="serif"
                            style={{
                                fontSize: 40,
                                fontWeight: 400,
                                color: 'var(--color-bone)',
                                letterSpacing: '-0.01em',
                                lineHeight: 1.1,
                            }}
                        >
                            Deliberações{' '}
                            <span className="serif-it" style={{ color: 'var(--color-metal-1)' }}>
                                em curso
                            </span>
                        </h2>
                        <p
                            style={{
                                fontSize: 14,
                                color: 'var(--color-bone-dim)',
                                marginTop: 12,
                                lineHeight: 1.6,
                            }}
                        >
                            Decisões coletivas, transparência de votos e acompanhamento ao vivo dos resultados.
                        </p>
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="btn-gold">
                        <Plus size={12} />
                        Nova votação
                    </button>
                </div>

                {/* Metric cards */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 16,
                        marginBottom: 40,
                    }}
                >
                    <MetricCard
                        icon={<VoteIcon size={16} />}
                        label="Total de Votações"
                        value={totalCount}
                        accent="var(--color-metal-1)"
                    />
                    <MetricCard
                        icon={<Activity size={16} />}
                        label="Votações Ativas"
                        value={activeCount}
                        accent="var(--color-ok)"
                    />
                    <MetricCard
                        icon={<Users size={16} />}
                        label="Total de Votos"
                        value={votesTotal}
                        accent="var(--color-purple)"
                    />
                    <MetricCard
                        icon={<BarChart3 size={16} />}
                        label="Média de Participação"
                        value={avgParticipation}
                        accent="var(--color-warn)"
                        suffix="por votação"
                    />
                </div>

                {/* Filter */}
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        marginBottom: 24,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <FilterSelect
                        value={filterStatus}
                        onChange={(v) => setFilterStatus(v as VotingStatus | '')}
                        placeholder="Todos os status"
                        options={[
                            { value: 'ACTIVE', label: 'Ativa' },
                            { value: 'CLOSED', label: 'Encerrada' },
                        ]}
                    />
                    {filterStatus && (
                        <button
                            onClick={() => setFilterStatus('')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-metal-1)',
                                fontSize: 12,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-sans)',
                            }}
                        >
                            Limpar filtro
                        </button>
                    )}
                </div>

                <ListMeta
                    count={filtered.length}
                    singular="votação"
                    plural="votações"
                    filtered={!!filterStatus}
                />

                {/* Grid */}
                {isLoading ? (
                    <div
                        className="luxe-card"
                        style={{
                            padding: 80,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            color: 'var(--color-bone-dim)',
                        }}
                    >
                        <Loader2 size={18} className="animate-spin" />
                        <span>Carregando votações…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="luxe-card">
                        <EmptyTable
                            title={
                                filterStatus
                                    ? 'Nenhuma votação neste status'
                                    : 'Nenhuma votação registrada'
                            }
                            hint={
                                filterStatus
                                    ? 'Tente limpar o filtro.'
                                    : 'Clique em "Nova votação" para criar a primeira deliberação.'
                            }
                        />
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                            gap: 20,
                        }}
                    >
                        {filtered.map(({ voting, status, total }, i) => (
                            <VotingCard
                                key={voting.id}
                                voting={voting}
                                status={status}
                                total={total}
                                delay={i * 0.05}
                                onDelete={() => setDeletingVoting(voting)}
                            />
                        ))}
                    </div>
                )}
            </PageBody>

            <DeleteModal
                open={!!deletingVoting}
                isDeleting={isDeleting}
                title="Remover votação"
                description={
                    deletingVoting ? (
                        <>
                            Tem certeza que deseja remover a votação{' '}
                            <strong style={{ color: 'var(--color-bone)' }}>{deletingVoting.title}</strong>?
                            Os votos coletados serão perdidos.
                        </>
                    ) : null
                }
                onClose={() => setDeletingVoting(null)}
                onConfirm={handleDelete}
            />

            <VotingFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false);
                    load();
                }}
            />
        </div>
    );
}

// ---------- Metric card -----------------------------------------------------

function MetricCard({
    icon,
    label,
    value,
    accent,
    suffix,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    accent: string;
    suffix?: string;
}) {
    return (
        <div
            className="luxe-card"
            style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 3,
                    height: '100%',
                    background: accent,
                    opacity: 0.65,
                }}
            />
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: accent,
                }}
            >
                {icon}
                <span
                    className="tracking-luxe"
                    style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}
                >
                    {label}
                </span>
            </div>
            <div
                className="serif"
                style={{
                    fontSize: 36,
                    fontWeight: 400,
                    color: 'var(--color-bone)',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                }}
            >
                {value}
            </div>
            {suffix && (
                <div style={{ fontSize: 11, color: 'var(--color-bone-muted)' }}>{suffix}</div>
            )}
        </div>
    );
}

// ---------- Voting card -----------------------------------------------------

function VotingCard({
    voting,
    status,
    total,
    delay,
    onDelete,
}: {
    voting: Voting;
    status: VotingStatus;
    total: number;
    delay: number;
    onDelete: () => void;
}) {
    const winnerId = useMemo(() => {
        if (total === 0) return null;
        let best = voting.options[0];
        for (const o of voting.options) {
            if (o.votes > best.votes) best = o;
        }
        // Tie: don't highlight any
        const tied = voting.options.filter((o) => o.votes === best.votes).length > 1;
        return tied || best.votes === 0 ? null : best.id;
    }, [voting.options, total]);

    return (
        <motion.article
            className="luxe-card fade-up"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Tag tone={status === 'ACTIVE' ? 'ok' : 'neutral'} dot>
                        {status === 'ACTIVE' ? 'Ativa' : 'Encerrada'}
                    </Tag>
                    <span
                        className="tracking-luxe"
                        style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}
                    >
                        {total} {total === 1 ? 'voto' : 'votos'}
                    </span>
                </div>
                <IconBtn
                    icon={<Trash2 size={14} />}
                    danger
                    onClick={onDelete}
                    title="Excluir votação"
                />
            </div>

            {/* Title + description */}
            <div>
                <h4
                    className="serif"
                    style={{
                        fontSize: 22,
                        fontWeight: 500,
                        color: 'var(--color-bone)',
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em',
                        marginBottom: 8,
                    }}
                >
                    {voting.title}
                </h4>
                <p
                    style={{
                        fontSize: 13,
                        color: 'var(--color-bone-dim)',
                        lineHeight: 1.6,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {voting.description}
                </p>
            </div>

            {/* Options with progress bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {voting.options.map((opt) => {
                    const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                    const isWinner = opt.id === winnerId;
                    return (
                        <OptionBar
                            key={opt.id}
                            text={opt.text}
                            votes={opt.votes}
                            pct={pct}
                            isWinner={isWinner}
                        />
                    );
                })}
            </div>

            {/* Footer */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 14,
                    borderTop: '1px solid var(--color-line)',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ width: 22, height: 22, fontSize: 9 }}>
                        {getInitials(voting.author?.name)}
                    </div>
                    <span
                        className="tracking-luxe"
                        style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}
                    >
                        Por {voting.author?.name?.split(' ')[0] || '—'}
                    </span>
                </div>
                <div
                    className="mono"
                    style={{ fontSize: 10, color: 'var(--color-bone-muted)', letterSpacing: '0.04em' }}
                >
                    {formatDateTimeBR(voting.startDate)} — {formatDateTimeBR(voting.endDate)}
                </div>
            </div>
        </motion.article>
    );
}

// ---------- Option progress bar ---------------------------------------------

function OptionBar({
    text,
    votes,
    pct,
    isWinner,
}: {
    text: string;
    votes: number;
    pct: number;
    isWinner: boolean;
}) {
    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 6,
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        color: isWinner ? 'var(--color-bone)' : 'var(--color-bone-soft)',
                        fontWeight: isWinner ? 500 : 400,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    {isWinner && (
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'var(--color-metal-1)',
                                display: 'inline-block',
                            }}
                        />
                    )}
                    {text}
                </span>
                <span
                    className="mono"
                    style={{
                        fontSize: 11,
                        color: isWinner ? 'var(--color-metal-1)' : 'var(--color-bone-muted)',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {votes} {votes === 1 ? 'voto' : 'votos'} · {pct}%
                </span>
            </div>
            <div
                style={{
                    position: 'relative',
                    height: 8,
                    width: '100%',
                    borderRadius: 4,
                    background: 'var(--color-ink-2)',
                    border: '1px solid var(--color-line)',
                    overflow: 'hidden',
                }}
            >
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        height: '100%',
                        background: isWinner
                            ? 'linear-gradient(90deg, color-mix(in srgb, var(--color-metal-1) 70%, transparent), var(--color-metal-1))'
                            : 'linear-gradient(90deg, color-mix(in srgb, var(--color-purple) 55%, transparent), color-mix(in srgb, var(--color-purple) 85%, transparent))',
                    }}
                />
            </div>
        </div>
    );
}
