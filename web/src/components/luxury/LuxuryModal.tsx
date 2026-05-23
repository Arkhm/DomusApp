import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface LuxuryModalProps {
    open: boolean;
    onClose: () => void;
    /** Bloqueia o close enquanto uma operação está em andamento (clique no overlay e botão X ficam inertes). */
    busy?: boolean;
    icon: ReactNode;
    title: string;
    subtitle?: string;
    /** Largura máxima do card. Default 'md' (440px). */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children: ReactNode;
}

const SIZE_PX: Record<NonNullable<LuxuryModalProps['size']>, number> = {
    sm: 380,
    md: 440,
    lg: 560,
    xl: 720,
};

/**
 * Shell padrão pros modais luxury — overlay com bone-tinted backdrop,
 * card cream com borda dourada hairline, header com ícone gold + título
 * serif + gold-rule separador.
 *
 * Centraliza o boilerplate (~35 linhas/modal) que estava replicado em
 * UserFormModal, UnitFormModal, NoticeFormModal, EventFormModal e
 * VotingFormModal — antes cada um decidia rounded-2xl/border-primary
 * por conta própria, criando inconsistências visuais sutis.
 *
 * Conteúdo (form + footer) vai como children — o shell não opinia sobre
 * layout interno, só sobre a moldura.
 */
export default function LuxuryModal({
    open,
    onClose,
    busy,
    icon,
    title,
    subtitle,
    size = 'md',
    children,
}: LuxuryModalProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => !busy && onClose()}
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
                        WebkitBackdropFilter: 'blur(4px)',
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: SIZE_PX[size],
                            maxHeight: '90vh',
                            overflow: 'auto',
                            background: 'var(--color-ink-1)',
                            border: '1px solid var(--metal-line)',
                            borderRadius: 4,
                            boxShadow: '0 12px 32px color-mix(in srgb, var(--color-bone) 18%, transparent)',
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '24px 28px 0',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 3,
                                        background: 'color-mix(in srgb, var(--color-metal-1) 8%, transparent)',
                                        border: '1px solid var(--metal-line)',
                                        color: 'var(--color-metal-1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    {icon}
                                </div>
                                <div>
                                    <h2
                                        className="serif"
                                        style={{
                                            fontSize: 22,
                                            fontWeight: 500,
                                            color: 'var(--color-bone)',
                                            lineHeight: 1.15,
                                        }}
                                    >
                                        {title}
                                    </h2>
                                    {subtitle && (
                                        <p
                                            style={{
                                                fontSize: 12,
                                                color: 'var(--color-bone-muted)',
                                                marginTop: 2,
                                            }}
                                        >
                                            {subtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={busy}
                                aria-label="Fechar"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-bone-muted)',
                                    cursor: busy ? 'not-allowed' : 'pointer',
                                    padding: 4,
                                    opacity: busy ? 0.5 : 1,
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="gold-rule" style={{ margin: '20px 28px 0' }} />

                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Footer padronizado pros forms — botão ghost de cancelar + botão gold de
 * submeter. Cuida do estado loading (label customizável + spinner).
 */
interface LuxuryModalFooterProps {
    onCancel: () => void;
    submitLabel: string;
    loadingLabel?: string;
    isSubmitting: boolean;
}

export function LuxuryModalFooter({
    onCancel,
    submitLabel,
    loadingLabel = 'Salvando…',
    isSubmitting,
}: LuxuryModalFooterProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
                paddingTop: 20,
                marginTop: 8,
                borderTop: '1px solid var(--color-line)',
            }}
        >
            <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="btn-ghost"
            >
                Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-gold">
                {isSubmitting ? loadingLabel : submitLabel}
            </button>
        </div>
    );
}
