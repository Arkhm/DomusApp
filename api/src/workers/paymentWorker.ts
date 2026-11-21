import { inboxService } from '../services/inboxService';
import { logger } from '../lib/logger';
import 'dotenv/config';
import { paymentRepository } from '../repositories/paymentRepository';
import { paymentService } from '../services/paymentService';
import { PaymentError, paymentConfig } from '../lib/paymentDomain';
import { prisma } from '../lib/prisma';

let stopping = false;
let nextInboxCapture = 0;
process.once('SIGTERM', () => { stopping = true; });
process.once('SIGINT', () => { stopping = true; });

async function main() {
  paymentConfig();
  while (!stopping) {
    try {
      if (Date.now() >= nextInboxCapture) { await inboxService.captureAll().catch(() => logger.error({ code: 'INBOX_CAPTURE_FAILED' }, 'Falha ao atualizar notificações.')); nextInboxCapture = Date.now() + 60000; }
      for (const event of await paymentRepository.dueWebhooks()) {
        if (stopping) break;
        await paymentService.processWebhook(event.id);
      }
      for (const attempt of await paymentRepository.dueAttempts()) {
        if (stopping) break;
        try { await paymentService.issue(attempt.id); }
        catch (error) {
          if (!(error instanceof PaymentError && error.code === 'PAYMENT_BUSY')) throw error;
        }
      }
    } catch (error) {
      logger.error({ code: error instanceof PaymentError ? error.code : 'WORKER_INTERNAL_ERROR' }, 'Falha no worker de pagamentos.');
    }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

main().catch(() => { logger.error({ code: 'WORKER_CONFIGURATION_FAILED' }, 'Falha na configuração do worker de pagamentos.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
