import { Response } from 'express';
import { vehicleService } from '../services/vehicleService';
import { AuthRequest } from '../middlewares/authMiddleware';

export const vehicleController = {
  async update(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await vehicleService.update(req.params.id as string, req.body, req.user!));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const vehicles = await vehicleService.listAll(req.query);
      res.status(200).json(vehicles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async listMine(req: AuthRequest, res: Response) {
    try {
      const vehicles = await vehicleService.listMine(req.user!.id);
      res.status(200).json(vehicles);
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const vehicle = await vehicleService.create(req.user!.id, req.body, req.user!.role);
      res.status(201).json(vehicle);
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await vehicleService.delete(id, req.user!.id, req.user!.role);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
};
