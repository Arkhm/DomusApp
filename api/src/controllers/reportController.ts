import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { reportService } from '../services/reportService';

type Report = keyof typeof reportService;
function handle(report: Report) {
  return async (req: AuthRequest, res: Response) => {
    try {
      res.status(200).json(await reportService[report](req.user!, req.query));
    } catch (error: any) {
      const status = error.statusCode ?? 500;
      res.status(status).json({ error: status === 500 ? 'Não foi possível carregar o relatório.' : error.message });
    }
  };
}
export const reportController = {
  occupancy: handle('occupancy'),
  chargesSummary: handle('chargesSummary'),
  incidents: handle('incidents'),
  reservations: handle('reservations'),
};
