import { useEffect, useState } from 'react';
import { Building2, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import { unitService } from '../../services/unitService';
import { UNIT_FIELD_LABELS, type UnitType } from '../../types/user';
import LuxuryModal, { LuxuryModalFooter } from '../../components/luxury/LuxuryModal';
import { apiErrorMessage } from '../../lib/apiError';

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
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Erro ao cadastrar unidade.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <LuxuryModal
            open={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            icon={type === 'HOUSE' ? <Home size={18} strokeWidth={1.4} /> : <Building2 size={18} strokeWidth={1.4} />}
            title={type === 'HOUSE' ? 'Nova Casa' : 'Novo Apartamento'}
            subtitle="Cadastre uma unidade do condomínio"
            size="md"
        >
            <form onSubmit={handleSubmit} style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Type toggle */}
                <Field label="Tipo de unidade">
                    <div role="radiogroup" aria-label="Tipo de unidade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                            helper="Quadra · Lote"
                            onClick={() => setType('HOUSE')}
                        />
                    </div>
                </Field>

                <Field label={`${labels.block}`} optional>
                    <input
                        type="text"
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                        placeholder={type === 'HOUSE' ? 'Ex: Quadra 1' : 'Ex: A'}
                        maxLength={24}
                        className="luxe-input"
                    />
                </Field>

                <Field label={labels.number}>
                    <input
                        type="text"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder={type === 'HOUSE' ? 'Ex: 12' : 'Ex: 101'}
                        maxLength={12}
                        className="luxe-input"
                    />
                </Field>

                <LuxuryModalFooter
                    onCancel={onClose}
                    submitLabel="Cadastrar"
                    loadingLabel="Salvando…"
                    isSubmitting={isSubmitting}
                />
            </form>
        </LuxuryModal>
    );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label
                className="tracking-luxe"
                style={{
                    display: 'block',
                    fontSize: 9,
                    color: 'var(--color-bone-dim)',
                    marginBottom: 8,
                }}
            >
                {label}
                {optional && (
                    <span style={{ marginLeft: 8, color: 'var(--color-bone-muted)', letterSpacing: 0, textTransform: 'none' }}>
                        (opcional)
                    </span>
                )}
            </label>
            {children}
        </div>
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
            <div className="tracking-luxe" style={{ fontSize: 8, color: 'var(--color-bone-muted)' }}>
                {helper}
            </div>
        </button>
    );
}
