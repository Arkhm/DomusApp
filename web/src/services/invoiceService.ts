import api from './api';
import type { Invoice, InvoiceBatchInput, InvoiceBatchResult, InvoiceCreateInput, InvoiceFilters, InvoicePage } from '../types/invoice';

const idempotent = (key: string) => ({ headers: { 'Idempotency-Key': key } });

export const invoiceService = {
    async detail(id: string) { return (await api.get(`/invoices/${id}`)).data; },
    async attempts(id: string): Promise<{ id: string; state: string; environment: string; amount: string; createdAt: string }[]> { return (await api.get(`/invoices/${id}/attempts`)).data; },
    async reissue(id: string, reason: string, key: string) { return (await api.post(`/invoices/${id}/reissue`, { reason }, idempotent(key))).data; },
    async audit(id: string): Promise<{ id: string; action: string; reason: string | null; createdAt: string }[]> {
        return (await api.get(`/invoices/${id}/audit`)).data;
    },
    async health(): Promise<Record<string, number | string | null>> { return (await api.get('/invoices/payments/health')).data; },
    async action(id: string, action: string, reason: string) {
        if (action === 'cancel') return (await api.delete(`/invoices/${id}`, { data: { reason } })).data;
        if (action === 'paid') return (await api.put(`/invoices/${id}/status`, { status: 'PAID', reason })).data;
        return (await api.post(`/invoices/${id}/${action}`, { reason })).data;
    },
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
