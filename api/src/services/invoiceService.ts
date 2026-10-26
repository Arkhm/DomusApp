import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { invoiceRepository } from '../repositories/invoiceRepository';
import { userRepository } from '../repositories/userRepository';
import { unitRepository } from '../repositories/unitRepository';
import { paymentRepository } from '../repositories/paymentRepository';
import { buildPixPayload } from './mercadoPagoService';
import { paymentService } from './paymentService';
import { PaymentActor, PaymentError, canManageInvoices, hash, idempotencyKey, money, paymentConfig,
  publicInvoice, requiredText, stableJson, validDate } from '../lib/paymentDomain';

const VALID_STATUSES = new Set(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'EXPIRED', 'REJECTED', 'REFUNDED', 'CHARGED_BACK', 'PARTIALLY_REFUNDED']);
const VALID_TYPES = new Set(['MONTHLY_FEE', 'EXTRAORDINARY', 'FINE', 'OTHER']);
export interface InvoiceFilters {
  status?: string; type?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number; userId?: string; unitId?: string;
}

function normalize(data: any, batch: boolean) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PaymentError(400, 'Dados da fatura inválidos.');
  const type = data.type ?? 'MONTHLY_FEE';
  if (!VALID_TYPES.has(type)) throw new PaymentError(400, 'Tipo de fatura inválido.');
  const common = { description: requiredText(data.description, 'Descrição'), amount: money(data.amount),
    dueDate: validDate(data.dueDate, 'Data de vencimento').toISOString(), type,
    referenceMonth: data.referenceMonth ? validDate(data.referenceMonth, 'Mês de referência').toISOString() : null };
  if (!batch) return { ...common, userIds: [requiredText(data.userId, 'Usuário')], unitId: requiredText(data.unitId, 'Unidade') };
  if (!Array.isArray(data.userIds) || !data.userIds.length || data.userIds.length > 100) {
    throw new PaymentError(400, 'Informe entre 1 e 100 usuários por lote.');
  }
  const userIds: string[] = data.userIds.map((id: unknown) => requiredText(id, 'Usuário'));
  if (new Set(userIds).size !== userIds.length) throw new PaymentError(400, 'O lote contém usuários repetidos.');
  return { ...common, userIds: userIds.sort(), unitId: null };
}

function validateFilters(filters: InvoiceFilters = {}) {
  if ((filters.status && !VALID_STATUSES.has(filters.status)) || (filters.type && !VALID_TYPES.has(filters.type))) {
    throw new PaymentError(400, 'Filtro inválido.');
  }
  for (const date of [filters.startDate, filters.endDate]) {
    if (date && !Number.isFinite(date.getTime())) throw new PaymentError(400, 'Data de filtro inválida.');
  }
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new PaymentError(400, 'Intervalo de datas inválido.');
  if ((filters.page !== undefined && (!Number.isInteger(filters.page) || filters.page < 1 || filters.page > 100000)) ||
      (filters.limit !== undefined && (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 100))) {
    throw new PaymentError(400, 'Paginação inválida. Use limite entre 1 e 100.');
  }
  return filters;
}

export const invoiceService = {
  async createOperation(data: unknown, key: unknown, actor: PaymentActor, batch: boolean) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    const config = paymentConfig();
    const input = normalize(data, batch);
    const kind = batch ? 'BATCH' : 'SINGLE';
    const keyHash = hash(`${actor.id}:${kind}:${idempotencyKey(key)}`);
    const requestHash = hash(stableJson(input));
    const existing = await paymentRepository.findOperation(keyHash);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new PaymentError(409, 'Idempotency-Key já usada com outros dados.');
      return existing;
    }
    const invoices: Prisma.InvoiceCreateWithoutOperationInput[] = [];
    for (const userId of input.userIds) {
      const user = await userRepository.findById(userId);
      if (!user) throw new PaymentError(400, 'Usuário não encontrado.');
      const unitId = input.unitId ?? user.unitId;
      if (!unitId || user.unitId !== unitId) throw new PaymentError(400, 'Usuário não pertence à unidade informada.');
      if (!await unitRepository.findById(unitId)) throw new PaymentError(400, 'Unidade não encontrada.');
      if (user.status !== 'ACTIVE' || !user.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
          !/^\d{11}$/.test(user.cpf.replace(/\D/g, ''))) throw new PaymentError(400, 'Cadastro do pagador inválido ou inativo.');
      const attemptId = randomUUID();
      const payload = buildPixPayload({ externalReference: attemptId, amount: input.amount,
        description: input.description, payer: { name: user.name, email: user.email, cpf: user.cpf } }, config.environment);
      invoices.push({ id: randomUUID(), description: input.description, amount: input.amount,
        dueDate: new Date(input.dueDate), type: input.type,
        referenceMonth: input.referenceMonth ? new Date(input.referenceMonth) : null,
        user: { connect: { id: userId } }, unit: { connect: { id: unitId } },
        paymentAttempt: { create: { id: attemptId, externalReference: attemptId, idempotencyKey: attemptId,
          amount: payload.total_amount, environment: config.environment, sellerId: config.sellerId,
          requestPayload: payload as unknown as Prisma.InputJsonValue } },
        audits: { create: { actorId: actor.id, source: 'SYSTEM', action: 'CREATE', fromStatus: 'PENDING', toStatus: 'PENDING', amount: input.amount } },
      });
    }
    try {
      return await paymentRepository.createOperation({ keyHash, requestHash, actorId: actor.id, kind,
        invoices: { create: invoices } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await paymentRepository.findOperation(keyHash);
        if (duplicate?.requestHash === requestHash) return duplicate;
        throw new PaymentError(409, 'Idempotency-Key já usada com outros dados.');
      }
      throw error;
    }
  },

  async create(data: unknown, key: unknown, actor: PaymentActor) {
    const operation = await this.createOperation(data, key, actor, false);
    const invoice = operation.invoices[0]!;
    if (invoice.paymentAttempt?.state === 'QUEUED') {
      try { await paymentService.issue(invoice.paymentAttempt.id); }
      catch (error) { if (!(error instanceof PaymentError && error.code === 'PAYMENT_BUSY')) throw error; }
    }
    return publicInvoice((await invoiceRepository.findById(invoice.id))!);
  },

  async createBatch(data: unknown, key: unknown, actor: PaymentActor) {
    const operation = await this.createOperation(data, key, actor, true);
    return { operationId: operation.id, created: operation.invoices.map(publicInvoice), errors: [] };
  },

  async getById(id: string, actor: PaymentActor) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new PaymentError(404, 'Fatura não encontrada.');
    if (!canManageInvoices(actor) && invoice.userId !== actor.id) throw new PaymentError(403, 'Acesso negado a esta fatura.');
    return publicInvoice(invoice);
  },

  async listForUser(userId: string, filters?: InvoiceFilters) {
    const result = await invoiceRepository.findByUserId(userId, validateFilters(filters));
    return { ...result, data: result.data.map(publicInvoice) };
  },

  async listForUnit(unitId: string, filters?: InvoiceFilters) {
    const result = await invoiceRepository.findByUnitId(unitId, validateFilters(filters));
    return { ...result, data: result.data.map(publicInvoice) };
  },

  async listAll(filters?: InvoiceFilters) {
    const result = await invoiceRepository.findAll(validateFilters(filters));
    return { ...result, data: result.data.map(publicInvoice) };
  },

  async updateStatus(id: string, status: unknown, actor: PaymentActor, reason: unknown) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    if (status !== 'PAID' && status !== 'CANCELLED') throw new PaymentError(400, 'Alteração manual permite apenas PAID ou CANCELLED.');
    const justification = requiredText(reason, 'Justificativa', 1000);
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new PaymentError(404, 'Fatura não encontrada.');
    if (invoice.paymentAttempt) await paymentService.manualChange(invoice.paymentAttempt.id, status, actor, justification);
    else await paymentRepository.auditManualWithoutAttempt({ invoiceId: id, version: invoice.version, actorId: actor.id, status, reason: justification });
    return this.getById(id, actor);
  },

  async cancel(id: string, actor: PaymentActor, reason: unknown) {
    return this.updateStatus(id, 'CANCELLED', actor, reason);
  },

  async reconcile(id: string, actor: PaymentActor, reason: unknown) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new PaymentError(404, 'Fatura não encontrada.');
    const justification = requiredText(reason, 'Justificativa', 1000);
    const attempt = invoice.paymentAttempt ?? await paymentService.adoptLegacy(invoice, actor, justification);
    await paymentService.reconcile(attempt.id, actor, justification);
    return this.getById(id, actor);
  },

  async retry(id: string, actor: PaymentActor, reason: unknown) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new PaymentError(404, 'Fatura não encontrada.');
    if (!invoice.paymentAttempt) throw new PaymentError(409, 'Fatura legada exige conferência dos registros no provedor.', 'LEGACY_REVIEW');
    await paymentService.retry(invoice.paymentAttempt.id, actor, requiredText(reason, 'Justificativa', 1000));
    return this.getById(id, actor);
  },

  async health(actor: PaymentActor) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    return paymentRepository.health();
  },

  async audit(id: string, actor: PaymentActor) {
    if (!canManageInvoices(actor)) throw new PaymentError(403, 'Acesso negado.');
    await this.getById(id, actor);
    return paymentRepository.audits(id);
  },

  async getUserStats(userId: string) {
    const [total, pending, paid, overdue, totalAmount, pendingAmount] = await Promise.all([
      invoiceRepository.countByUser(userId), invoiceRepository.countByUser(userId, 'PENDING'),
      invoiceRepository.countByUser(userId, 'PAID'), invoiceRepository.countByUser(userId, 'OVERDUE'),
      invoiceRepository.sumAmountByUser(userId), invoiceRepository.sumAmountByUser(userId, 'PENDING'),
    ]);
    return { total, pending, paid, overdue, totalAmount, pendingAmount };
  },
  getUnitStats(unitId: string) { return invoiceRepository.getStatsByUnit(unitId); },
};
