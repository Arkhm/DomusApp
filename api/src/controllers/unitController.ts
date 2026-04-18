import { Request, Response } from 'express';
import { unitService } from '../services/unitService';

export const unitController = {
  async create(req: Request, res: Response) {
    try {
      const unit = await unitService.create(req.body);
      res.status(201).json(unit);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const units = await unitService.listAll();
      res.status(200).json(units);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      // as string para resolver erro de tipagem do TypeScript
      const id = req.params.id as string; 
      
      const result = await unitService.delete(id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};