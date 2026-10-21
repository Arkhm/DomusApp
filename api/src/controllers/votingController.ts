import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { votingService, VotingError } from '../services/votingService';

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

  async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id as string;
      const votings = await votingService.list(userId);
      res.status(200).json(votings);
    } catch (error: any) {
      res.status(error instanceof VotingError ? error.status : 400).json({ error: error.message });
    }
  },

  async vote(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id as string;
      const result = await votingService.vote(id, req.body.optionId, userId);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(error instanceof VotingError ? error.status : 400).json({ error: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await votingService.delete(id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};
