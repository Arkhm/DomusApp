import fetch from 'node-fetch';
import { PaymentError, mapPaymentStatus, money, paymentConfig } from '../lib/paymentDomain';

export interface PixPayload {
  type: 'online';
  processing_mode: 'automatic';
  external_reference: string;
  total_amount: string;
  payer: { email: string; first_name: string; last_name?: string; identification?: { type: string; number: string } };
  transactions: { payments: Array<{ amount: string; payment_method: { id: 'pix'; type: 'bank_transfer' }; expiration_time: 'PT24H' }> };
  description?: string;
}

export interface MercadoPagoOrder {
  id: string;
  type: string;
  external_reference: string;
  total_amount: string;
  status: string;
  status_detail: string;
  user_id?: string | number;
  currency_id?: string;
  currency?: string;
  country_code?: string;
  live_mode?: boolean;
  version?: number;
  created_date?: string;
  last_updated_date?: string;
  transactions: { payments: Array<{
    id: string; amount: string; status: string; status_detail: string;
    date_of_expiration?: string;
    payment_method: { id: string; type: string; ticket_url?: string; qr_code?: string; qr_code_base64?: string };
  }> };
}

export class MercadoPagoError extends PaymentError {
  constructor(public providerStatus: number, code: string, public retryable: boolean, public retryAfterMs = 0) {
    super(503, 'Não foi possível concluir a operação no Mercado Pago.', code);
  }
}

export function parseOrder(value: unknown): MercadoPagoOrder {
  const order = value as MercadoPagoOrder;
  if (!order || typeof order !== 'object' || !/^ORD[A-Za-z0-9]+$/.test(order.id) ||
      order.type !== 'online' || typeof order.external_reference !== 'string' ||
      typeof order.status !== 'string' || typeof order.status_detail !== 'string' ||
      !Array.isArray(order.transactions?.payments) || order.transactions.payments.length !== 1) {
    throw new MercadoPagoError(502, 'INVALID_PROVIDER_RESPONSE', true);
  }
  try {
    money(order.total_amount);
    const payment = order.transactions.payments[0]!;
    money(payment.amount);
    if (typeof payment.id !== 'string' || !/^PAY[A-Za-z0-9]+$/.test(payment.id) ||
        typeof payment.status !== 'string' || typeof payment.status_detail !== 'string' ||
        payment.payment_method?.id !== 'pix' || payment.payment_method?.type !== 'bank_transfer') {
      throw new Error('Invalid Pix transaction');
    }
  } catch {
    throw new MercadoPagoError(502, 'INVALID_PROVIDER_RESPONSE', true);
  }
  return order;
}

export function buildPixPayload(input: { externalReference: string; amount: string; description: string;
  payer: { name: string; email: string; cpf: string } }, environment: string): PixPayload {
  const test = environment === 'TEST';
  const [firstName, ...lastName] = input.payer.name.trim().split(/\s+/);
  const amount = test ? '50.00' : money(input.amount);
  return {
    type: 'online', processing_mode: 'automatic', external_reference: input.externalReference,
    total_amount: amount,
    payer: test ? { email: 'test_payer@example.com', first_name: 'APRO' } : {
      email: input.payer.email, first_name: firstName!, last_name: lastName.join(' ') || firstName!,
      identification: { type: 'CPF', number: input.payer.cpf.replace(/\D/g, '') },
    },
    ...(test ? {} : { description: input.description }),
    transactions: { payments: [{ amount, payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: 'PT24H' }] },
  };
}

let verifiedAccount: { key: string; until: number } | undefined;

async function request(path: string, method = 'GET', payload?: unknown, key?: string): Promise<unknown> {
  const config = paymentConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      method, redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json',
        ...(key ? { 'X-Idempotency-Key': key } : {}) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      size: 2 * 1024 * 1024,
    });
    const body: any = await response.json().catch(() => null);
    if (!response.ok) {
      const rawCode = body?.errors?.[0]?.code ?? body?.code ?? body?.error;
      const code = typeof rawCode === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(rawCode) ? rawCode : `MP_HTTP_${response.status}`;
      const retryHeader = response.headers.get('retry-after');
      const seconds = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : null;
      const retryAfterMs = seconds === null ? Math.max(0, Date.parse(retryHeader ?? '') - Date.now()) || 0 : seconds * 1000;
      throw new MercadoPagoError(response.status, code, [408, 409, 423, 429].includes(response.status) || response.status >= 500, retryAfterMs);
    }
    if (!body) throw new MercadoPagoError(502, 'INVALID_PROVIDER_RESPONSE', true);
    return body;
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new MercadoPagoError(0, 'MP_NETWORK_ERROR', true);
  } finally { clearTimeout(timeout); }
}

export const mercadoPagoService = {
  async verifyAccount() {
    const config = paymentConfig();
    const cacheKey = `${config.token}:${config.environment}:${config.sellerId}`;
    if (verifiedAccount?.key === cacheKey && verifiedAccount.until > Date.now()) return;
    const account: any = await request('/users/me');
    const testAccount = Array.isArray(account.tags) && account.tags.includes('test_user');
    if (String(account.id) !== config.sellerId || account.site_id !== 'MLB' ||
        testAccount !== (config.environment === 'TEST')) {
      throw new PaymentError(503, 'Credencial incompatível com a conta ou ambiente configurado.', 'ACCOUNT_MISMATCH');
    }
    verifiedAccount = { key: cacheKey, until: Date.now() + 300_000 };
  },
  async createOrder(payload: PixPayload, key: string): Promise<MercadoPagoOrder> {
    await this.verifyAccount();
    return parseOrder(await request('/v1/orders', 'POST', payload, key));
  },
  async getOrder(id: string): Promise<MercadoPagoOrder> {
    if (!/^ORD[A-Za-z0-9]+$/.test(id)) throw new PaymentError(400, 'Identificador de order inválido.');
    await this.verifyAccount();
    return parseOrder(await request(`/v1/orders/${id}`));
  },
  async cancelOrder(id: string, key: string): Promise<MercadoPagoOrder> {
    if (!/^ORD[A-Za-z0-9]+$/.test(id)) throw new PaymentError(400, 'Identificador de order inválido.');
    await this.verifyAccount();
    return parseOrder(await request(`/v1/orders/${id}/cancel`, 'POST', undefined, key));
  },
  async searchOrder(reference: string, createdAt: Date): Promise<MercadoPagoOrder | null> {
    await this.verifyAccount();
    const begin = new Date(createdAt.getTime() - 60_000).toISOString();
    const end = new Date().toISOString();
    const result: any = await request(`/v1/orders?external_reference=${encodeURIComponent(reference)}&begin_date=${encodeURIComponent(begin)}&end_date=${encodeURIComponent(end)}&type=online&page=1&page_size=2`);
    const orders = result?.data;
    if (!Array.isArray(orders)) throw new MercadoPagoError(502, 'INVALID_SEARCH_RESPONSE', true);
    if (orders.length > 1) throw new PaymentError(409, 'Cobranças duplicadas exigem revisão.', 'DUPLICATE_PROVIDER_ORDERS');
    return orders.length ? this.getOrder(orders[0].id) : null;
  },
  mapPaymentStatus,
  extractPaymentData(order: MercadoPagoOrder) {
    const payment = order.transactions.payments[0]!;
    return { paymentId: payment.id, qrCode: payment.payment_method.qr_code ?? null,
      qrCodeBase64: payment.payment_method.qr_code_base64 ?? null, ticketUrl: payment.payment_method.ticket_url ?? null,
      status: order.status, statusDetail: order.status_detail };
  },
};
