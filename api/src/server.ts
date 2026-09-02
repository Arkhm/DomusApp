// Carrega o .env antes de qualquer leitura de process.env neste módulo
// (CORS, cookie e rate limit são configurados a partir dele).
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import noticeRoutes from './routes/noticeRoutes';
import unitRoutes from './routes/unitRoutes';
import eventRoutes from './routes/eventRoutes';
import votingRoutes from './routes/votingRoutes';

const app = express();

// Atrás de proxy (Railway/Render/nginx) o IP real vem em X-Forwarded-For.
// Sem isso o rate limiter contaria todo mundo como o mesmo cliente.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
}

// Headers de segurança: X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, etc. Protege contra clickjacking e MIME sniffing.
app.use(helmet());

// CORS restritivo: só as origens declaradas em ALLOWED_ORIGIN (lista separada
// por vírgula) podem chamar a API. `credentials` é obrigatório para o browser
// enviar/aceitar o cookie httpOnly de sessão.
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requisições sem Origin (curl, Postman, health check) não são cross-site
      // e portanto não passam pelo CORS do browser.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

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

// O `cors()` rejeita origem desconhecida lançando erro. Sem este handler o
// Express responderia 500 em HTML; aqui vira um 403 JSON explícito.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err?.message?.startsWith('Origem não permitida pelo CORS')) {
    res.status(403).json({ error: 'Origem não permitida.' });
    return;
  }
  next(err);
});

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`Servidor backend do DomusApp rodando na porta ${PORT}`);
});
