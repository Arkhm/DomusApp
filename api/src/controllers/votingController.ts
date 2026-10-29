import { Response } from 'express';
import { votingService } from '../services/votingService';
import { AuthRequest } from '../middlewares/authMiddleware';

export const votingController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const authorId = req.user!.id;
      const voting = await votingService.create({ ...req.body, authorId });
      res.status(201).json(voting);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const votings = await votingService.list();
      res.status(200).json(votings);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await votingService.delete(id as string);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};