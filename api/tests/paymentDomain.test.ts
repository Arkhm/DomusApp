import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { money, mapPaymentStatus, verifyWebhookSignature, PaymentError, canManageInvoices,
  validDate, idempotencyKey, publicInvoice, stableJson, paymentConfig } from '../src/lib/paymentDomain';
import { buildPixPayload, parseOrder } from '../src/services/mercadoPagoService';

const id = 'ORD01DOMUS';
const now = 1793020000000;
function signed(ts = String(now)) {
  const signature = createHmac('sha256', 'unit-test-secret').update(`id:${id.toLowerCase()};request-id:req-123;ts:${ts};`).digest('hex');
  return { signature: `ts=${ts},v1=${signature}`, requestId: 'req-123', dataId: id, bodyId: id, secret: 'unit-test-secret' };
}

test('valores monetários são exatos e rejeitam entradas ambíguas', () => {
  assert.equal(money(50), '50.00'); assert.equal(money('123.45'), '123.45');
  for (const value of [0, -1, NaN, Infinity, null, {}, '1e2', '0.001', '100000000', ' 50 ', true, '50,00']) {
    assert.throws(() => money(value), PaymentError);
  }
});

test('mapeia os estados atuais da Orders API', () => {
  for (const [status, detail, expected] of [
    ['processed', 'accredited', 'PAID'], ['processed', 'partially_refunded', 'PARTIALLY_REFUNDED'],
    ['action_required', 'waiting_transfer', 'PENDING'], ['processing', 'in_process', 'PENDING'],
    ['canceled', 'canceled_transaction', 'CANCELLED'], ['canceled', 'expired', 'EXPIRED'],
    ['failed', 'expired', 'EXPIRED'], ['failed', 'failed', 'REJECTED'],
    ['refunded', 'refunded', 'REFUNDED'], ['charged_back', 'settled', 'CHARGED_BACK'], ['novel_status', '', 'UNKNOWN'],
  ]) assert.equal(mapPaymentStatus(status!, detail), expected);
});

test('valida assinatura com ID normalizado, timestamps em segundos e milissegundos', () => {
  verifyWebhookSignature(signed(), now);
  verifyWebhookSignature(signed(String(Math.floor(now / 1000))), now);
  verifyWebhookSignature(signed(String(now - 7 * 86_400_000)), now);
});

test('rejeita adulterações e segredo ausente sem aceitar query e corpo divergentes', () => {
  for (const input of [
    { ...signed(), signature: 'ts=123,v1=x' }, { ...signed(), secret: 'wrong' },
    { ...signed(), bodyId: 'ORDOTHER' }, { ...signed(), dataId: [id] },
    { ...signed(), requestId: undefined }, signed(String(now + 600_000)),
    { ...signed(), signature: signed().signature + ',ts=' + now },
  ]) assert.throws(() => verifyWebhookSignature(input, now), PaymentError);
  assert.throws(() => verifyWebhookSignature({ ...signed(), secret: undefined }, now), (error: any) => error.statusCode === 503);
});

test('síndico é atributo do solicitante; morador comum não administra cobranças', () => {
  assert.equal(canManageInvoices({ id: '1', role: 'MORADOR', isSyndic: true }), true);
  assert.equal(canManageInvoices({ id: '1', role: 'MORADOR' }), false);
  assert.equal(canManageInvoices({ id: '1', role: 'FUNCIONARIO' }), true);
});

test('datas, idempotência e serialização possuem validação determinística', () => {
  assert.equal(validDate('2028-02-29', 'Data').toISOString(), '2028-02-29T00:00:00.000Z');
  assert.equal(validDate('2026-10-26T23:30:00-03:00', 'Data').toISOString(), '2026-10-27T02:30:00.000Z');
  assert.throws(() => validDate('2026-02-30', 'Data'));
  assert.throws(() => validDate(null, 'Data'));
  assert.throws(() => idempotencyKey('short'));
  assert.equal(idempotencyKey('operation-12345678'), 'operation-12345678');
  assert.equal(stableJson({ b: 2, a: [1] }), stableJson({ a: [1], b: 2 }));
});

test('payload congela o valor enviado e mantém a simulação de teste explícita', () => {
  const input = { externalReference: 'invoice-id', amount: '123.45', description: 'Mensalidade',
    payer: { name: 'Maria Silva', email: 'maria@example.com', cpf: '123.456.789-01' } };
  const real = buildPixPayload(input, 'PRODUCTION');
  assert.equal(real.total_amount, '123.45'); assert.equal(real.payer.first_name, 'Maria');
  assert.equal(real.payer.identification?.number, '12345678901');
  assert.equal(real.transactions.payments[0]!.expiration_time, 'PT24H');
  const simulated = buildPixPayload(input, 'TEST');
  assert.equal(simulated.total_amount, '50.00'); assert.equal(simulated.payer.first_name, 'APRO');
  assert.equal(simulated.payer.email, 'test_payer@example.com');
  assert.equal('identification' in simulated.payer, false);
});

test('rejeita respostas inválidas ou com múltiplos pagamentos', () => {
  assert.throws(() => parseOrder({}));
  assert.throws(() => parseOrder({ id, type: 'online', external_reference: 'x', status: 'processed', status_detail: 'accredited',
    total_amount: '50.00', transactions: { payments: [{}, {}] } }));
});

test('DTO não expõe resposta bruta, payload, chave, operação ou QR encerrado', () => {
  const result = publicInvoice({ id: 'i', mpResponse: 'private', operationId: 'private', mpQrCode: 'qr', mpQrCodeBase64: 'image',
    paymentAttempt: { state: 'PAID', requestPayload: { secret: true }, idempotencyKey: 'private', environment: 'TEST', amount: 50 } });
  assert.equal('mpResponse' in result, false); assert.equal('paymentAttempt' in result, false);
  assert.equal('operationId' in result, false); assert.equal(result.paymentData.qrCode, null);
  assert.equal(result.paymentEnvironment, 'TEST');
});

test('configuração explícita bloqueia produção sem assinatura e não infere ambiente pelo token', () => {
  const keys = ['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_SELLER_ID', 'MERCADO_PAGO_SANDBOX', 'MERCADO_PAGO_WEBHOOK_SECRET'];
  const original = keys.map(key => process.env[key]);
  try {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'mock'; process.env.MERCADO_PAGO_SELLER_ID = '123';
    delete process.env.MERCADO_PAGO_SANDBOX;
    assert.throws(() => paymentConfig(), PaymentError);
    process.env.MERCADO_PAGO_SANDBOX = 'false'; delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    assert.throws(() => paymentConfig(), (error: any) => error.code === 'WEBHOOK_CONFIG');
    process.env.MERCADO_PAGO_SANDBOX = 'true';
    assert.equal(paymentConfig().environment, 'TEST');
  } finally { keys.forEach((key, index) => { if (original[index] === undefined) delete process.env[key]; else process.env[key] = original[index]; }); }
});
