import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Loader2, MapPin, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageBody from '../../components/luxury/PageBody';
import Tag from '../../components/luxury/Tag';
import { getInitials } from '../../components/luxury/formatters';
import { eventService } from '../../services/eventService';
import type { Event as EventItem } from '../../types/event';
import EventFormModal from './EventFormModal';
import { ListMeta, IconBtn, EmptyTable, DeleteModal } from '../Users/UsersList';

export default function EventsList() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await eventService.getAll();
            setEvents(data);
        } catch {
            toast.error('Erro ao carregar eventos.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const sorted = useMemo(
        () => events.slice().sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()),
        [events],
    );
    const upcoming = useMemo(() => sorted.filter((e) => new Date(e.eventDate) > new Date()), [sorted]);

    const handleDelete = async () => {
        if (!deletingEvent) return;
        setIsDeleting(true);
        try {
            await eventService.delete(deletingEvent.id);
            toast.success('Evento removido.');
            setDeletingEvent(null);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erro ao remover evento.');
        } finally {
            setIsDeleting(false);
        }
    };

    const featured = upcoming[0];
    const rest = featured ? sorted.filter((e) => e.id !== featured.id) : sorted;

    return (
        <div>
            <Header title="Programação" eyebrow="Cultura · Convívio · Operação" />

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
                    <div style={{ maxWidth: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <span style={{ width: 24, height: 1, background: 'var(--color-metal-1)' }} />
                            <div
                                className="tracking-luxe"
                                style={{ fontSize: 9, color: 'var(--color-metal-1)' }}
                            >
                                Programação cultural
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
                            Calendário{' '}
                            <span className="serif-it" style={{ color: 'var(--color-metal-1)' }}>
                                do edifício
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
                            Recitais, assembleias, soirées e encontros privativos curados para a comunidade Domus.
                        </p>
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="btn-gold">
                        <Plus size={12} />
                        Novo evento
                    </button>
                </div>

                <ListMeta count={upcoming.length} singular="evento próximo" plural="eventos próximos" />

                {/* Featured */}
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
                        <span>Carregando programação…</span>
                    </div>
                ) : events.length === 0 ? (
                    <div className="luxe-card">
                        <EmptyTable
                            title="Nenhum evento registrado"
                            hint='Clique em "Novo evento" para criar o primeiro.'
                        />
                    </div>
                ) : (
                    <>
                        {featured && <FeaturedEvent event={featured} onDelete={() => setDeletingEvent(featured)} />}

                        {rest.length > 0 && (
                            <>
                                <div
                                    className="tracking-luxe"
                                    style={{
                                        fontSize: 9,
                                        color: 'var(--color-bone-muted)',
                                        margin: '48px 0 24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                    }}
                                >
                                    <span style={{ flex: 1, height: 1, background: 'var(--color-line-strong)' }} />
                                    Toda a programação
                                    <span style={{ flex: 1, height: 1, background: 'var(--color-line-strong)' }} />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {rest.map((e, i) => (
                                        <EventRow
                                            key={e.id}
                                            event={e}
                                            delay={i * 0.05}
                                            onDelete={() => setDeletingEvent(e)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </PageBody>

            <DeleteModal
                open={!!deletingEvent}
                isDeleting={isDeleting}
                title="Remover evento"
                description={
                    deletingEvent ? (
                        <>
                            Tem certeza que deseja remover o evento{' '}
                            <strong style={{ color: 'var(--color-bone)' }}>{deletingEvent.title}</strong>?
                        </>
                    ) : null
                }
                onClose={() => setDeletingEvent(null)}
                onConfirm={handleDelete}
            />

            <EventFormModal
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

function FeaturedEvent({ event, onDelete }: { event: EventItem; onDelete: () => void }) {
    const d = new Date(event.eventDate);
    return (
        <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 6,
                border: '1px solid var(--metal-line-strong)',
                background:
                    'linear-gradient(135deg, var(--color-ink-1) 0%, var(--color-ink-2) 60%, color-mix(in srgb, var(--color-purple) 18%, transparent) 130%)',
                padding: 48,
            }}
        >
            <div className="aurora" />

            <div
                style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '180px 1fr',
                    gap: 48,
                    alignItems: 'start',
                }}
            >
                {/* Date block */}
                <div>
                    <div
                        style={{
                            border: '1px solid var(--metal-line)',
                            borderRadius: 3,
                            padding: '20px 12px',
                            textAlign: 'center',
                            background: 'color-mix(in srgb, var(--color-metal-1) 6%, transparent)',
                        }}
                    >
                        <div
                            className="tracking-luxe"
                            style={{ fontSize: 10, color: 'var(--color-metal-1)', marginBottom: 8 }}
                        >
                            {d.toLocaleDateString('pt-BR', { weekday: 'long' })}
                        </div>
                        <div
                            className="serif"
                            style={{
                                fontSize: 80,
                                fontWeight: 300,
                                color: 'var(--color-bone)',
                                lineHeight: 0.95,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            {d.toLocaleDateString('pt-BR', { day: '2-digit' })}
                        </div>
                        <div
                            className="serif-it"
                            style={{ fontSize: 18, color: 'var(--color-metal-1)', marginTop: 4 }}
                        >
                            {d.toLocaleDateString('pt-BR', { month: 'long' })}
                        </div>
                        <div className="gold-rule" style={{ margin: '16px 0 12px' }} />
                        <div
                            className="mono"
                            style={{
                                fontSize: 13,
                                color: 'var(--color-bone-soft)',
                                letterSpacing: '0.06em',
                            }}
                        >
                            {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <Tag tone="gold" dot>
                            Em destaque
                        </Tag>
                        <Tag tone="neutral">Próximo evento</Tag>
                    </div>

                    <h3
                        className="serif"
                        style={{
                            fontSize: 40,
                            fontWeight: 400,
                            color: 'var(--color-bone)',
                            lineHeight: 1.1,
                            letterSpacing: '-0.01em',
                            marginBottom: 16,
                        }}
                    >
                        {event.title}
                    </h3>

                    {event.location && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                color: 'var(--color-metal-1)',
                                fontSize: 13,
                                marginBottom: 20,
                            }}
                        >
                            <MapPin size={14} />
                            {event.location}
                        </div>
                    )}

                    <p
                        style={{
                            fontSize: 15,
                            color: 'var(--color-bone-dim)',
                            lineHeight: 1.7,
                            marginBottom: 28,
                        }}
                    >
                        {event.content}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <button className="btn-gold">
                            <Edit3 size={12} />
                            Editar evento
                        </button>
                        <button className="btn-ghost">Ver confirmações</button>
                        <div
                            style={{
                                marginLeft: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                                {getInitials(event.author.name)}
                            </div>
                            <span
                                className="tracking-luxe"
                                style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}
                            >
                                Publicado por {event.author.name.split(' ')[0]}
                            </span>
                            <IconBtn
                                icon={<Trash2 size={14} />}
                                danger
                                onClick={onDelete}
                                title="Excluir evento"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </motion.article>
    );
}

function EventRow({
    event,
    delay,
    onDelete,
}: {
    event: EventItem;
    delay: number;
    onDelete: () => void;
}) {
    const d = new Date(event.eventDate);
    const upcoming = d > new Date();

    return (
        <motion.article
            className="luxe-card fade-up"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            style={{ padding: 28 }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '72px 1fr 200px',
                    gap: 28,
                    alignItems: 'center',
                }}
            >
                <div
                    style={{
                        border: '1px solid var(--metal-line)',
                        borderRadius: 3,
                        padding: '10px 6px',
                        textAlign: 'center',
                        background: 'color-mix(in srgb, var(--color-metal-1) 6%, transparent)',
                        opacity: upcoming ? 1 : 0.6,
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
                    <div
                        className="mono"
                        style={{ fontSize: 9, color: 'var(--color-bone-dim)', marginTop: 2 }}
                    >
                        {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                <div>
                    <h4
                        className="serif"
                        style={{
                            fontSize: 20,
                            fontWeight: 500,
                            color: 'var(--color-bone)',
                            marginBottom: 6,
                            lineHeight: 1.2,
                        }}
                    >
                        {event.title}
                    </h4>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            color: 'var(--color-bone-dim)',
                            fontSize: 12,
                            marginBottom: 8,
                            flexWrap: 'wrap',
                        }}
                    >
                        {event.location && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <MapPin size={11} color="var(--color-metal-1)" />
                                {event.location}
                            </span>
                        )}
                        {event.location && (
                            <span
                                style={{
                                    width: 3,
                                    height: 3,
                                    borderRadius: '50%',
                                    background: 'var(--color-bone-muted)',
                                }}
                            />
                        )}
                        <span
                            className="tracking-luxe"
                            style={{ fontSize: 9, color: 'var(--color-bone-muted)' }}
                        >
                            Curado por {event.author.name.split(' ').slice(0, 2).join(' ')}
                        </span>
                    </div>
                    <p
                        style={{
                            fontSize: 13,
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

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 8,
                    }}
                >
                    <Tag tone={upcoming ? 'ok' : 'neutral'} dot>
                        {upcoming ? 'Próximo' : 'Realizado'}
                    </Tag>
                    <IconBtn
                        icon={<Trash2 size={14} />}
                        danger
                        onClick={onDelete}
                        title="Excluir evento"
                    />
                </div>
            </div>
        </motion.article>
    );
}
