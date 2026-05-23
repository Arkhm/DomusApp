import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ChevronDown, Loader2, X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Componentes auxiliares compartilhados pelas páginas de listagem
 * (Residentes / Unidades / Comunicados / Programação / Votações).
 *
 * Antes esses helpers viviam em `pages/Users/UsersList.tsx` e cada página
 * irmã importava de lá — acoplamento ruim que travava qualquer refactor da
 * tela de usuários. Movidos pra cá para todas as listagens compartilharem o
 * mesmo design system luxury sem depender umas das outras.
 */

// ---- FilterSelect ----------------------------------------------------------

interface FilterSelectProps {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    options: { value: string; label: string }[];
}

export function FilterSelect({ value, onChange, placeholder, options }: FilterSelectProps) {
    return (
        <div style={{ position: 'relative', minWidth: 200 }}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="luxe-input"
                style={{
                    appearance: 'none',
                    paddingRight: 36,
                    fontSize: 12,
                    cursor: 'pointer',
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <ChevronDown
                size={12}
                style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-bone-muted)',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}

// ---- ListMeta --------------------------------------------------------------

interface ListMetaProps {
    count: number;
    singular: string;
    plural: string;
    filtered?: boolean;
}

export function ListMeta({ count, singular, plural, filtered }: ListMetaProps) {
    // Concordância: "1 residente encontrado" vs "3 residentes encontrados".
    // Antes saía "1 residente encontrados", quebrando português.
    const suffix = filtered ? (count === 1 ? ' encontrado' : ' encontrados') : '';
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
                color: 'var(--color-bone-muted)',
            }}
        >
            <span style={{ width: 16, height: 1, background: 'var(--metal-line-strong)' }} />
            <span className="tracking-luxe" style={{ fontSize: 9 }}>
                {count} {count === 1 ? singular : plural}{suffix}
            </span>
        </div>
    );
}

// ---- IconBtn ---------------------------------------------------------------

interface IconBtnProps {
    icon: ReactNode;
    onClick?: () => void;
    danger?: boolean;
    title?: string;
}

export function IconBtn({ icon, onClick, danger, title }: IconBtnProps) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                width: 30,
                height: 30,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--color-bone-muted)',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.color = danger ? 'var(--color-err)' : 'var(--color-metal-1)';
                e.currentTarget.style.borderColor = danger
                    ? 'color-mix(in srgb, var(--color-err) 30%, transparent)'
                    : 'var(--metal-line)';
                e.currentTarget.style.background = danger
                    ? 'color-mix(in srgb, var(--color-err) 8%, transparent)'
                    : 'color-mix(in srgb, var(--color-metal-1) 5%, transparent)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-bone-muted)';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.background = 'transparent';
            }}
        >
            {icon}
        </button>
    );
}

// ---- EmptyTable ------------------------------------------------------------

interface EmptyTableProps {
    title: string;
    hint?: string;
}

export function EmptyTable({ title, hint }: EmptyTableProps) {
    return (
        <div
            style={{
                padding: '60px 0',
                textAlign: 'center',
                color: 'var(--color-bone-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
            }}
        >
            <AlertCircle size={28} strokeWidth={1.2} style={{ opacity: 0.5 }} />
            <div className="serif" style={{ fontSize: 18, color: 'var(--color-bone)' }}>
                {title}
            </div>
            {hint && <div style={{ fontSize: 13 }}>{hint}</div>}
        </div>
    );
}

// ---- DeleteModal -----------------------------------------------------------

interface DeleteModalProps {
    open: boolean;
    isDeleting: boolean;
    title: string;
    description: ReactNode;
    onClose: () => void;
    onConfirm: () => void;
}

export function DeleteModal({
    open,
    isDeleting,
    title,
    description,
    onClose,
    onConfirm,
}: DeleteModalProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        background: 'color-mix(in srgb, var(--color-bone) 50%, transparent)',
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => !isDeleting && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 420,
                            background: 'var(--color-ink-1)',
                            border: '1px solid var(--metal-line)',
                            borderRadius: 4,
                            padding: 32,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 16,
                            }}
                        >
                            <h3
                                className="serif"
                                style={{ fontSize: 22, color: 'var(--color-bone)', fontWeight: 500 }}
                            >
                                {title}
                            </h3>
                            <button
                                onClick={onClose}
                                disabled={isDeleting}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-bone-muted)',
                                    cursor: 'pointer',
                                    padding: 4,
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="gold-rule" style={{ marginBottom: 20 }} />
                        <p
                            style={{
                                fontSize: 14,
                                color: 'var(--color-bone-dim)',
                                lineHeight: 1.6,
                                marginBottom: 32,
                            }}
                        >
                            {description}
                        </p>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 12,
                            }}
                        >
                            <button
                                onClick={onClose}
                                disabled={isDeleting}
                                className="btn-ghost"
                                style={{ padding: '10px 18px' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isDeleting}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 18px',
                                    background: 'var(--color-err)',
                                    color: '#FFFFFF',
                                    border: '1px solid var(--color-err)',
                                    borderRadius: 2,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    cursor: isDeleting ? 'wait' : 'pointer',
                                    fontFamily: 'var(--font-sans)',
                                    opacity: isDeleting ? 0.7 : 1,
                                }}
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin" /> Excluindo…
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
    );
}
