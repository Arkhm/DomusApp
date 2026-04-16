import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { noticeService } from '../../services/noticeService';
import type { NoticeFormData } from '../../types/notice';

interface NoticeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const emptyForm: NoticeFormData = {
    title: '',
    content: '',
    targetType: 'ALL',
};

export default function NoticeFormModal({ isOpen, onClose, onSuccess }: NoticeFormModalProps) {
    const [form, setForm] = useState<NoticeFormData>(emptyForm);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (field: keyof NoticeFormData, value: any) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!form.title.trim()) {
            toast.error('Título é obrigatório.');
            return;
        }
        if (!form.content.trim()) {
            toast.error('Conteúdo é obrigatório.');
            return;
        }

        setIsSubmitting(true);

        try {
            await noticeService.create(form);
            toast.success('Comunicado enviado com sucesso!', {
                position: 'top-right',
                style: { background: '#16161f', color: '#f0f0f5', border: '1px solid #22c55e' },
                iconTheme: { primary: '#22c55e', secondary: '#16161f' },
            });
            setForm(emptyForm);
            onSuccess();
        } catch (error: any) {
            const message = error.response?.data?.error || 'Erro ao enviar comunicado.';
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setForm(emptyForm);
            onClose();
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
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', duration: 0.35 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-bg-card border border-border-primary rounded-2xl w-full max-w-lg shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-4 border-b border-border-primary sticky top-0 bg-bg-card z-10 rounded-t-2xl">
                            <h2 className="text-lg font-semibold text-text-primary">
                                Novo Comunicado
                            </h2>
                            <button
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-text-secondary">
                                    Título <span className="text-error">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => handleChange('title', e.target.value)}
                                    placeholder="Ex: Manutenção programada no elevador"
                                    className="w-full px-4 py-2.5 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                    autoFocus
                                />
                            </div>

                            {/* Content */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-text-secondary">
                                    Conteúdo <span className="text-error">*</span>
                                </label>
                                <textarea
                                    value={form.content}
                                    onChange={(e) => handleChange('content', e.target.value)}
                                    placeholder="Descreva o comunicado em detalhes..."
                                    rows={6}
                                    className="w-full px-4 py-3 bg-bg-input border border-border-primary rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors resize-none leading-relaxed"
                                />
                                <p className="text-xs text-text-muted text-right">
                                    {form.content.length} caracteres
                                </p>
                            </div>

                            {/* Target */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-text-secondary">
                                    Destinatário
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleChange('targetType', 'ALL')}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                            form.targetType === 'ALL'
                                                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                                                : 'border-border-primary bg-bg-input text-text-secondary hover:text-text-primary hover:border-border-secondary'
                                        }`}
                                    >
                                        <Send className="w-4 h-4" />
                                        Todos os moradores
                                    </button>
                                </div>
                                <p className="text-xs text-text-muted">
                                    O comunicado será enviado para todos os moradores do condomínio.
                                </p>
                            </div>

                            {/* Submit */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-primary">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-primary rounded-xl hover:bg-bg-hover transition-colors"
                                >
                                    Cancelar
                                </button>
                                <motion.button
                                    type="submit"
                                    disabled={isSubmitting}
                                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-accent-gradient-start to-accent-gradient-end rounded-xl shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/30 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Enviar Comunicado
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
