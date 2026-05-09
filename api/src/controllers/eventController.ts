import { Request, Response } from 'express';
import { eventService } from '../services/eventService';

export const eventController = {
  async create(req: Request, res: Response) {
    try {
      const authorId = (req as any).user.id;
      const event = await eventService.create({ ...req.body, authorId });
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const { id, role } = (req as any).user;
      const events = await eventService.listForUser(id, role);
      res.status(200).json(events);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id: eventId } = req.params;
      const { id: userId, role } = (req as any).user;
      const result = await eventService.delete(eventId, userId, role);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};  