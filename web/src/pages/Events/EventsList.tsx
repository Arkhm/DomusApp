import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Plus,
    Trash2,
    CalendarDays,
    Loader2,
    X,
    Clock,
    Users,
    Send,
    MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { eventService } from '../../services/eventService';
import type { Event } from '../../types/event';
import EventFormModal from './EventFormModal';
import Header from '../../components/layout/Header';

function formatEventDate(dateStr: string): string {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffH < 24) return `${diffH}h atrás`;
    if (diffD < 7) return `${diffD}d atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isUpcoming(dateStr: string): boolean {
    return new Date(dateStr) > new Date();
}

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrador',
    MORADOR: 'Morador',
    FUNCIONARIO: 'Funcionário',
};

export default function EventsList() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Delete confirmation
    const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadEvents = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await eventService.getAll();
            setEvents(data);
        } catch (error: any) {
            toast.error('Erro ao carregar eventos.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const handleDelete = async () => {
        if (!deletingEvent) return;

        setIsDeleting(true);
        try {
            await eventService.delete(deletingEvent.id);
            toast.success('Evento removido com sucesso!', {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #22c55e' },
                iconTheme: { primary: '#22c55e', secondary: '#16161f' },
            });
            setDeletingEvent(null);
            loadEvents();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao remover evento.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleModalSuccess = () => {
        setIsModalOpen(false);
        loadEvents();
    };

    return (
        <div className="bg-bg-primary">
            <Header title="Eventos" />

            <div className="p-8">
                {/* Top bar */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                        <CalendarDays className="w-4 h-4" />
                        <span>
                            {events.length} {events.length === 1 ? 'evento' : 'eventos'} registrados
                        </span>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end text-white font-medium rounded-lg shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/30 transition-shadow text-sm whitespace-nowrap flex-shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Evento
                    </motion.button>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
                        <span className="ml-3 text-text-secondary">Carregando eventos...</span>
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                        <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-base font-medium">Nenhum evento registrado</p>
                        <p className="text-sm mt-1">Clique em "+ Novo Evento" para criar o primeiro</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {events.map((event, index) => {
                            const upcoming = isUpcoming(event.eventDate);

                            return (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group bg-bg-card border border-border-primary rounded-xl p-5 hover:border-border-secondary transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Title + Date badge */}
                                            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                                <h3 className="text-base font-semibold text-text-primary">
                                                    {event.title}
                                                </h3>
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                                                        upcoming
                                                            ? 'bg-success-bg text-success'
                                                            : 'bg-bg-hover text-text-muted'
                                                    }`}
                                                >
                                                    {upcoming ? 'Próximo' : 'Realizado'}
                                                </span>
                                            </div>

                                            {/* Event date */}
                                            <div className="flex items-center gap-1.5 text-sm text-accent-primary mb-2">
                                                <CalendarDays className="w-3.5 h-3.5" />
                                                <span className="font-medium">
                                                    {formatEventDate(event.eventDate)}
                                                </span>
                                            </div>

                                            {/* Location */}
                                            {event.location && (
                                                <div className="flex items-center gap-1.5 text-sm text-text-secondary mb-2">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span>{event.location}</span>
                                                </div>
                                            )}

                                            {/* Body preview */}
                                            <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 mb-3">
                                                {event.content}
                                            </p>

                                            {/* Footer meta */}
                                            <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
                                                {/* Author */}
                                                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-gradient-start to-accent-gradient-end flex items-center justify-center flex-shrink-0">
                                                        <span className="text-[9px] font-bold text-white">
                                                            {event.author.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span>
                                                        {event.author.name}
                                                        <span className="text-text-muted/60 ml-1">
                                                            ({ROLE_LABELS[event.author.role] || event.author.role})
                                                        </span>
                                                    </span>
                                                </div>

                                                {/* Created timestamp */}
                                                <div className="flex items-center gap-1 text-xs text-text-muted">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>Criado {timeAgo(event.createdAt)}</span>
                                                </div>

                                                {/* Target badge */}
                                                <div className="flex items-center gap-1 text-xs">
                                                    {event.targetType === 'ALL' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-info-bg text-info font-medium">
                                                            <Users className="w-3 h-3" />
                                                            Todos
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning-bg text-warning font-medium">
                                                            <Send className="w-3 h-3" />
                                                            {event.targetUnit
                                                                ? `${event.targetUnit.block || ''} ${event.targetUnit.number}`
                                                                : 'Unidade'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Delete button */}
                                        <button
                                            onClick={() => setDeletingEvent(event)}
                                            className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-bg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                            title="Excluir evento"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Delete confirmation modal */}
            <AnimatePresence>
                {deletingEvent && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => !isDeleting && setDeletingEvent(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-card border border-border-primary rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-text-primary">Confirmar Exclusão</h3>
                                <button
                                    onClick={() => setDeletingEvent(null)}
                                    disabled={isDeleting}
                                    className="p-1 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-text-secondary mb-6">
                                Tem certeza que deseja remover o evento <strong className="text-text-primary">"{deletingEvent.title}"</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setDeletingEvent(null)}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded-xl hover:bg-bg-hover transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-sm font-medium text-white bg-error rounded-xl hover:bg-error/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                                >
                                    {isDeleting ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Excluindo...
                                        </>
                                    ) : (
                                        'Excluir'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Modal */}
            <EventFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleModalSuccess}
            />
        </div>
    );
}
