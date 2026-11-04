import { logger } from './lib/logger';
import app from './app';

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Servidor backend do DomusApp iniciado.');
});
