import { INVOICE_STATUS_LABELS, ISSUANCE_LABELS, type Invoice, type InvoiceStatus } from '../types/invoice';

export type Tone = 'neutral' | 'gold' | 'purple' | 'ok' | 'warn' | 'err';

export function statusTone(status: InvoiceStatus): Tone {
    if (status === 'PAID') return 'ok';
    if (status === 'PENDING') return 'warn';
    if (status === 'OVERDUE') return 'err';
    if (status === 'REFUNDED' || status === 'CHARGED_BACK' || status === 'PARTIALLY_REFUNDED') return 'purple';
    return 'neutral';
}

export function issuanceTone(state: string): Tone {
    if (state === 'ACTIVE') return 'ok';
    if (state === 'QUEUED' || state === 'RETRY' || state === 'ISSUING') return 'warn';
    if (state === 'REVIEW') return 'err';
    return 'neutral';
}

/** Situação do Pix para a pessoa: estados de emissão, ou a situação do pagamento quando o provedor já a registrou. */
export function issuanceLabel(invoice: Pick<Invoice, 'issuanceStatus'>): string {
    const state = invoice.issuanceStatus;
    return ISSUANCE_LABELS[state] ?? INVOICE_STATUS_LABELS[state as InvoiceStatus] ?? state;
}
