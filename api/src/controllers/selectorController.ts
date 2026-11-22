import { Request, Response } from 'express';
import { selectorService } from '../services/selectorService';
export const selectorController = {
  async payers(_req: Request, res: Response) {
    try { res.json(await selectorService.payers()); } catch { res.status(503).json({ error: 'Não foi possível consultar os pagadores.' }); }
  },
  async units(_req: Request, res: Response) {
    try { res.json(await selectorService.units()); } catch { res.status(503).json({ error: 'Não foi possível consultar as unidades.' }); }
  },
};
