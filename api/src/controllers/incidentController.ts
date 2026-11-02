import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { incidentService } from '../services/incidentService';
import { IncidentFilters } from '../schemas/incidentSchema';

export const incidentController = {
  async list(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await incidentService.list(req.user!, req.query as IncidentFilters));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await incidentService.getById(req.params.id as string, req.user!));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      res.status(201).json(await incidentService.create(req.body, req.user!.id));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await incidentService.update(req.params.id as string, req.body, req.user!));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
};
