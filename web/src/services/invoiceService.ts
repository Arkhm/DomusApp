import api from './api';
import type { InvoiceFilters, InvoicePage } from '../types/invoice';

export const invoiceService = {
    /** `GET /invoices/all` — restrito a ADMIN e FUNCIONARIO. Ordenado por vencimento crescente. */
    async listAll(params: InvoiceFilters = {}): Promise<InvoicePage> {
        const response = await api.get<InvoicePage>('/invoices/all', { params });
        return response.data;
    },
};
