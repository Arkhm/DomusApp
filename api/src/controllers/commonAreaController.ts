import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { commonAreaService } from '../services/commonAreaService';

export const commonAreaController = {
  async list(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await commonAreaService.list(req.user!));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
  async create(req: AuthRequest, res: Response) {
    try {
      res.status(201).json(await commonAreaService.create(req.body));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
  async update(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await commonAreaService.update(req.params.id as string, req.body));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
  async delete(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await commonAreaService.delete(req.params.id as string));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
};
