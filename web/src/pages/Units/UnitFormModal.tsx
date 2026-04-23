import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { unitService } from '../../services/unitService';

interface UnitFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function UnitFormModal({ isOpen, onClose, onSuccess }: UnitFormModalProps) {
    const [block, setBlock] = useState('');
    const [number, setNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setBlock('');
            setNumber('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!number.trim()) {
            toast.error('Informe o número da unidade.', {
                position: 'top-right',
                style: {
                    background: '#16161f',
                    color: '#f0f0f5',
                    border: '1px solid #ef4444',
                },
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await unitService.create({
                block: block.trim() || undefined,
                number: number.trim(),
            });

            toast.success('Unidade cadastrada com sucesso!', {
                position: 'top-right',
                style: {
                    background: '#16161f',
                    color: '#f0f0f5',
                    border: '1px solid #22c55e',
                },
                iconTheme: { primary: '#22c55e', secondary: '#16161f' },
            });

            onSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao cadastrar unidade.', {
                position: 'top-right',
                style: {
                    background: '#16161f',
                    color: '#f0f0f5',
                    border: '1px solid #ef4444',
                },
            });
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
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-bg-card border border-border-primary rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 text-accent-primary flex items-center justify-center">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-text-primary">Nova Unidade</h2>
                                    <p className="text-sm text-text-muted">Cadastre um bloco e número</p>
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

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Bloco
                                </label>
                                <input
                                    type="text"
                                    value={block}
                                    onChange={(e) => setBlock(e.target.value)}
                                    placeholder="Ex: A"
                                    className="w-full px-4 py-3 bg-bg-input border border-border-primary rounded-xl text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Número
                                </label>
                                <input
                                    type="text"
                                    value={number}
                                    onChange={(e) => setNumber(e.target.value)}
                                    placeholder="Ex: 101"
                                    className="w-full px-4 py-3 bg-bg-input border border-border-primary rounded-xl text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 rounded-xl border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white font-medium transition-colors disabled:opacity-60 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        'Cadastrar'
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