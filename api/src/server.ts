import { mailConfig } from './lib/mailConfig';
import { logger } from './lib/logger';
import app from './app';

mailConfig();

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Servidor backend do DomusApp iniciado.');
});
