import { api } from './api';
import type { Invoice, InvoiceFilter, InvoicePage, InvoiceStats, InvoiceStatus } from '../types/invoice';

export async function listInvoices(status: InvoiceStatus | undefined, page: number): Promise<InvoicePage> {
  const { data } = await api.get<InvoicePage>('/invoices', { params: { status, page, limit: 20 } });
  return data;
}

export async function loadInvoicePage(filter: InvoiceFilter, page: number): Promise<{ invoices: Invoice[]; hasMore: boolean }> {
  // A API aceita um único status; OVERDUE também inclui PENDING vencidas. A união evita perder OVERDUE explícitas.
  const pages = await Promise.all(filter === 'open'
    ? [listInvoices('PENDING', page), listInvoices('OVERDUE', page)]
    : [listInvoices(filter === 'paid' ? 'PAID' : undefined, page)]);
  return {
    invoices: pages.flatMap((result) => result.data),
    hasMore: pages.some((result) => result.meta.page < result.meta.totalPages),
  };
}

export async function getInvoiceStats(): Promise<InvoiceStats> {
  const { data } = await api.get<InvoiceStats>('/invoices/stats');
  return data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get<Invoice>(`/invoices/${encodeURIComponent(id)}`);
  return data;
}
