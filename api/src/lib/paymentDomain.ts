import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';

export class PaymentError extends Error {
  constructor(public statusCode: number, message: string, public code = 'PAYMENT_ERROR') {
    super(message);
  }
}

export interface PaymentActor { id: string; role: string; isSyndic?: boolean }

export function canManageInvoices(actor: PaymentActor): boolean {
  return ['ADMIN', 'FUNCIONARIO'].includes(actor.role) || actor.isSyndic === true;
}

export function paymentConfig() {
  const sandbox = process.env.MERCADO_PAGO_SANDBOX;
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  const sellerId = process.env.MERCADO_PAGO_SELLER_ID?.trim();
  if (!['true', 'false'].includes(sandbox ?? '') || !token || !/^\d+$/.test(sellerId ?? '')) {
    throw new PaymentError(503, 'Configuração de pagamentos incompleta.', 'PAYMENT_CONFIG');
  }
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (sandbox === 'false' && !webhookSecret) {
    throw new PaymentError(503, 'Configure a assinatura de webhook antes de emitir pagamentos em produção.', 'WEBHOOK_CONFIG');
  }
  return { token, sellerId: sellerId!, environment: sandbox === 'true' ? 'TEST' : 'PRODUCTION',
    webhookSecret };
}

export function money(value: unknown): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).length > 12 || !/^\d+(\.\d{1,2})?$/.test(String(value))) {
    throw new PaymentError(400, 'Valor deve ser monetário, com até duas casas decimais.');
  }
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite() || decimal.lte(0) || decimal.gt('99999999.99')) {
    throw new PaymentError(400, 'Valor fora dos limites permitidos.');
  }
  return decimal.toFixed(2);
}

export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function idempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new PaymentError(400, 'Envie Idempotency-Key com 16 a 128 caracteres alfanuméricos, hífen ou sublinhado.');
  }
  return value;
}

export function requiredText(value: unknown, label: string, max = 191): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new PaymentError(400, `${label} inválido.`);
  }
  return value.trim();
}

export function validDate(value: unknown, label: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
    throw new PaymentError(400, `${label} inválida.`);
  }
  const date = new Date(value);
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new PaymentError(400, `${label} inválida.`);
  }
  return date;
}

export function mapPaymentStatus(status: string, detail?: string): string {
  if (detail === 'expired' || status === 'expired') return 'EXPIRED';
  if (status === 'processed' && detail === 'accredited') return 'PAID';
  if (status === 'processed' && detail === 'partially_refunded') return 'PARTIALLY_REFUNDED';
  if (['canceled', 'cancelled'].includes(status)) return 'CANCELLED';
  if (status === 'failed' || status === 'rejected') return 'REJECTED';
  if (status === 'refunded') return 'REFUNDED';
  if (status === 'charged_back') return 'CHARGED_BACK';
  if (['created', 'processing', 'action_required', 'pending', 'in_process'].includes(status)) return 'PENDING';
  return 'UNKNOWN';
}

export function verifyWebhookSignature(input: {
  signature?: string; requestId?: string; dataId: unknown; bodyId: unknown; secret?: string;
}, now = Date.now()): string {
  if (!input.secret) throw new PaymentError(503, 'Assinatura de webhook não configurada.', 'WEBHOOK_CONFIG');
  const { signature, requestId, dataId, bodyId } = input;
  if (typeof dataId !== 'string' || !/^ORD[A-Za-z0-9]{1,100}$/.test(dataId) || dataId !== bodyId ||
      !requestId || !/^[A-Za-z0-9-]{1,128}$/.test(requestId) || typeof signature !== 'string') {
    throw new PaymentError(401, 'Notificação inválida.', 'WEBHOOK_SIGNATURE');
  }
  const parts = signature.split(',').map(part => part.trim().split('='));
  const timestamps = parts.filter(([key]) => key === 'ts');
  const signatures = parts.filter(([key]) => key === 'v1');
  const timestamp = timestamps[0]?.[1];
  if (timestamps.length !== 1 || signatures.length !== 1 || !/^\d{10,13}$/.test(timestamp ?? '') ||
      !/^[a-f0-9]{64}$/i.test(signatures[0]?.[1] ?? '')) {
    throw new PaymentError(401, 'Notificação inválida.', 'WEBHOOK_SIGNATURE');
  }
  const timestampMs = Number(timestamp) * (timestamp!.length <= 10 ? 1000 : 1);
  if (timestampMs > now + 300_000) throw new PaymentError(401, 'Notificação inválida.', 'WEBHOOK_SIGNATURE');
  // Entregas legítimas podem ser repetidas dias depois; a caixa de entrada impede replay.
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac('sha256', input.secret).update(manifest).digest();
  if (!timingSafeEqual(expected, Buffer.from(signatures[0]![1]!, 'hex'))) {
    throw new PaymentError(401, 'Notificação inválida.', 'WEBHOOK_SIGNATURE');
  }
  return hash(manifest);
}

export function publicInvoice<T extends Record<string, any>>(invoice: T) {
  const { mpResponse, paymentAttempt, operationId, ...result } = invoice;
  const active = paymentAttempt?.state === 'ACTIVE';
  return { ...result, mpQrCode: active ? invoice.mpQrCode : null, mpQrCodeBase64: active ? invoice.mpQrCodeBase64 : null,
    issuanceStatus: paymentAttempt?.state ?? (invoice.mpOrderId ? 'LEGACY' : 'NOT_ISSUED'),
    paymentEnvironment: paymentAttempt?.environment ?? null,
    paymentAmount: paymentAttempt?.amount?.toString() ?? null,
    paymentExpiresAt: paymentAttempt?.expiresAt ?? null,
    paymentData: { qrCode: active ? invoice.mpQrCode : null, qrCodeBase64: active ? invoice.mpQrCodeBase64 : null,
      boletoUrl: null, ticketUrl: active ? paymentAttempt?.ticketUrl ?? null : null,
      mpOrderId: invoice.mpOrderId, mpStatus: invoice.mpStatus } };
}
