import { Response } from 'express';
import { PaymentError } from '../lib/paymentDomain';
import { paymentWebhookService } from '../services/paymentWebhookService';
import { invoiceService } from '../services/invoiceService';
import { AuthRequest } from '../middlewares/authMiddleware';

function respondError(res: Response, error: unknown) {
  if (error instanceof PaymentError) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  console.error('invoice_request_failed', { code: 'INTERNAL_ERROR' });
  res.status(500).json({ error: 'Não foi possível concluir a operação.' });
}

export const invoiceController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const invoice = await invoiceService.create(req.body, req.get('Idempotency-Key'), req.user!);
      res.status(['QUEUED', 'RETRY', 'ISSUING'].includes(invoice.issuanceStatus) ? 202 : 201).json(invoice);
    } catch (error: unknown) {
      respondError(res, error);
    }
  },

  async createBatch(req: AuthRequest, res: Response) {
    try {
      const result = await invoiceService.createBatch(req.body, req.get('Idempotency-Key'), req.user!);
      res.status(202).json(result);
    } catch (error: unknown) {
      respondError(res, error);
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;

      const invoice = await invoiceService.getById(id, req.user!);
      res.status(200).json(invoice);
    } catch (error: unknown) {
      respondError(res, error);
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
      if (page) filters.page = Number(page);
      if (limit) filters.limit = Number(limit);

      const result = await invoiceService.listForUser(userId, filters);
      res.status(200).json(result);
    } catch (error: unknown) {
      respondError(res, error);
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
      if (page) filters.page = Number(page);
      if (limit) filters.limit = Number(limit);

      const result = await invoiceService.listForUnit(unitId, filters);
      res.status(200).json(result);
    } catch (error: unknown) {
      respondError(res, error);
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
      if (page) filters.page = Number(page);
      if (limit) filters.limit = Number(limit);

      const result = await invoiceService.listAll(filters);
      res.status(200).json(result);
    } catch (error: unknown) {
      respondError(res, error);
    }
  },

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const status = req.body?.status;

      if (!status) {
        res.status(400).json({ error: 'Status é obrigatório.' });
        return;
      }

      const invoice = await invoiceService.updateStatus(id, status, req.user!, req.body.reason);
      res.status(200).json(invoice);
    } catch (error: unknown) {
      respondError(res, error);
    }
  },

  async cancel(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;

      const invoice = await invoiceService.cancel(id, req.user!, req.body?.reason);
      res.status(200).json(invoice);
    } catch (error: unknown) {
      respondError(res, error);
    }
  },

  async getUserStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const stats = await invoiceService.getUserStats(userId);
      res.status(200).json(stats);
    } catch (error: unknown) {
      respondError(res, error);
    }
  },

  async getUnitStats(req: AuthRequest, res: Response) {
    try {
      const unitId = req.params.unitId as string;
      const stats = await invoiceService.getUnitStats(unitId);
      res.status(200).json(stats);
    } catch (error: unknown) {
      respondError(res, error);
    }
  },

  async webhook(req: AuthRequest, res: Response) {
    try {
      await paymentWebhookService.receive({ signature: req.get('x-signature'), requestId: req.get('x-request-id'),
        queryId: req.query['data.id'], body: req.body });
      res.status(200).json({ received: true });
    } catch (error: unknown) {
      respondError(res, error);
    }
  },
  async health(req: AuthRequest, res: Response) {
    try { res.json(await invoiceService.health(req.user!)); }
    catch (error) { respondError(res, error); }
  },
  async audit(req: AuthRequest, res: Response) {
    try {
      res.json(await invoiceService.audit(req.params.id as string, req.user!));
    } catch (error) { respondError(res, error); }
  },
  async reconcile(req: AuthRequest, res: Response) {
    try { res.json(await invoiceService.reconcile(req.params.id as string, req.user!, req.body?.reason)); }
    catch (error) { respondError(res, error); }
  },
  async retry(req: AuthRequest, res: Response) {
    try { res.status(202).json(await invoiceService.retry(req.params.id as string, req.user!, req.body?.reason)); }
    catch (error) { respondError(res, error); }
  },
};
