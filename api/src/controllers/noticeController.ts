import { Response } from 'express';
import { noticeService } from '../services/noticeService';
import { AuthRequest } from '../middlewares/authMiddleware';

export const noticeController = {
  async create(req: AuthRequest, res: Response) {
    try {
      // ID de quem está logado direto do Token JWT
      const authorId = req.user?.id as string;
      
      const noticeData = {
        ...req.body,
        authorId
      };

      const notice = await noticeService.create(noticeData);
      res.status(201).json(notice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      // Pega o ID e o Role pelo token de quem está logado
      const userId = req.user?.id as string;
      const role = req.user?.role as string;

      const notices = await noticeService.listForUser(userId, role);
      res.status(200).json(notices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const userId = req.user?.id as string;
      const userRole = req.user?.role as string;

      const result = await noticeService.delete(id, userId, userRole);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
};