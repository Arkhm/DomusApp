import { Request, Response } from 'express';
import { unitService } from '../services/unitService';

export const unitController = {

  async list(req: Request, res: Response) {
    try {
      const units = await unitService.listAll();
      res.status(200).json(units);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const unit = await unitService.getById(id);
      res.status(200).json(unit);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const unit = await unitService.create(req.body);
      res.status(201).json(unit);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const unit = await unitService.update(id, req.body);
      res.status(200).json(unit);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const result = await unitService.delete(id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};