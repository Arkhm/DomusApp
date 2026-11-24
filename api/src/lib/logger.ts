import 'dotenv/config';
import pino from 'pino';

// Registre apenas contexto permitido (IDs e códigos), nunca bodies ou erros brutos.
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: [
      'password', 'newPassword', 'token', 'accessToken', 'refreshToken', 'resetToken',
      '*.password', '*.newPassword', '*.token', '*.accessToken', '*.refreshToken', '*.resetToken',
      'authorization', 'cookie', '["set-cookie"]',
      'headers.authorization', 'headers.cookie', 'headers["set-cookie"]',
      'req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]',
      'req.body', 'body',
    ],
    remove: true,
  },
});
