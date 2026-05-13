import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventService } from '../../services/eventService';
import { unitService } from '../../services/unitService';
import type { EventFormData } from '../../types/event';
import type { Unit } from '../../types/user';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EventFormModal({ isOpen, onClose, onSuccess }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);

    const [form, setForm] = useState<EventFormData>({
        title: '',
        content: '',
        eventDate: '',
        location: '',
        targetType: 'ALL',
        targetUnitId: undefined,
    });

    useEffect(() => {
        if (isOpen) {
            setForm({
                title: '',
                content: '',
                eventDate: '',
                location: '',
                targetType: 'ALL',
                targetUnitId: undefined,
            });
            unitService.getAll().then(setUnits).catch(() => {});
        }
    }, [isOpen]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.title.trim() || !form.content.trim() || !form.eventDate) {
            toast.error('Título, conteúdo e data do evento são obrigatórios.');
            return;
        }

        if (form.targetType === 'UNIT' && !form.targetUnitId) {
            toast.error('Selecione uma unidade de destino.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: EventFormData = {
                title: form.title.trim(),
                content: form.content.trim(),
                eventDate: form.eventDate,
                targetType: form.targetType,
            };

            if (form.location?.trim()) {
                payload.location = form.location.trim();
            }

            if (form.targetType === 'UNIT') {
                payload.targetUnitId = form.targetUnitId;
            }

            await eventService.create(payload);
            toast.success('Evento criado com sucesso!', {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #22c55e' },
                iconTheme: { primary: '#22c55e', secondary: '#16161f' },
            });
            onSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar evento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isSubmitting && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-bg-card border border-border-primary rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                                    <CalendarDays className="w-5 h-5 text-accent-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-text-primary">
                                        Novo Evento
                                    </h2>
                                    <p className="text-sm text-text-muted">
                                        Crie um evento para o condomínio
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Título */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Título <span className="text-error">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="Ex: Festa Junina do Condomínio"
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                />
                            </div>

                            {/* Conteúdo */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Descrição <span className="text-error">*</span>
                                </label>
                                <textarea
                                    name="content"
                                    value={form.content}
                                    onChange={handleChange}
                                    rows={4}
                                    placeholder="Descreva os detalhes do evento..."
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors resize-none"
                                />
                            </div>

                            {/* Data e Local */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                        Data e Hora <span className="text-error">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        name="eventDate"
                                        value={form.eventDate}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                        Local
                                    </label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={form.location}
                                        onChange={handleChange}
                                        placeholder="Ex: Salão de festas"
                                        className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Público-alvo */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Público-alvo
                                </label>
                                <select
                                    name="targetType"
                                    value={form.targetType}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                >
                                    <option value="ALL">Todos os moradores</option>
                                    <option value="UNIT">Unidade específica</option>
                                </select>
                            </div>

                            {/* Seleção de unidade */}
                            {form.targetType === 'UNIT' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                        Unidade <span className="text-error">*</span>
                                    </label>
                                    <select
                                        name="targetUnitId"
                                        value={form.targetUnitId || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-primary text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 text-sm transition-colors"
                                    >
                                        <option value="">Selecione uma unidade</option>
                                        {units.map((unit) => (
                                            <option key={unit.id} value={unit.id}>
                                                {unit.block ? `${unit.block} - ${unit.number}` : unit.number}
                                            </option>
                                        ))}
                                    </select>
                                </motion.div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded-xl hover:bg-bg-hover transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end rounded-xl hover:shadow-lg hover:shadow-accent-primary/20 transition-all disabled:opacity-60 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Criando...
                                        </>
                                    ) : (
                                        'Criar Evento'
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
