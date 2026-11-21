import api from './api';
import type { Invoice, InvoiceAudit, InvoiceBatchInput, InvoiceBatchResult, InvoiceCreateInput, InvoiceFilters, InvoicePage } from '../types/invoice';

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
