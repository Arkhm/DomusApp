import 'dotenv/config';
import { inboxService } from '../services/inboxService';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
let stopping = false;
process.once('SIGTERM', () => { stopping = true; });
process.once('SIGINT', () => { stopping = true; });
async function main() {
  while (!stopping) {
    try { await inboxService.captureAll(); } catch { logger.error({ code: 'INBOX_CAPTURE_FAILED' }, 'Falha ao atualizar notificações.'); }
    for (let seconds = 0; seconds < 60 && !stopping; seconds++) await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
main().finally(() => prisma.$disconnect());
