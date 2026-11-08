import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { parkingSpotService } from '../services/parkingSpotService';
import { ParkingSpotQuery } from '../schemas/parkingSpotSchema';

export const parkingSpotController = {
  async list(req: AuthRequest, res: Response) {
    try { res.status(200).json(await parkingSpotService.list(req.query as ParkingSpotQuery)); }
    catch (error: any) { res.status(error.statusCode ?? 400).json({ error: error.message }); }
  },
  async listMine(req: AuthRequest, res: Response) {
    try { res.status(200).json(await parkingSpotService.listMine(req.user!.id)); }
    catch (error: any) { res.status(error.statusCode ?? 400).json({ error: error.message }); }
  },
  async create(req: AuthRequest, res: Response) {
    try { res.status(201).json(await parkingSpotService.create(req.body)); }
    catch (error: any) { res.status(error.statusCode ?? 400).json({ error: error.message }); }
  },
  async update(req: AuthRequest, res: Response) {
    try { res.status(200).json(await parkingSpotService.update(req.params.id as string, req.body)); }
    catch (error: any) { res.status(error.statusCode ?? 400).json({ error: error.message }); }
  },
  async assign(req: AuthRequest, res: Response) {
    try { res.status(200).json(await parkingSpotService.assign(req.params.id as string, req.body)); }
    catch (error: any) { res.status(error.statusCode ?? 400).json({ error: error.message }); }
  },
  async delete(req: AuthRequest, res: Response) {
    try { res.status(200).json(await parkingSpotService.delete(req.params.id as string)); }
    catch (error: any) { res.status(error.statusCode ?? 400).json({ error: error.message }); }
  },
};
