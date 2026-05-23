import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Home, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { unitService } from '../../services/unitService';
import { UNIT_FIELD_LABELS, type UnitType } from '../../types/user';

interface UnitFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function UnitFormModal({ isOpen, onClose, onSuccess }: UnitFormModalProps) {
    const [type, setType] = useState<UnitType>('APARTMENT');
    const [block, setBlock] = useState('');
    const [number, setNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setType('APARTMENT');
            setBlock('');
            setNumber('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const labels = UNIT_FIELD_LABELS[type];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!number.trim()) {
            toast.error(`Informe o ${labels.number.toLowerCase()} da unidade.`);
            return;
        }

        setIsSubmitting(true);

        try {
            await unitService.create({
                type,
                block: block.trim() || undefined,
                number: number.trim(),
            });

            toast.success(
                type === 'HOUSE' ? 'Casa cadastrada com sucesso!' : 'Apartamento cadastrado com sucesso!',
            );

            onSuccess();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao cadastrar unidade.');
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
                                    {type === 'HOUSE' ? <Home className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-text-primary">
                                        {type === 'HOUSE' ? 'Nova Casa' : 'Novo Apartamento'}
                                    </h2>
                                    <p className="text-sm text-text-muted">
                                        Cadastre uma unidade do condomínio
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

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Type toggle */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Tipo de unidade
                                </label>
                                <div
                                    role="radiogroup"
                                    aria-label="Tipo de unidade"
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: 8,
                                    }}
                                >
                                    <TypeOption
                                        active={type === 'APARTMENT'}
                                        icon={<Building2 size={16} />}
                                        label="Apartamento"
                                        helper="Bloco · Número"
                                        onClick={() => setType('APARTMENT')}
                                    />
                                    <TypeOption
                                        active={type === 'HOUSE'}
                                        icon={<Home size={16} />}
                                        label="Casa"
                                        helper="Quadra · Casa"
                                        onClick={() => setType('HOUSE')}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    {labels.block}{' '}
                                    <span className="text-text-muted text-xs font-normal">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={block}
                                    onChange={(e) => setBlock(e.target.value)}
                                    placeholder={type === 'HOUSE' ? 'Ex: Quadra 1' : 'Ex: A'}
                                    maxLength={24}
                                    className="w-full px-4 py-3 bg-bg-input border border-border-primary rounded-xl text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    {labels.number}
                                </label>
                                <input
                                    type="text"
                                    value={number}
                                    onChange={(e) => setNumber(e.target.value)}
                                    placeholder={type === 'HOUSE' ? 'Ex: 12' : 'Ex: 101'}
                                    maxLength={12}
                                    className="w-full px-4 py-3 bg-bg-input border border-border-primary rounded-xl text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="btn-ghost"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="btn-gold"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Salvando…
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

function TypeOption({
    active,
    icon,
    label,
    helper,
    onClick,
}: {
    active: boolean;
    icon: React.ReactNode;
    label: string;
    helper: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={active}
            onClick={onClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                padding: '14px 16px',
                background: active
                    ? 'color-mix(in srgb, var(--color-metal-1) 8%, transparent)'
                    : 'var(--color-ink-1)',
                border: `1px solid ${active ? 'var(--color-metal-1)' : 'var(--color-line-strong)'}`,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: active ? 'var(--color-metal-1)' : 'var(--color-bone)',
                    fontSize: 13,
                    fontWeight: 500,
                }}
            >
                {icon}
                {label}
            </div>
            <div
                className="tracking-luxe"
                style={{ fontSize: 8, color: 'var(--color-bone-muted)' }}
            >
                {helper}
            </div>
        </button>
    );
}
