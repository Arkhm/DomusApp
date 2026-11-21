import { INVOICE_STATUS_LABELS, type InvoiceAudit } from '../types/invoice';

/** Ações que a API grava no histórico, com o texto que a administração entende. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
    CREATE: 'Cobrança criada',
    SEED: 'Dado de demonstração',
    PENDING: 'Pix aguardando pagamento',
    PAID: 'Pagamento confirmado',
    PARTIALLY_REFUNDED: 'Estorno parcial',
    REFUNDED: 'Pagamento estornado',
    CHARGED_BACK: 'Pagamento contestado',
    CANCELLED: 'Pedido cancelado no Mercado Pago',
    EXPIRED: 'Pix expirado',
    REJECTED: 'Pix recusado',
    MANUAL_PAYMENT: 'Baixa manual: paga',
    CANCEL: 'Cobrança cancelada',
    RECONCILE: 'Conciliação com o Mercado Pago',
    RETRY_REQUESTED: 'Reenvio da emissão solicitado',
    REVIEW_REQUIRED: 'Revisão necessária',
    LEGACY_IMPORT: 'Registro legado conciliado',
    PAYMENT_AFTER_MANUAL_SETTLEMENT: 'Pagamento recebido depois da baixa manual',
};

export const AUDIT_SOURCE_LABELS: Record<string, string> = {
    SYSTEM: 'Sistema',
    MANUAL: 'Equipe',
    MERCADO_PAGO: 'Mercado Pago',
    MERCADO_PAGO_TEST: 'Mercado Pago (teste)',
};

export const auditActionLabel = (action: string): string => AUDIT_ACTION_LABELS[action] ?? action;
export const auditSourceLabel = (source: string): string => AUDIT_SOURCE_LABELS[source] ?? source;

const statusLabel = (status: string): string => (INVOICE_STATUS_LABELS as Record<string, string>)[status] ?? status;

/** "Pendente → Paga" quando a situação mudou; vazio quando continuou a mesma. */
export function auditTransition(entry: Pick<InvoiceAudit, 'fromStatus' | 'toStatus'>): string {
    return entry.fromStatus === entry.toStatus ? '' : `${statusLabel(entry.fromStatus)} → ${statusLabel(entry.toStatus)}`;
}

/** Quem fez: o nome do usuário, “Sistema” para registros automáticos ou um aviso quando o usuário não é mais encontrado. */
export function auditActor(entry: Pick<InvoiceAudit, 'actorId' | 'source'>, names: Record<string, string>): string {
    if (!entry.actorId) return auditSourceLabel(entry.source);
    return names[entry.actorId] ?? 'Usuário não encontrado';
}

/** Como a cobrança foi paga: baixa feita pela equipe ou Pix confirmado pelo Mercado Pago. */
export function paymentSourceLabel(source: string | null): string {
    if (source === 'MANUAL') return 'Baixa manual pela equipe';
    if (source === 'MERCADO_PAGO') return 'Pix confirmado pelo Mercado Pago';
    return source ?? '—';
}
