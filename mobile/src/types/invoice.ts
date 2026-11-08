export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'EXPIRED'
  | 'REJECTED' | 'REFUNDED' | 'CHARGED_BACK' | 'PARTIALLY_REFUNDED';

export type InvoiceType = 'MONTHLY_FEE' | 'EXTRAORDINARY' | 'FINE' | 'OTHER';
export type InvoiceFilter = 'open' | 'paid' | 'all';

/** Valores Decimal do Prisma chegam como string; agregações vazias retornam 0. */
export type InvoiceAmount = string | number;

export interface Invoice {
  id: string;
  description: string;
  amount: InvoiceAmount;
  dueDate: string;
  status: InvoiceStatus;
  type: InvoiceType;
  referenceMonth: string | null;
  userId: string;
  unitId: string;
  paidAt: string | null;
  requiresReview: boolean;
  issuanceStatus: string;
  paymentEnvironment: 'TEST' | 'PRODUCTION' | null;
  paymentAmount: string | null;
  paymentExpiresAt: string | null;
  paymentData: {
    qrCode: string | null;
    qrCodeBase64: string | null;
    boletoUrl: null;
    ticketUrl: string | null;
    mpOrderId: string | null;
    mpStatus: string | null;
  };
}

export interface InvoicePage {
  data: Invoice[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface InvoiceStats {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  totalAmount: InvoiceAmount;
  pendingAmount: InvoiceAmount;
}

/** O líder adiciona estas duas entradas a RootStackParamList. */
export type InvoiceStackParamList = {
  Cobrancas: undefined;
  FaturaDetalhe: { invoiceId: string };
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  MONTHLY_FEE: 'Taxa condominial', EXTRAORDINARY: 'Taxa extraordinária', FINE: 'Multa', OTHER: 'Outras cobranças',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: 'Em aberto', PAID: 'Paga', OVERDUE: 'Vencida', CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada', REJECTED: 'Rejeitada', REFUNDED: 'Reembolsada',
  CHARGED_BACK: 'Pagamento contestado', PARTIALLY_REFUNDED: 'Reembolso parcial',
};

export function isInvoiceOverdue(invoice: Invoice, now = Date.now()): boolean {
  return invoice.status === 'OVERDUE' || (invoice.status === 'PENDING' && new Date(invoice.dueDate).getTime() < now);
}

export function invoiceStatusLabel(invoice: Invoice): string {
  return isInvoiceOverdue(invoice) ? 'Vencida' : STATUS_LABELS[invoice.status] ?? 'Status indisponível';
}

/** Vencimentos e referências são datas civis da API, sem deslocar 00:00 UTC para a véspera. */
export function formatInvoiceDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
    : 'Data indisponível';
}

export function canPayInvoice(invoice: Invoice, now = Date.now()): boolean {
  return ['PENDING', 'OVERDUE'].includes(invoice.status) && invoice.issuanceStatus === 'ACTIVE'
    && !invoice.requiresReview
    && (invoice.paymentExpiresAt === null || new Date(invoice.paymentExpiresAt).getTime() > now);
}

export function invoiceTicketUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
