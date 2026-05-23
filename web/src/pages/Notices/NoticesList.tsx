import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Loader2, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import Tag from '../../components/luxury/Tag';
import { timeAgo, getInitials } from '../../components/luxury/formatters';
import { noticeService } from '../../services/noticeService';
import { useAuth } from '../../contexts/AuthContext';
import type { Notice, NoticeStatus, NoticePriority } from '../../types/notice';
import NoticeFormModal from './NoticeFormModal';
import { ListMeta, IconBtn, EmptyTable, DeleteModal, FilterSelect } from '../../components/luxury/ListHelpers';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administração',
    MORADOR: 'Residente',
    FUNCIONARIO: 'Equipe',
};

export default function NoticesList() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [filterStatus, setFilterStatus] = useState<NoticeStatus | ''>('');
    const [filterPriority, setFilterPriority] = useState<NoticePriority | ''>('');

    const [deletingNotice, setDeletingNotice] = useState<Notice | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [markingId, setMarkingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await noticeService.getAll();
            setNotices(data);
        } catch {
            toast.error('Erro ao carregar comunicados.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        return notices.filter((n) => {
            if (filterStatus && n.status !== filterStatus) return false;
            if (filterPriority && n.priority !== filterPriority) return false;
            return true;
        });
    }, [notices, filterStatus, filterPriority]);

    const handleDelete = async () => {
        if (!deletingNotice) return;
        setIsDeleting(true);
        try {
            await noticeService.delete(deletingNotice.id);
            toast.success('Comunicado removido.');
            setDeletingNotice(null);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erro ao remover comunicado.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleMarkRead = async (id: string) => {
        setMarkingId(id);
        // otimista: marca local imediatamente
        setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        try {
            await noticeService.markAsRead(id);
        } catch (err: any) {
            // reverte em caso de erro
            setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
            toast.error(err.response?.data?.error || 'Erro ao marcar como lido.');
        } finally {
            setMarkingId(null);
        }
    };

    const isFiltering = !!filterStatus || !!filterPriority;

    return (
        <div>
            <Header title="Comunicados" eyebrow="Boletim oficial" />

            <PageBody>
                {/* Editorial header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        marginBottom: 40,
                        gap: 24,
                        flexWrap: 'wrap',
                    }}
                >
                    <div style={{ maxWidth: 560 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <span style={{ width: 24, height: 1, background: 'var(--color-metal-1)' }} />
                            <div
                                className="tracking-luxe"
                                style={{ fontSize: 9, color: 'var(--color-metal-1)' }}
                            >
                                Boletim · Edição corrente
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
                            Comunicados{' '}
                            <span className="serif-it brand-mark" style={{ color: 'var(--color-metal-1)' }}>
                                aos residentes
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
                            Avisos oficiais, manutenções programadas e novidades publicadas pela administração do
                            condomínio.
                        </p>
                    </div>
                    {isAdmin && (
                        <button onClick={() => setIsModalOpen(true)} className="btn-gold">
                            <Plus size={12} />
                            Novo comunicado
                        </button>
                    )}
                </div>

                {/* Filtros */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 16,
                        flexWrap: 'wrap',
                    }}
                >
                    {isAdmin && (
                        <FilterSelect
                            value={filterStatus}
                            onChange={(v) => setFilterStatus(v as NoticeStatus | '')}
                            placeholder="Todos os status"
                            options={[
                                { value: 'PUBLISHED', label: 'Publicado' },
                                { value: 'DRAFT', label: 'Rascunho' },
                            ]}
                        />
                    )}
                    <FilterSelect
                        value={filterPriority}
                        onChange={(v) => setFilterPriority(v as NoticePriority | '')}
                        placeholder="Todas as prioridades"
                        options={[
                            { value: 'NORMAL', label: 'Normal' },
                            { value: 'URGENT', label: 'Urgente' },
                        ]}
                    />
                    {isFiltering && (
                        <button
                            type="button"
                            onClick={() => {
                                setFilterStatus('');
                                setFilterPriority('');
                            }}
                            className="btn-ghost"
                            style={{ padding: '8px 14px' }}
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>

                <ListMeta
                    count={filtered.length}
                    singular={isFiltering ? 'comunicado' : 'comunicado publicado'}
                    plural={isFiltering ? 'comunicados' : 'comunicados publicados'}
                    filtered={isFiltering}
                />

                {/* Content */}
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
                        <span>Carregando comunicados…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="luxe-card">
                        <EmptyTable
                            title={isFiltering ? 'Nenhum comunicado encontrado' : 'Nenhum comunicado publicado'}
                            hint={
                                isFiltering
                                    ? 'Ajuste os filtros para ver mais resultados.'
                                    : isAdmin
                                      ? 'Clique em "Novo comunicado" para enviar o primeiro aviso.'
                                      : 'Quando a administração publicar avisos, eles aparecerão aqui.'
                            }
                        />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {filtered.map((n, i) => {
                            const d = new Date(n.createdAt);
                            const isUrgent = n.priority === 'URGENT';
                            const isDraft = n.status === 'DRAFT';
                            return (
                                <motion.article
                                    key={n.id}
                                    className="luxe-card fade-up"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    style={{
                                        padding: 36,
                                        // Destaque visual sutil em rascunho (admin)
                                        opacity: isDraft ? 0.78 : 1,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '92px 1fr 220px',
                                            gap: 32,
                                            alignItems: 'start',
                                        }}
                                    >
                                        {/* Date column */}
                                        <div
                                            style={{
                                                borderRight: '1px solid var(--color-line)',
                                                paddingRight: 24,
                                            }}
                                        >
                                            <div
                                                className="tracking-luxe"
                                                style={{
                                                    fontSize: 9,
                                                    color: 'var(--color-metal-1)',
                                                    marginBottom: 4,
                                                }}
                                            >
                                                {d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                            </div>
                                            <div
                                                className="serif brand-mark"
                                                style={{
                                                    fontSize: 48,
                                                    fontWeight: 300,
                                                    color: 'var(--color-bone)',
                                                    lineHeight: 0.9,
                                                    letterSpacing: '-0.02em',
                                                }}
                                            >
                                                {d.toLocaleDateString('pt-BR', { day: '2-digit' })}
                                            </div>
                                            <div
                                                className="mono"
                                                style={{
                                                    fontSize: 10,
                                                    color: 'var(--color-bone-muted)',
                                                    marginTop: 12,
                                                }}
                                            >
                                                {d.toLocaleTimeString('pt-BR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div>
                                            <h3
                                                className="serif"
                                                style={{
                                                    fontSize: 24,
                                                    fontWeight: 500,
                                                    color: 'var(--color-bone)',
                                                    lineHeight: 1.2,
                                                    marginBottom: 12,
                                                }}
                                            >
                                                {n.title}
                                            </h3>
                                            <p
                                                style={{
                                                    fontSize: 14,
                                                    color: 'var(--color-bone-dim)',
                                                    lineHeight: 1.7,
                                                    whiteSpace: 'pre-wrap',
                                                }}
                                            >
                                                {n.content}
                                            </p>

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 16,
                                                    marginTop: 20,
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                    }}
                                                >
                                                    <div
                                                        className="avatar"
                                                        style={{ width: 26, height: 26, fontSize: 11 }}
                                                    >
                                                        {getInitials(n.author.name)}
                                                    </div>
                                                    <div>
                                                        <div
                                                            style={{
                                                                fontSize: 12,
                                                                color: 'var(--color-bone)',
                                                                lineHeight: 1.2,
                                                            }}
                                                        >
                                                            {n.author.name}
                                                        </div>
                                                        <div
                                                            className="tracking-luxe"
                                                            style={{
                                                                fontSize: 8,
                                                                color: 'var(--color-bone-muted)',
                                                            }}
                                                        >
                                                            {ROLE_LABELS[n.author.role] || n.author.role}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span
                                                    style={{
                                                        width: 1,
                                                        height: 22,
                                                        background: 'var(--color-line-strong)',
                                                    }}
                                                />
                                                <span
                                                    className="tracking-luxe"
                                                    style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}
                                                >
                                                    {timeAgo(n.createdAt)}
                                                </span>
                                                {!isAdmin && !n.isRead && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkRead(n.id)}
                                                        disabled={markingId === n.id}
                                                        className="btn-ghost"
                                                        style={{
                                                            padding: '6px 12px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        <CheckCheck size={12} />
                                                        {markingId === n.id ? 'Marcando…' : 'Marcar como lido'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Meta column */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                gap: 10,
                                            }}
                                        >
                                            {!isAdmin && !n.isRead && (
                                                <Tag tone="gold" dot>
                                                    Novo
                                                </Tag>
                                            )}
                                            {isDraft && isAdmin && <Tag tone="neutral">Rascunho</Tag>}
                                            {isUrgent && (
                                                <Tag tone="err" dot>
                                                    Urgente
                                                </Tag>
                                            )}
                                            <Tag tone={n.targetType === 'ALL' ? 'gold' : 'purple'}>
                                                {n.targetType === 'ALL'
                                                    ? 'Todos os residentes'
                                                    : n.targetUnit
                                                      ? `${n.targetUnit.block ? `${n.targetUnit.block} · ` : ''}${n.targetUnit.number}`
                                                      : 'Unidade específica'}
                                            </Tag>
                                            {isAdmin && typeof n.readCount === 'number' && (
                                                <div
                                                    className="tracking-luxe"
                                                    style={{
                                                        fontSize: 9,
                                                        color: 'var(--color-bone-muted)',
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {n.readCount} de {n.totalAddressees ?? 0} leram
                                                </div>
                                            )}
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <IconBtn
                                                        icon={<Trash2 size={14} />}
                                                        danger
                                                        onClick={() => setDeletingNotice(n)}
                                                        title="Excluir comunicado"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </div>
                )}
            </PageBody>

            <DeleteModal
                open={!!deletingNotice}
                isDeleting={isDeleting}
                title="Remover comunicado"
                description={
                    deletingNotice ? (
                        <>
                            Tem certeza que deseja remover o comunicado{' '}
                            <strong style={{ color: 'var(--color-bone)' }}>{deletingNotice.title}</strong>? Esta
                            ação não pode ser desfeita.
                        </>
                    ) : null
                }
                onClose={() => setDeletingNotice(null)}
                onConfirm={handleDelete}
            />

            <NoticeFormModal
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
