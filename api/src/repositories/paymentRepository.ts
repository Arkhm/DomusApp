import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { PaymentError } from '../lib/paymentDomain';

const operationInclude = { invoices: { include: { paymentAttempt: true, unit: true } } } satisfies Prisma.PaymentOperationInclude;

export const paymentRepository = {
  findOperation(keyHash: string) {
    return prisma.paymentOperation.findUnique({ where: { keyHash }, include: operationInclude });
  },
  createOperation(data: Prisma.PaymentOperationCreateInput) {
    return prisma.paymentOperation.create({ data, include: operationInclude });
  },
  async adoptLegacy(input: { invoiceId: string; invoiceVersion: number; actorId: string; reason: string;
    attempt: Prisma.PaymentAttemptCreateWithoutInvoiceInput }) {
    return prisma.$transaction(async tx => {
      const updated = await tx.invoice.updateMany({ where: { id: input.invoiceId, version: input.invoiceVersion },
        data: { version: { increment: 1 }, requiresReview: true } });
      if (!updated.count) throw new PaymentError(409, 'Fatura alterada por outra operação.', 'PAYMENT_BUSY');
      const attempt = await tx.paymentAttempt.create({ data: { ...input.attempt, invoice: { connect: { id: input.invoiceId } } } });
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      await tx.invoiceAudit.create({ data: { invoiceId: invoice.id, actorId: input.actorId, source: 'MANUAL',
        action: 'LEGACY_IMPORT', reason: input.reason, fromStatus: invoice.status, toStatus: invoice.status, amount: attempt.amount } });
      return attempt;
    });
  },
  findAttempt(id: string) {
    return prisma.paymentAttempt.findUnique({ where: { id }, include: { invoice: true } });
  },
  findAttemptForOrder(orderId: string, reference: string) {
    return prisma.paymentAttempt.findFirst({ where: { OR: [{ orderId }, { externalReference: reference }] } });
  },
  audits(invoiceId: string) {
    return prisma.invoiceAudit.findMany({ where: { invoiceId }, orderBy: { createdAt: 'desc' }, take: 100 });
  },
  async health() {
    const [pendingWebhooks, failedWebhooks, paymentsForReview, uncertainPayments, oldestWebhook] = await Promise.all([
      prisma.paymentWebhook.count({ where: { state: 'PENDING' } }),
      prisma.paymentWebhook.count({ where: { state: 'REVIEW' } }),
      prisma.invoice.count({ where: { requiresReview: true } }),
      prisma.paymentAttempt.count({ where: { state: { in: ['QUEUED', 'ISSUING', 'RETRY'] } } }),
      prisma.paymentWebhook.findFirst({ where: { state: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);
    return { pendingWebhooks, failedWebhooks, paymentsForReview, uncertainPayments,
      oldestPendingWebhookAt: oldestWebhook?.createdAt ?? null };
  },
  async claimAttempt(id: string) {
    const lockToken = randomUUID();
    const now = new Date();
    const claimed = await prisma.paymentAttempt.updateMany({
      where: { id, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      data: { lockToken, lockedUntil: new Date(now.getTime() + 120_000) },
    });
    if (!claimed.count) throw new PaymentError(409, 'Pagamento em processamento. Tente novamente.', 'PAYMENT_BUSY');
    return prisma.paymentAttempt.findUniqueOrThrow({ where: { id }, include: { invoice: true } });
  },
  async releaseAttempt(id: string, lockToken: string) {
    await prisma.paymentAttempt.updateMany({ where: { id, lockToken }, data: { lockToken: null, lockedUntil: null } });
  },
  async saveAttempt(input: {
    id: string; lockToken: string; invoiceId: string; invoiceVersion: number;
    attempt: Prisma.PaymentAttemptUpdateManyMutationInput;
    invoice?: Prisma.InvoiceUpdateManyMutationInput;
    audit?: Omit<Prisma.InvoiceAuditUncheckedCreateInput, 'invoiceId'>;
  }) {
    return prisma.$transaction(async tx => {
      const claimed = await tx.paymentAttempt.updateMany({
        where: { id: input.id, lockToken: input.lockToken, lockedUntil: { gt: new Date() } }, data: input.attempt,
      });
      if (!claimed.count) throw new PaymentError(409, 'Operação concorrente. Tente novamente.', 'PAYMENT_BUSY');
      if (input.invoice) {
        const updated = await tx.invoice.updateMany({ where: { id: input.invoiceId, version: input.invoiceVersion },
          data: { ...input.invoice, version: { increment: 1 } } });
        if (!updated.count) throw new PaymentError(409, 'Fatura alterada por outra operação.', 'PAYMENT_BUSY');
      }
      if (input.audit) await tx.invoiceAudit.create({ data: { ...input.audit, invoiceId: input.invoiceId } });
    });
  },
  dueAttempts() {
    return prisma.paymentAttempt.findMany({ where: {
      state: { in: ['QUEUED', 'ISSUING', 'RETRY', 'ACTIVE'] }, retryAt: { lte: new Date() },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
    }, orderBy: { retryAt: 'asc' }, take: 10 });
  },
  async enqueueWebhook(data: Prisma.PaymentWebhookCreateInput) {
    try { return await prisma.paymentWebhook.create({ data }); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      return prisma.paymentWebhook.findUniqueOrThrow({ where: { fingerprint: data.fingerprint } });
    }
  },
  dueWebhooks() {
    return prisma.paymentWebhook.findMany({ where: { state: 'PENDING', retryAt: { lte: new Date() },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] }, orderBy: { retryAt: 'asc' }, take: 10 });
  },
  async claimWebhook(id: string) {
    const lockToken = randomUUID();
    const result = await prisma.paymentWebhook.updateMany({ where: { id, state: 'PENDING',
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
      data: { lockToken, lockedUntil: new Date(Date.now() + 120_000) } });
    return result.count ? prisma.paymentWebhook.findUniqueOrThrow({ where: { id } }) : null;
  },
  finishWebhook(id: string, lockToken: string, data: Prisma.PaymentWebhookUpdateManyMutationInput) {
    return prisma.paymentWebhook.updateMany({ where: { id, lockToken }, data: { ...data, lockToken: null, lockedUntil: null } });
  },
  async auditManualWithoutAttempt(input: { invoiceId: string; version: number; status: string; actorId: string; reason: string }) {
    return prisma.$transaction(async tx => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      if (invoice.mpOrderId || invoice.version !== input.version || invoice.status === 'PAID') {
        throw new PaymentError(409, 'Fatura exige conciliação antes de alteração.', 'REVIEW_REQUIRED');
      }
      const updated = await tx.invoice.updateMany({ where: { id: invoice.id, version: input.version }, data: {
        status: input.status, paymentSource: input.status === 'PAID' ? 'MANUAL' : invoice.paymentSource,
        paidAt: input.status === 'PAID' ? new Date() : invoice.paidAt, version: { increment: 1 },
      } });
      if (!updated.count) throw new PaymentError(409, 'Fatura alterada por outra operação.', 'PAYMENT_BUSY');
      await tx.invoiceAudit.create({ data: { invoiceId: invoice.id, actorId: input.actorId, source: 'MANUAL',
        action: input.status === 'PAID' ? 'MANUAL_PAYMENT' : 'CANCEL', reason: input.reason,
        fromStatus: invoice.status, toStatus: input.status, amount: invoice.amount } });
    });
  },
};
