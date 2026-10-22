import { Response } from 'express';
import fetch from 'node-fetch';
import { invoiceService } from '../services/invoiceService';
import { AuthRequest } from '../middlewares/authMiddleware';

export const invoiceController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const webhookUrl = `${baseUrl}/api/invoices/webhook`;

      const invoice = await invoiceService.create(req.body, baseUrl, webhookUrl);
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async createBatch(req: AuthRequest, res: Response) {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const webhookUrl = `${baseUrl}/api/invoices/webhook`;

      const result = await invoiceService.createBatch(req.body, baseUrl, webhookUrl);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const invoice = await invoiceService.getById(id, userId, userRole);
      res.status(200).json(invoice);
    } catch (error: any) {
      const status = error.message === 'Fatura não encontrada.' ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  },

  async listForUser(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { status, type, startDate, endDate, page, limit } = req.query;

      const filters: any = {};
      if (status) filters.status = status as string;
      if (type) filters.type = type as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (page) filters.page = parseInt(page as string);
      if (limit) filters.limit = parseInt(limit as string);

      const result = await invoiceService.listForUser(userId, filters);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async listForUnit(req: AuthRequest, res: Response) {
    try {
      const unitId = req.params.unitId as string;
      const { status, type, startDate, endDate, page, limit } = req.query;

      const filters: any = {};
      if (status) filters.status = status as string;
      if (type) filters.type = type as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (page) filters.page = parseInt(page as string);
      if (limit) filters.limit = parseInt(limit as string);

      const result = await invoiceService.listForUnit(unitId, filters);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async listAll(req: AuthRequest, res: Response) {
    try {
      const { status, type, userId, unitId, startDate, endDate, page, limit } = req.query;

      const filters: any = {};
      if (status) filters.status = status as string;
      if (type) filters.type = type as string;
      if (userId) filters.userId = userId as string;
      if (unitId) filters.unitId = unitId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (page) filters.page = parseInt(page as string);
      if (limit) filters.limit = parseInt(limit as string);

      const result = await invoiceService.listAll(filters);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (!status) {
        res.status(400).json({ error: 'Status é obrigatório.' });
        return;
      }

      const invoice = await invoiceService.updateStatus(id, status, userId, userRole);
      res.status(200).json(invoice);
    } catch (error: any) {
      const statusCode = error.message === 'Fatura não encontrada.' ? 404 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  },

  async cancel(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const invoice = await invoiceService.cancel(id, userId, userRole);
      res.status(200).json(invoice);
    } catch (error: any) {
      const statusCode = error.message === 'Fatura não encontrada.' ? 404 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  },

  async getUserStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const stats = await invoiceService.getUserStats(userId);
      res.status(200).json(stats);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async getUnitStats(req: AuthRequest, res: Response) {
    try {
      const unitId = req.params.unitId as string;
      const stats = await invoiceService.getUnitStats(unitId);
      res.status(200).json(stats);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async webhook(req: AuthRequest, res: Response) {
    try {
      const { action, data } = req.body;

      if (action === 'payment.updated' || action === 'order.updated') {
        const resourceId = data?.id;
        
        if (resourceId) {
          const mpOrder = await fetch(`${process.env.MERCADO_PAGO_BASE_URL || 'https://api.mercadopago.com'}/v1/orders/${resourceId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
            },
          }).then(r => r.json()) as {
            id: string;
            external_reference?: string;
            status?: string;
            status_detail?: string;
            payments?: any[];
            qr_code?: string;
            qr_code_base64?: string;
            boleto_url?: string;
            preference_id?: string;
          };

          if (mpOrder?.external_reference) {
            await invoiceService.updateFromMercadoPago(mpOrder.id, mpOrder);
          }
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(200).json({ received: true, error: error.message });
    }
  },
};