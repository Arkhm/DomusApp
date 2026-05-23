import { Request, Response } from 'express';
import { votingService } from '../services/votingService';

export const votingController = {
  async create(req: Request, res: Response) {
    try {
      const authorId = (req as any).user.id;
      const voting = await votingService.create({ ...req.body, authorId });
      res.status(201).json(voting);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const votings = await votingService.list();
      res.status(200).json(votings);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await votingService.delete(id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};
