import { PaymentAttempt, Invoice, Prisma } from '@prisma/client';
import { paymentRepository } from '../repositories/paymentRepository';
import { PaymentActor, PaymentError, canManageInvoices, hash, money, paymentConfig, requiredText } from '../lib/paymentDomain';
import { MercadoPagoError, MercadoPagoOrder, PixPayload, mercadoPagoService } from './mercadoPagoService';

type LockedAttempt = PaymentAttempt & { invoice: Invoice };
const closedStates = new Set(['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK', 'CANCELLED', 'EXPIRED', 'REJECTED']);

function assertEnvironment(attempt: PaymentAttempt) {
  const config = paymentConfig();
  if (attempt.environment !== config.environment || attempt.sellerId !== config.sellerId) {
    throw new PaymentError(409, 'Pagamento pertence a outra conta ou ambiente.', 'ENVIRONMENT_MISMATCH');
  }
}

function retryDelay(count: number, error: unknown) {
  return Math.max(Math.min(900_000, 5000 * 2 ** Math.min(count, 8)) + Math.floor(Math.random() * 1000),
    error instanceof MercadoPagoError ? error.retryAfterMs : 0);
}

function errorCode(error: unknown) {
  return error instanceof PaymentError ? error.code : 'PAYMENT_INTERNAL_ERROR';
}

export const paymentService = {
  async applyOrder(attempt: LockedAttempt, order: MercadoPagoOrder) {
    assertEnvironment(attempt);
    const invoice = attempt.invoice;
    const payment = order.transactions.payments[0]!;
    const mismatch = order.external_reference !== attempt.externalReference ||
      (attempt.orderId !== null && attempt.orderId !== order.id) ||
      money(order.total_amount) !== attempt.amount.toFixed(2) || money(payment.amount) !== attempt.amount.toFixed(2) ||
      (order.user_id !== undefined && String(order.user_id) !== attempt.sellerId) ||
      (order.currency_id !== undefined && order.currency_id !== 'BRL') ||
      (order.currency !== undefined && order.currency !== 'BRL') ||
      (order.country_code !== undefined && order.country_code !== 'BRA') ||
      (attempt.environment === 'PRODUCTION' && invoice.amount.toFixed(2) !== attempt.amount.toFixed(2));
    if (mismatch) throw new PaymentError(409, 'Dados financeiros divergentes. Revisão necessária.', 'PAYMENT_MISMATCH');

    const providerDate = order.last_updated_date ? new Date(order.last_updated_date) : null;
    const validProviderDate = providerDate && Number.isFinite(providerDate.getTime()) ? providerDate : null;
    const version = Number.isSafeInteger(order.version) ? order.version! : null;
    if ((version !== null && attempt.providerVersion !== null && version < attempt.providerVersion) ||
        (validProviderDate && attempt.providerUpdatedAt && validProviderDate < attempt.providerUpdatedAt)) return;

    const state = mercadoPagoService.mapPaymentStatus(order.status, order.status_detail);
    const transactionState = mercadoPagoService.mapPaymentStatus(payment.status, payment.status_detail);
    if (state === 'UNKNOWN' || (state === 'PAID' && transactionState !== 'PAID') ||
        (state === 'PENDING' && closedStates.has(attempt.state)) ||
        (['REFUNDED', 'CHARGED_BACK', 'PARTIALLY_REFUNDED'].includes(attempt.state) && state === 'PAID')) {
      throw new PaymentError(409, 'Transição de pagamento exige revisão.', 'PAYMENT_STATE_MISMATCH');
    }
    const data = mercadoPagoService.extractPaymentData(order);
    const test = attempt.environment === 'TEST';
    const receivedAfterManual = invoice.paymentSource === 'MANUAL' && ['PAID', 'PARTIALLY_REFUNDED'].includes(state);
    const newStatus = test || invoice.paymentSource === 'MANUAL' ? invoice.status :
      ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK'].includes(state) ? state : invoice.status;
    const changed = invoice.mpStatus !== data.status || invoice.mpStatusDetail !== data.statusDetail || invoice.status !== newStatus;
    const expiration = payment.date_of_expiration ? new Date(payment.date_of_expiration) :
      order.created_date ? new Date(new Date(order.created_date).getTime() + 86_400_000) :
      attempt.expiresAt ?? new Date(attempt.createdAt.getTime() + 86_400_000);
    const invoiceData: Prisma.InvoiceUpdateManyMutationInput = {
      mpOrderId: order.id, mpPaymentId: data.paymentId, mpStatus: data.status, mpStatusDetail: data.statusDetail,
      mpQrCode: data.qrCode, mpQrCodeBase64: data.qrCodeBase64, mpResponse: JSON.stringify(order),
      status: newStatus,
      ...(receivedAfterManual || state === 'PARTIALLY_REFUNDED' ? { requiresReview: true } : {}),
      ...(!test && state === 'PAID' && invoice.paymentSource !== 'MANUAL' ? {
        paymentSource: 'MERCADO_PAGO', paidAt: invoice.paidAt ?? validProviderDate ?? new Date(),
      } : {}),
    };
    await paymentRepository.saveAttempt({ id: attempt.id, lockToken: attempt.lockToken!, invoiceId: invoice.id,
      invoiceVersion: invoice.version,
      attempt: { orderId: order.id, state: state === 'PENDING' ? 'ACTIVE' : state,
        ...(validProviderDate ? { providerUpdatedAt: validProviderDate } : {}),
        ...(version !== null ? { providerVersion: version } : {}),
        ...(expiration && Number.isFinite(expiration.getTime()) ? { expiresAt: expiration } : {}),
        ticketUrl: data.ticketUrl, lastErrorCode: null, retryCount: 0, retryAt: new Date(Date.now() + 900_000) },
      invoice: invoiceData,
      ...(changed ? { audit: { source: test ? 'MERCADO_PAGO_TEST' : 'MERCADO_PAGO',
        action: receivedAfterManual ? 'PAYMENT_AFTER_MANUAL_SETTLEMENT' : state,
        fromStatus: invoice.status, toStatus: newStatus, amount: attempt.amount } } : {}),
    });
  },

  async failAttempt(attempt: LockedAttempt, error: unknown) {
    const count = attempt.retryCount + 1;
    const retryable = error instanceof MercadoPagoError && error.retryable;
    const review = !retryable || count >= 8;
    await paymentRepository.saveAttempt({ id: attempt.id, lockToken: attempt.lockToken!,
      invoiceId: attempt.invoiceId, invoiceVersion: attempt.invoice.version,
      attempt: { state: review ? 'REVIEW' : attempt.orderId ? 'ACTIVE' : 'RETRY', retryCount: count,
        retryAt: new Date(Date.now() + retryDelay(count, error)), lastErrorCode: errorCode(error) },
      ...(review ? { invoice: { requiresReview: true }, audit: { source: 'SYSTEM', action: 'REVIEW_REQUIRED',
        reason: errorCode(error), fromStatus: attempt.invoice.status, toStatus: attempt.invoice.status } } : {}),
    });
    console.error('payment_processing_failed', { attemptId: attempt.id, code: errorCode(error), review });
  },

  async issue(attemptId: string) {
    const attempt = await paymentRepository.claimAttempt(attemptId);
    try {
      assertEnvironment(attempt);
      if (attempt.state === 'REVIEW' || closedStates.has(attempt.state)) return;
      let order: MercadoPagoOrder | null = null;
      if (attempt.orderId) order = await mercadoPagoService.getOrder(attempt.orderId);
      else if (attempt.state === 'ISSUING' || attempt.retryCount > 0 || Date.now() - attempt.createdAt.getTime() > 60_000) {
        order = await mercadoPagoService.searchOrder(attempt.externalReference, attempt.createdAt);
      }
      // Nunca reemitir uma criação incerta fora da janela operacional de recuperação.
      if (!order && Date.now() - attempt.createdAt.getTime() > 86_400_000) {
        throw new PaymentError(409, 'Emissão antiga exige conciliação.', 'STALE_ISSUANCE');
      }
      if (!order) {
        await paymentRepository.saveAttempt({ id: attempt.id, lockToken: attempt.lockToken!, invoiceId: attempt.invoiceId,
          invoiceVersion: attempt.invoice.version, attempt: { state: 'ISSUING' } });
        order = await mercadoPagoService.createOrder(attempt.requestPayload as unknown as PixPayload, attempt.idempotencyKey);
      }
      await this.applyOrder(attempt, order);
    } catch (error) {
      if (error instanceof PaymentError && error.code === 'PAYMENT_BUSY') throw error;
      await this.failAttempt(attempt, error);
    } finally { await paymentRepository.releaseAttempt(attempt.id, attempt.lockToken!); }
  },

  async synchronize(orderId: string, expected?: { sellerId: string; environment: string }) {
    const order = await mercadoPagoService.getOrder(orderId);
    const found = await paymentRepository.findAttemptForOrder(orderId, order.external_reference);
    if (!found) throw new PaymentError(409, 'Order sem tentativa local. Conciliação necessária.', 'UNMATCHED_ORDER');
    const attempt = await paymentRepository.claimAttempt(found.id);
    try {
      if (expected && (expected.sellerId !== attempt.sellerId || expected.environment !== attempt.environment)) {
        throw new PaymentError(409, 'Notificação de outro ambiente.', 'ENVIRONMENT_MISMATCH');
      }
      // Consulta sob a trava para não aplicar uma resposta obtida antes de um cancelamento.
      await this.applyOrder(attempt, await mercadoPagoService.getOrder(orderId));
    } catch (error) {
      if (!(error instanceof MercadoPagoError) && !(error instanceof PaymentError && error.code === 'PAYMENT_BUSY')) {
        await this.failAttempt(attempt, error);
      }
      throw error;
    } finally { await paymentRepository.releaseAttempt(attempt.id, attempt.lockToken!); }
  },

  async manualChange(attemptId: string, status: 'PAID' | 'CANCELLED', actor: PaymentActor, reason: string) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    requiredText(reason, 'Justificativa', 1000);
    const attempt = await paymentRepository.claimAttempt(attemptId);
    try {
      assertEnvironment(attempt);
      if (attempt.invoice.requiresReview || attempt.state === 'REVIEW') {
        throw new PaymentError(409, 'Pagamento exige revisão antes da alteração.', 'REVIEW_REQUIRED');
      }
      if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK'].includes(attempt.state) || attempt.invoice.status === 'PAID') {
        throw new PaymentError(409, 'Pagamento já recebido ou revertido; revisão necessária.');
      }
      let order: MercadoPagoOrder | null = null;
      if (!attempt.orderId && attempt.state !== 'QUEUED') {
        throw new PaymentError(409, 'Emissão ainda não conciliada.', 'REVIEW_REQUIRED');
      }
      if (attempt.orderId) {
        order = await mercadoPagoService.getOrder(attempt.orderId);
        let state = mercadoPagoService.mapPaymentStatus(order.status, order.status_detail);
        if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK'].includes(state)) {
          await this.applyOrder(attempt, order);
          throw new PaymentError(409, 'Pagamento confirmado pelo provedor. A alteração manual não foi aplicada.');
        }
        if (state === 'PENDING') {
          try { await mercadoPagoService.cancelOrder(order.id, hash(`cancel:${attempt.id}`).slice(0, 64)); }
          catch (error) { if (!(error instanceof MercadoPagoError && error.providerStatus === 409)) throw error; }
          order = await mercadoPagoService.getOrder(order.id);
          state = mercadoPagoService.mapPaymentStatus(order.status, order.status_detail);
        }
        if (!['CANCELLED', 'EXPIRED', 'REJECTED'].includes(state)) {
          if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK'].includes(state)) await this.applyOrder(attempt, order);
          throw new PaymentError(409, 'Encerramento do Pix não confirmado. Tente novamente.', 'CANCELLATION_UNCONFIRMED');
        }
        if (order.external_reference !== attempt.externalReference || money(order.total_amount) !== attempt.amount.toFixed(2) ||
            money(order.transactions.payments[0]!.amount) !== attempt.amount.toFixed(2) ||
            (order.user_id !== undefined && String(order.user_id) !== attempt.sellerId)) {
          throw new PaymentError(409, 'Dados do pagamento divergentes.', 'PAYMENT_MISMATCH');
        }
      }
      await paymentRepository.saveAttempt({ id: attempt.id, lockToken: attempt.lockToken!, invoiceId: attempt.invoiceId,
        invoiceVersion: attempt.invoice.version,
        attempt: { state: 'CANCELLED' },
        invoice: { status, ...(status === 'PAID' ? { paymentSource: 'MANUAL', paidAt: new Date() } : {}),
          ...(order ? { mpStatus: order.status, mpStatusDetail: order.status_detail, mpResponse: JSON.stringify(order) } : {}),
          mpQrCode: null, mpQrCodeBase64: null },
        audit: { actorId: actor.id, source: 'MANUAL', action: status === 'PAID' ? 'MANUAL_PAYMENT' : 'CANCEL',
          reason, fromStatus: attempt.invoice.status, toStatus: status, amount: attempt.invoice.amount },
      });
    } finally { await paymentRepository.releaseAttempt(attempt.id, attempt.lockToken!); }
  },

  async processWebhook(id: string) {
    const event = await paymentRepository.claimWebhook(id);
    if (!event) return;
    try {
      await this.synchronize(event.orderId, event);
      await paymentRepository.finishWebhook(event.id, event.lockToken!, { state: 'PROCESSED', processedAt: new Date(), lastErrorCode: null });
    } catch (error) {
      const busy = error instanceof PaymentError && error.code === 'PAYMENT_BUSY';
      const count = event.retryCount + (busy ? 0 : 1);
      await paymentRepository.finishWebhook(event.id, event.lockToken!, { state: count >= 12 ? 'REVIEW' : 'PENDING',
        retryCount: count, retryAt: new Date(Date.now() + retryDelay(count, error)), lastErrorCode: errorCode(error) });
      console.error('payment_webhook_failed', { webhookId: event.id, code: errorCode(error), review: count >= 12 });
    }
  },

  async reconcile(attemptId: string, actor: PaymentActor, reason: string) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    requiredText(reason, 'Justificativa', 1000);
    let attempt = await paymentRepository.claimAttempt(attemptId);
    const token = attempt.lockToken!;
    try {
      assertEnvironment(attempt);
      const order = attempt.orderId ? await mercadoPagoService.getOrder(attempt.orderId) :
        await mercadoPagoService.searchOrder(attempt.externalReference, attempt.createdAt);
      if (!order) throw new PaymentError(409, 'Order ainda não localizada. Nenhuma nova cobrança foi emitida.', 'UNMATCHED_ORDER');
      await this.applyOrder(attempt, order);
      attempt = (await paymentRepository.findAttempt(attempt.id))!;
      if (attempt.state === 'PARTIALLY_REFUNDED' || attempt.invoice.paymentSource === 'MANUAL' ||
          (attempt.invoice.status === 'PAID' && (attempt.state !== 'PAID' || attempt.environment === 'TEST'))) {
        throw new PaymentError(409, 'Revisão financeira manual necessária.', 'REVIEW_REQUIRED');
      }
      await paymentRepository.saveAttempt({ id: attempt.id, lockToken: token, invoiceId: attempt.invoiceId,
        invoiceVersion: attempt.invoice.version, attempt: { lastErrorCode: null }, invoice: { requiresReview: false },
        audit: { actorId: actor.id, source: 'MANUAL', action: 'RECONCILE', reason,
          fromStatus: attempt.invoice.status, toStatus: attempt.invoice.status, amount: attempt.amount } });
    } finally { await paymentRepository.releaseAttempt(attempt.id, token); }
  },

  async adoptLegacy(invoice: Invoice, actor: PaymentActor, reason: string) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    if (!invoice.mpOrderId) throw new PaymentError(409, 'Fatura sem identificador externo para conciliação.', 'LEGACY_REVIEW');
    const config = paymentConfig();
    const order = await mercadoPagoService.getOrder(invoice.mpOrderId);
    if (order.id !== invoice.mpOrderId || !/^[A-Za-z0-9_-]{1,64}$/.test(order.external_reference) ||
        (order.user_id !== undefined && String(order.user_id) !== config.sellerId) ||
        (config.environment === 'PRODUCTION' && money(order.total_amount) !== invoice.amount.toFixed(2))) {
      throw new PaymentError(409, 'Cobrança legada divergente. Conferência financeira necessária.', 'LEGACY_REVIEW');
    }
    return paymentRepository.adoptLegacy({ invoiceId: invoice.id, invoiceVersion: invoice.version, actorId: actor.id, reason,
      attempt: { externalReference: order.external_reference, idempotencyKey: hash(`legacy:${order.id}`),
        amount: money(order.total_amount), environment: config.environment, sellerId: config.sellerId,
        requestPayload: { source: 'LEGACY_IMPORT', originalRequestUnavailable: true }, orderId: order.id, state: 'REVIEW' } });
  },

  async retry(attemptId: string, actor: PaymentActor, reason: string) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    requiredText(reason, 'Justificativa', 1000);
    const attempt = await paymentRepository.claimAttempt(attemptId);
    try {
      assertEnvironment(attempt);
      if (!['REVIEW', 'RETRY'].includes(attempt.state) || attempt.orderId ||
          Date.now() - attempt.createdAt.getTime() > 86_400_000 ||
          ['PAYMENT_MISMATCH', 'PAYMENT_STATE_MISMATCH', 'DUPLICATE_PROVIDER_ORDERS'].includes(attempt.lastErrorCode ?? '')) {
        throw new PaymentError(409, 'Tentativa exige conciliação; reemissão bloqueada.', 'REVIEW_REQUIRED');
      }
      await paymentRepository.saveAttempt({ id: attempt.id, lockToken: attempt.lockToken!, invoiceId: attempt.invoiceId,
        invoiceVersion: attempt.invoice.version,
        attempt: { state: 'RETRY', retryCount: 0, retryAt: new Date(), lastErrorCode: null },
        invoice: { requiresReview: false }, audit: { actorId: actor.id, source: 'MANUAL', action: 'RETRY_REQUESTED', reason,
          fromStatus: attempt.invoice.status, toStatus: attempt.invoice.status } });
    } finally { await paymentRepository.releaseAttempt(attempt.id, attempt.lockToken!); }
  },
};
