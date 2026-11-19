import { Response } from 'express';
import { petService } from '../services/petService';
import { AuthRequest } from '../middlewares/authMiddleware';

export const petController = {
  async update(req: AuthRequest, res: Response) {
    try {
      res.status(200).json(await petService.update(req.params.id as string, req.body, req.user!));
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const pets = await petService.listAll(req.query);
      res.status(200).json(pets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async listMine(req: AuthRequest, res: Response) {
    try {
      const pets = await petService.listMine(req.user!.id);
      res.status(200).json(pets);
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const pet = await petService.create(req.user!.id, req.body, req.user!.role);
      res.status(201).json(pet);
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await petService.delete(id, req.user!.id, req.user!.role);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(error.statusCode ?? 400).json({ error: error.message });
    }
  },
};
