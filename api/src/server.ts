import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import noticeRoutes from './routes/noticeRoutes';
import unitRoutes from './routes/unitRoutes';
import eventRoutes from './routes/eventRoutes';
import votingRoutes from './routes/votingRoutes';
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/status', (req: Request, res: Response) => {
  res.json({ 
    message: 'DomusApp API está rodando',
    timestamp: new Date().toISOString()
  });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/notices', noticeRoutes);
app.use('/units', unitRoutes);
app.use('/events', eventRoutes);
app.use('/votings', votingRoutes);

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`Servidor backend do DomusApp rodando na porta ${PORT}`);
});