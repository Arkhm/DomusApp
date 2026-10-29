import { Response } from 'express';
import { eventService } from '../services/eventService';
import { AuthRequest } from '../middlewares/authMiddleware';

export const eventController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const authorId = req.user!.id;
      const event = await eventService.create({ ...req.body, authorId });
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const { id, role } = req.user!;
      const events = await eventService.listForUser(id, role);
      res.status(200).json(events);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const { id: eventId } = req.params;
      const { id: userId, role } = req.user!;
      const result = await eventService.delete(eventId as string, userId, role);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};