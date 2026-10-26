import { randomUUID } from 'node:crypto';
import { paymentConfig, PaymentError } from '../src/lib/paymentDomain';
import { buildPixPayload, mercadoPagoService } from '../src/services/mercadoPagoService';

async function main() {
  const config = paymentConfig();
  await mercadoPagoService.verifyAccount();
  console.log(JSON.stringify({ accountVerified: true, environment: config.environment, sellerId: config.sellerId }));
  if (!process.argv.includes('--pix')) return;
  if (config.environment !== 'TEST') throw new PaymentError(400, 'Teste Pix permitido apenas com conta de teste.');
  const reference = randomUUID();
  const payload = buildPixPayload({ externalReference: reference, amount: '50.00', description: 'Verificação da integração',
    payer: { name: 'APRO', email: 'test_payer@example.com', cpf: '' } }, 'TEST');
  const order = await mercadoPagoService.createOrder(payload, reference);
  const replay = await mercadoPagoService.createOrder(payload, reference);
  if (replay.id !== order.id) throw new PaymentError(502, 'Repetição idempotente retornou outra order.');
  const current = await mercadoPagoService.getOrder(order.id);
  console.log(JSON.stringify({ orderId: current.id, status: current.status, statusDetail: current.status_detail,
    amount: current.total_amount, idempotencyVerified: true, hasQrCode: Boolean(current.transactions.payments[0]?.payment_method.qr_code) }));
}

main().catch(error => {
  console.error(JSON.stringify({ error: error instanceof PaymentError ? error.code : 'VERIFICATION_FAILED',
    message: error instanceof PaymentError ? error.message : 'Falha ao verificar integração.' }));
  process.exitCode = 1;
});
