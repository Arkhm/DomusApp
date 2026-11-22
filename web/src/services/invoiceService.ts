import api from './api';
import type { Invoice, InvoiceAudit, InvoiceBatchInput, InvoiceBatchResult, InvoiceCreateInput, InvoiceFilters, InvoicePage } from '../types/invoice';

const idempotent = (key: string) => ({ headers: { 'Idempotency-Key': key } });

export const invoiceService = {
    async detail(id: string): Promise<Invoice> { return this.getById(id); },
    async attempts(id: string): Promise<{ id: string; state: string; environment: string; amount: string; createdAt: string }[]> { return (await api.get(`/invoices/${id}/attempts`)).data; },
    async reissue(id: string, reason: string, key: string): Promise<Invoice> { return (await api.post(`/invoices/${id}/reissue`, { reason }, idempotent(key))).data; },
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

    /** `GET /invoices/:id` — dados atuais da cobrança, com o Pix quando ativo. */
    async getById(id: string): Promise<Invoice> {
        const response = await api.get<Invoice>(`/invoices/${id}`);
        return response.data;
    },

    /** `GET /invoices/:id/audit` — histórico (até 100 registros, do mais novo para o mais antigo). */
    async audit(id: string): Promise<InvoiceAudit[]> {
        const response = await api.get<InvoiceAudit[]>(`/invoices/${id}/audit`);
        return response.data;
    },

    /** `POST /invoices/:id/reconcile` — confere o pedido no Mercado Pago e aplica o que encontrar. Exige justificativa. */
    async reconcile(id: string, reason: string): Promise<Invoice> {
        const response = await api.post<Invoice>(`/invoices/${id}/reconcile`, { reason });
        return response.data;
    },

    /** `POST /invoices/:id/retry` (202) — pede nova tentativa de emitir o Pix. Exige justificativa. */
    async retry(id: string, reason: string): Promise<Invoice> {
        const response = await api.post<Invoice>(`/invoices/${id}/retry`, { reason });
        return response.data;
    },

    /**
     * `PUT /invoices/:id/status` — baixa manual: só `PAID` ou `CANCELLED`. Exige justificativa.
     * Cancelar usa este mesmo endpoint (o `DELETE /invoices/:id` da API é um atalho para `CANCELLED`).
     */
    async setStatus(id: string, status: 'PAID' | 'CANCELLED', reason: string): Promise<Invoice> {
        const response = await api.put<Invoice>(`/invoices/${id}/status`, { status, reason });
        return response.data;
    },

    /** `POST /invoices/batch` — até 100 moradores por lote; a emissão do Pix segue em segundo plano (202). */
    async createBatch(data: InvoiceBatchInput, key: string): Promise<InvoiceBatchResult> {
        const response = await api.post<InvoiceBatchResult>('/invoices/batch', data, idempotent(key));
        return response.data;
    },
};
