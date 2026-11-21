import { invoiceService } from '../services/invoiceService';
import type { Invoice } from '../types/invoice';
import type { ActionKind } from './invoiceActions';

/** Chama o endpoint de cada ação. Cancelar e dar baixa usam o mesmo `PUT /status`, com a situação de destino. */
export function runInvoiceAction(kind: ActionKind, invoiceId: string, reason: string, key?: string): Promise<Invoice> {
    switch (kind) {
        case 'reissue':
            if (!key) throw new Error('Chave de idempotência obrigatória.');
            return invoiceService.reissue(invoiceId, reason, key);
        case 'reconcile': return invoiceService.reconcile(invoiceId, reason);
        case 'retry': return invoiceService.retry(invoiceId, reason);
        case 'markPaid': return invoiceService.setStatus(invoiceId, 'PAID', reason);
        case 'cancel': return invoiceService.setStatus(invoiceId, 'CANCELLED', reason);
    }
}
