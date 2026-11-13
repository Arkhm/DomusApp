import type { Unit } from './user';

export type InvoiceStatus =
    | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'EXPIRED'
    | 'REJECTED' | 'REFUNDED' | 'CHARGED_BACK' | 'PARTIALLY_REFUNDED';
export type InvoiceType = 'MONTHLY_FEE' | 'EXTRAORDINARY' | 'FINE' | 'OTHER';

export interface Invoice {
    id: string;
    description: string;
    /** Decimal serializado como texto ("350.00"). */
    amount: string;
    /** Dia de calendário gravado à meia-noite UTC. */
    dueDate: string;
    type: InvoiceType;
    status: InvoiceStatus;
    referenceMonth: string | null;
    requiresReview: boolean;
    /** Estado da emissão do Pix: QUEUED, RETRY, ACTIVE, REVIEW… ou NOT_ISSUED / LEGACY. */
    issuanceStatus: string;
    paymentEnvironment: string | null;
    paidAt: string | null;
    createdAt: string;
    userId: string;
    unitId: string;
    user: { id: string; name: string; email: string } | null;
    unit: Unit | null;
}

export interface InvoiceFilters {
    status?: InvoiceStatus;
    type?: InvoiceType;
    unitId?: string;
    /** AAAA-MM-DD, vencimento inicial (inclusivo). */
    startDate?: string;
    /** AAAA-MM-DD, vencimento final (inclusivo). */
    endDate?: string;
    page?: number;
    limit?: number;
}

export interface InvoicePage {
    data: Invoice[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
    PENDING: 'Pendente',
    PAID: 'Paga',
    OVERDUE: 'Vencida',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Expirada',
    REJECTED: 'Recusada',
    REFUNDED: 'Estornada',
    CHARGED_BACK: 'Contestada',
    PARTIALLY_REFUNDED: 'Estorno parcial',
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
    MONTHLY_FEE: 'Taxa condominial',
    EXTRAORDINARY: 'Extraordinária',
    FINE: 'Multa',
    OTHER: 'Outros',
};

export const ISSUANCE_LABELS: Record<string, string> = {
    NOT_ISSUED: 'Sem Pix',
    QUEUED: 'Na fila',
    RETRY: 'Nova tentativa',
    ISSUING: 'Emitindo',
    ACTIVE: 'Pix ativo',
    REVIEW: 'Em revisão',
    LEGACY: 'Legado',
};

/**
 * Uma cobrança pendente com vencimento no passado conta como vencida: é assim
 * que os relatórios e o filtro "Vencida" da API a tratam.
 */
export function effectiveInvoiceStatus(invoice: Pick<Invoice, 'status' | 'dueDate'>, now: Date = new Date()): InvoiceStatus {
    if (invoice.status === 'PENDING' && new Date(invoice.dueDate).getTime() < now.getTime()) return 'OVERDUE';
    return invoice.status;
}
