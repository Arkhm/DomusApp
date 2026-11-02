import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { reservationService } from '../services/reservationService';

export const reservationController = {
  async list(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await reservationService.list(req.user!, req.query));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
  async create(req: AuthRequest, res: Response) {
    try {
      res.status(201).json(await reservationService.create(req.user!, req.body));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
  async approve(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await reservationService.changeStatus(req.params.id as string, req.user!, 'approve'));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
  async reject(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await reservationService.changeStatus(req.params.id as string, req.user!, 'reject', req.body));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
  async cancel(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await reservationService.changeStatus(req.params.id as string, req.user!, 'cancel'));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
};
