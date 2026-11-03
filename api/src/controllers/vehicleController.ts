import { Response } from 'express';
import { vehicleService } from '../services/vehicleService';
import { AuthRequest } from '../middlewares/authMiddleware';

export const vehicleController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const plate = typeof req.query.plate === 'string' ? req.query.plate : undefined;
      const vehicles = await vehicleService.listAll(plate);
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
      res.status(400).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const vehicle = await vehicleService.create(req.user!.id, req.body);
      res.status(201).json(vehicle);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await vehicleService.delete(id, req.user!.id, req.user!.role);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};
