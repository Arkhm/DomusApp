import { invoiceRepository } from '../repositories/invoiceRepository';
import { userRepository } from '../repositories/userRepository';
import { unitRepository } from '../repositories/unitRepository';
import { mercadoPagoService } from './mercadoPagoService';

const VALID_STATUSES = new Set(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'EXPIRED', 'REJECTED', 'REFUNDED', 'CHARGED_BACK']);
const VALID_TYPES = new Set(['MONTHLY_FEE', 'EXTRAORDINARY', 'FINE', 'OTHER']);

interface CreateInvoiceData {
  description: string;
  amount: number;
  dueDate: Date | string;
  userId: string;
  unitId: string;
  type?: string;
  referenceMonth?: Date | string;
}

interface CreateBatchInvoiceData {
  description: string;
  amount: number;
  dueDate: Date | string;
  type?: string;
  referenceMonth?: Date | string;
  userIds: string[];
}

export const invoiceService = {
  async create(data: CreateInvoiceData, baseUrl: string, webhookUrl: string) {
    if (!data.description || !data.amount || !data.dueDate || !data.userId || !data.unitId) {
      throw new Error('Descrição, valor, data de vencimento, usuário e unidade são obrigatórios.');
    }

    if (data.amount <= 0) {
      throw new Error('O valor deve ser maior que zero.');
    }

    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) {
      throw new Error('Data de vencimento inválida.');
    }

    const user = await userRepository.findById(data.userId);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    const unit = await unitRepository.findById(data.unitId);
    if (!unit) {
      throw new Error('Unidade não encontrada.');
    }

    const type = data.type || 'MONTHLY_FEE';
    if (!VALID_TYPES.has(type)) {
      throw new Error(`Tipo inválido. Use: ${Array.from(VALID_TYPES).join(', ')}`);
    }

    const referenceMonth = data.referenceMonth ? new Date(data.referenceMonth) : null;
    if (referenceMonth && isNaN(referenceMonth.getTime())) {
      throw new Error('Mês de referência inválido.');
    }

    const externalReference = `INV-${Date.now()}-${data.userId.slice(0, 8)}`;

    const payer: any = {
      name: user.name,
      email: user.email,
    };

    if (user.cpf) {
      payer.identification = {
        type: 'CPF',
        number: user.cpf.replace(/\D/g, ''),
      };
    }

    if (user.phone) {
      const phoneDigits = user.phone.replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        payer.phone = {
          area_code: phoneDigits.slice(0, 2),
          number: phoneDigits.slice(2),
        };
      }
    }

    const mpOrder = await mercadoPagoService.createOrder({
      externalReference,
      description: data.description,
      amount: data.amount,
      payer,
      items: [{
        title: data.description,
        description: `Fatura: ${data.description} - Unidade ${unit.block || ''}${unit.number}`,
        quantity: 1,
        unit_price: data.amount.toFixed(2),
      }],
      notificationUrl: webhookUrl,
      expirationDays: 30,
    });

    const paymentData = mercadoPagoService.extractPaymentData(mpOrder);

    const invoice = await invoiceRepository.create({
      description: data.description,
      amount: data.amount,
      dueDate,
      status: 'PENDING',
      type,
      referenceMonth,
      userId: data.userId,
      unitId: data.unitId,
      mpOrderId: mpOrder.id,
      mpPaymentId: paymentData.paymentId,
      mpPreferenceId: mpOrder.preference_id,
      mpStatus: paymentData.status,
      mpStatusDetail: paymentData.statusDetail,
      mpQrCode: paymentData.qrCode,
      mpQrCodeBase64: paymentData.qrCodeBase64,
      mpBoletoUrl: paymentData.boletoUrl,
      mpResponse: JSON.stringify(mpOrder),
    });

    return {
      ...invoice,
      paymentData: {
        qrCode: paymentData.qrCode,
        qrCodeBase64: paymentData.qrCodeBase64,
        boletoUrl: paymentData.boletoUrl,
        mpOrderId: mpOrder.id,
        mpStatus: paymentData.status,
      },
    };
  },

  async createBatch(data: CreateBatchInvoiceData, baseUrl: string, webhookUrl: string) {
    if (!data.description || !data.amount || !data.dueDate || !data.userIds || data.userIds.length === 0) {
      throw new Error('Descrição, valor, data de vencimento e lista de usuários são obrigatórios.');
    }

    if (data.amount <= 0) {
      throw new Error('O valor deve ser maior que zero.');
    }

    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) {
      throw new Error('Data de vencimento inválida.');
    }

    const type = data.type || 'MONTHLY_FEE';
    if (!VALID_TYPES.has(type)) {
      throw new Error(`Tipo inválido. Use: ${Array.from(VALID_TYPES).join(', ')}`);
    }

    const referenceMonth = data.referenceMonth ? new Date(data.referenceMonth) : null;
    if (referenceMonth && isNaN(referenceMonth.getTime())) {
      throw new Error('Mês de referência inválido.');
    }

    const results = {
      created: [] as any[],
      errors: [] as { userId: string; error: string }[],
    };

    for (const userId of data.userIds) {
      try {
        const user = await userRepository.findById(userId);
        if (!user) {
          results.errors.push({ userId, error: 'Usuário não encontrado.' });
          continue;
        }

        if (!user.unitId) {
          results.errors.push({ userId, error: 'Usuário não possui unidade associada.' });
          continue;
        }

        const unit = await unitRepository.findById(user.unitId);
        if (!unit) {
          results.errors.push({ userId, error: 'Unidade do usuário não encontrada.' });
          continue;
        }

        const invoice = await this.create({
          description: data.description,
          amount: data.amount,
          dueDate,
          userId,
          unitId: user.unitId!,
          type,
          referenceMonth: referenceMonth ?? undefined,
        }, baseUrl, webhookUrl);

        results.created.push(invoice);
      } catch (error: any) {
        results.errors.push({ userId, error: error.message });
      }
    }

    return results;
  },

  async getById(id: string, requestingUserId: string, requestingUserRole: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw new Error('Fatura não encontrada.');
    }

    const hasAccess = await this.checkAccess(invoice, requestingUserId, requestingUserRole);
    if (!hasAccess) {
      throw new Error('Acesso negado a esta fatura.');
    }

    return invoice;
  },

  async getByMpOrderId(mpOrderId: string) {
    return await invoiceRepository.findByMpOrderId(mpOrderId);
  },

  async getByMpPaymentId(mpPaymentId: string) {
    return await invoiceRepository.findByMpPaymentId(mpPaymentId);
  },

  async listForUser(userId: string, filters?: {
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    if (filters?.status && !VALID_STATUSES.has(filters.status)) {
      throw new Error(`Status inválido. Use: ${Array.from(VALID_STATUSES).join(', ')}`);
    }

    return await invoiceRepository.findByUserId(userId, filters);
  },

  async listForUnit(unitId: string, filters?: {
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    if (filters?.status && !VALID_STATUSES.has(filters.status)) {
      throw new Error(`Status inválido. Use: ${Array.from(VALID_STATUSES).join(', ')}`);
    }

    return await invoiceRepository.findByUnitId(unitId, filters);
  },

  async listAll(filters?: {
    status?: string;
    type?: string;
    userId?: string;
    unitId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    if (filters?.status && !VALID_STATUSES.has(filters.status)) {
      throw new Error(`Status inválido. Use: ${Array.from(VALID_STATUSES).join(', ')}`);
    }

    return await invoiceRepository.findAll(filters);
  },

  async updateStatus(id: string, status: string, requestingUserId: string, requestingUserRole: string) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Status inválido. Use: ${Array.from(VALID_STATUSES).join(', ')}`);
    }

    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw new Error('Fatura não encontrada.');
    }

    const hasAccess = await this.checkAccess(invoice, requestingUserId, requestingUserRole, true);
    if (!hasAccess) {
      throw new Error('Acesso negado para alterar esta fatura.');
    }

    const updateData: any = { status };
    if (status === 'PAID') {
      updateData.paidAt = new Date();
    }

    return await invoiceRepository.update(id, updateData);
  },

  async updateFromMercadoPago(mpOrderId: string, mpOrder: any) {
    const paymentData = mercadoPagoService.extractPaymentData(mpOrder);
    const newStatus = mercadoPagoService.mapPaymentStatus(paymentData.status, paymentData.statusDetail);

    const updateData: any = {
      mpStatus: paymentData.status,
      mpStatusDetail: paymentData.statusDetail,
      mpResponse: JSON.stringify(mpOrder),
      mpPaymentId: paymentData.paymentId,
    };

    // Só atualiza QR/boleto se vieram na resposta (evita sobrescrever com null)
    if (paymentData.qrCode) updateData.mpQrCode = paymentData.qrCode;
    if (paymentData.qrCodeBase64) updateData.mpQrCodeBase64 = paymentData.qrCodeBase64;
    if (paymentData.boletoUrl) updateData.mpBoletoUrl = paymentData.boletoUrl;

    if (newStatus === 'PAID') {
      updateData.status = 'PAID';
      updateData.paidAt = new Date();
    } else if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(newStatus)) {
      updateData.status = newStatus;
    }

    return await invoiceRepository.updateByMpOrderId(mpOrderId, updateData);
  },

  async cancel(id: string, requestingUserId: string, requestingUserRole: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw new Error('Fatura não encontrada.');
    }

    const hasAccess = await this.checkAccess(invoice, requestingUserId, requestingUserRole, true);
    if (!hasAccess) {
      throw new Error('Acesso negado para cancelar esta fatura.');
    }

    if (invoice.status === 'PAID') {
      throw new Error('Não é possível cancelar uma fatura já paga.');
    }

    return await invoiceRepository.update(id, { status: 'CANCELLED' });
  },

  async getOverdueInvoices() {
    return await invoiceRepository.getOverdueInvoices();
  },

  async getUserStats(userId: string) {
    const [total, pending, paid, overdue, totalAmount, pendingAmount] = await Promise.all([
      invoiceRepository.countByUser(userId),
      invoiceRepository.countByUser(userId, 'PENDING'),
      invoiceRepository.countByUser(userId, 'PAID'),
      invoiceRepository.countByUser(userId, 'OVERDUE'),
      invoiceRepository.sumAmountByUser(userId),
      invoiceRepository.sumAmountByUser(userId, 'PENDING'),
    ]);

    return {
      total,
      pending,
      paid,
      overdue,
      totalAmount,
      pendingAmount,
    };
  },

  async getUnitStats(unitId: string) {
    return await invoiceRepository.getStatsByUnit(unitId);
  },

  async checkAccess(invoice: any, userId: string, userRole: string, isAdminAction = false) {
    if (['ADMIN', 'FUNCIONARIO'].includes(userRole)) {
      return true;
    }

    if (userRole === 'SYNDIC' || invoice.user?.isSyndic) {
      return true;
    }

    if (invoice.userId === userId) {
      return !isAdminAction;
    }

    return false;
  },
};