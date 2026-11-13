import api from './api';
import type { Invoice, InvoiceBatchInput, InvoiceBatchResult, InvoiceCreateInput, InvoiceFilters, InvoicePage } from '../types/invoice';

const idempotent = (key: string) => ({ headers: { 'Idempotency-Key': key } });

export const invoiceService = {
    /** `GET /invoices/all` — restrito a ADMIN e FUNCIONARIO. Ordenado por vencimento crescente. */
    async listAll(params: InvoiceFilters = {}): Promise<InvoicePage> {
        const response = await api.get<InvoicePage>('/invoices/all', { params });
        return response.data;
    },

    /**
     * `POST /invoices` — emite uma cobrança. A resposta é 201 com o Pix já ativo ou
     * 202 se a emissão ficou na fila. A mesma `key` com os mesmos dados devolve a
     * cobrança já criada, sem duplicar.
     */
    async create(data: InvoiceCreateInput, key: string): Promise<Invoice> {
        const response = await api.post<Invoice>('/invoices', data, idempotent(key));
        return response.data;
    },

    /** `POST /invoices/batch` — até 100 moradores por lote; a emissão do Pix segue em segundo plano (202). */
    async createBatch(data: InvoiceBatchInput, key: string): Promise<InvoiceBatchResult> {
        const response = await api.post<InvoiceBatchResult>('/invoices/batch', data, idempotent(key));
        return response.data;
    },
};
