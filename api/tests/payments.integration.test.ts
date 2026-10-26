import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma';
import { invoiceService } from '../src/services/invoiceService';
import { paymentService } from '../src/services/paymentService';
import { paymentRepository } from '../src/repositories/paymentRepository';
import { paymentWebhookService } from '../src/services/paymentWebhookService';
import { mercadoPagoService, MercadoPagoError, MercadoPagoOrder } from '../src/services/mercadoPagoService';
import invoiceRoutes from '../src/routes/invoiceRoutes';

const enabled = process.env.RUN_PAYMENT_INTEGRATION === 'true';
const actor = { id: randomUUID(), role: 'MORADOR', isSyndic: true };
const prefix = randomUUID();
const sellerId = '123456';
const orders = new Map<string, MercadoPagoOrder>();
let creates = 0;
let failCreate = false;
let failCancel = false;
let paidAtCancellation = false;
let failRead = false;
let rejectCreate = false;
function newOrder(payload: any): MercadoPagoOrder {
  return { id: `ORD${randomUUID().replaceAll('-', '')}`, type: 'online', external_reference: payload.external_reference,
    total_amount: payload.total_amount, user_id: sellerId, country_code: 'BRA', currency_id: 'BRL',
    status: 'action_required', status_detail: 'waiting_transfer', version: 1,
    created_date: new Date().toISOString(), last_updated_date: new Date().toISOString(),
    transactions: { payments: [{ id: `PAY${randomUUID().replaceAll('-', '')}`, amount: payload.total_amount,
      status: 'action_required', status_detail: 'waiting_transfer',
      payment_method: { id: 'pix', type: 'bank_transfer', qr_code: 'qr-payload', qr_code_base64: 'image', ticket_url: 'https://www.mercadopago.com.br/ticket' } }] } };
}
function state(order: MercadoPagoOrder, status: string, detail: string) {
  order.status = status; order.status_detail = detail; order.version = (order.version ?? 1) + 1;
  order.last_updated_date = new Date().toISOString();
  Object.assign(order.transactions.payments[0]!, { status, status_detail: detail });
  return order;
}

test('pagamentos com MySQL isolado', { skip: !enabled }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/);
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'test-only-mocked-token';
  process.env.MERCADO_PAGO_SANDBOX = 'false';
  process.env.MERCADO_PAGO_SELLER_ID = sellerId;
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'integration-test-secret';
  process.env.JWT_SECRET = 'integration-test-jwt';
  const unit = await prisma.unit.create({ data: { number: prefix, type: 'APARTMENT' } });
  const user = await prisma.user.create({ data: { name: 'Morador Teste', email: `${prefix}@example.com`, cpf: prefix,
    password: 'unused-test-hash', unitId: unit.id } });
  await prisma.user.update({ where: { id: user.id }, data: { cpf: '12345678901' } });
  const input = { description: 'Mensalidade', amount: 123.45, dueDate: '2026-11-10', userId: user.id, unitId: unit.id };
  t.mock.method(mercadoPagoService, 'verifyAccount', async () => {});
  t.mock.method(mercadoPagoService, 'createOrder', async (payload: any, key: string) => {
    if (rejectCreate) throw new MercadoPagoError(400, 'INVALID_PAYER', false);
    assert.equal(key, payload.external_reference);
    assert.ok(await prisma.paymentAttempt.findUnique({ where: { externalReference: payload.external_reference } }));
    let order = [...orders.values()].find(o => o.external_reference === payload.external_reference);
    if (!order) { order = newOrder(payload); orders.set(order.id, order); creates++; }
    if (failCreate) throw new MercadoPagoError(0, 'MP_NETWORK_ERROR', true);
    await new Promise(resolve => setTimeout(resolve, 20));
    return structuredClone(order);
  });
  t.mock.method(mercadoPagoService, 'getOrder', async (id: string) => {
    if (failRead) throw new MercadoPagoError(429, 'too_many_requests', true, 120_000);
    const order = orders.get(id); assert.ok(order); return structuredClone(order);
  });
  t.mock.method(mercadoPagoService, 'searchOrder', async (ref: string) => {
    const order = [...orders.values()].find(o => o.external_reference === ref);
    return order ? structuredClone(order) : null;
  });
  t.mock.method(mercadoPagoService, 'cancelOrder', async (id: string) => {
    if (failCancel) throw new MercadoPagoError(0, 'MP_NETWORK_ERROR', true);
    const order = orders.get(id)!;
    return structuredClone(state(order, paidAtCancellation ? 'processed' : 'canceled', paidAtCancellation ? 'accredited' : 'canceled_transaction'));
  });

  await t.test('criação concorrente repete a mesma fatura e uma única cobrança', async () => {
    const key = randomUUID(); const before = creates;
    const results = await Promise.all(Array.from({ length: 5 }, () => invoiceService.create(input, key, actor)));
    assert.equal(new Set(results.map(r => r.id)).size, 1);
    assert.equal(creates - before, 1);
    assert.equal((await invoiceService.getById(results[0]!.id, actor)).issuanceStatus, 'ACTIVE');
    await assert.rejects(() => invoiceService.create({ ...input, amount: 99 }, key, actor), (e: any) => e.statusCode === 409);
    await assert.rejects(() => invoiceService.getById(results[0]!.id, { id: 'other', role: 'MORADOR' }), (e: any) => e.statusCode === 403);
  });

  await t.test('timeout após criar order recupera por referência sem nova emissão', async () => {
    failCreate = true;
    const invoice = await invoiceService.create(input, randomUUID(), actor);
    assert.equal(invoice.issuanceStatus, 'RETRY');
    failCreate = false; const before = creates;
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    await paymentService.issue(attempt.id);
    assert.equal(creates, before);
    assert.equal((await invoiceService.getById(invoice.id, actor)).issuanceStatus, 'ACTIVE');
  });

  await t.test('webhook deduplica, processa ordem paga e preserva paidAt na repetição', async () => {
    const invoice = await invoiceService.create(input, randomUUID(), actor);
    const order = orders.get(invoice.mpOrderId!)!; state(order, 'processed', 'accredited');
    const body = { type: 'order', action: 'order.processed', user_id: sellerId, live_mode: true,
      date_created: new Date().toISOString(), data: { id: order.id, version: order.version } };
    const ts = String(Date.now()); const reqId = randomUUID();
    const hmac = createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET!).update(`id:${order.id.toLowerCase()};request-id:${reqId};ts:${ts};`).digest('hex');
    const request = { signature: `ts=${ts},v1=${hmac}`, requestId: reqId, queryId: order.id, body };
    await Promise.all([paymentWebhookService.receive(request), paymentWebhookService.receive(request)]);
    await paymentWebhookService.receive({ ...request, body: { ...body, action: 'order.updated', id: 'modified-unsigned-field' } });
    const events = await prisma.paymentWebhook.findMany({ where: { orderId: order.id } });
    assert.equal(events.length, 1);
    await paymentService.processWebhook(events[0]!.id);
    const first = await invoiceService.getById(invoice.id, actor);
    assert.equal(first.status, 'PAID'); assert.equal(first.paymentSource, 'MERCADO_PAGO');
    await paymentService.synchronize(order.id);
    assert.equal((await invoiceService.getById(invoice.id, actor)).paidAt?.getTime(), first.paidAt?.getTime());
    state(order, 'refunded', 'refunded'); await paymentService.synchronize(order.id);
    assert.equal((await invoiceService.getById(invoice.id, actor)).status, 'REFUNDED');
  });

  await t.test('divergência de valor impede baixa e sinaliza revisão', async () => {
    const invoice = await invoiceService.create(input, randomUUID(), actor);
    const order = orders.get(invoice.mpOrderId!)!;
    state(order, 'processed', 'accredited'); order.total_amount = '1.00';
    await assert.rejects(() => paymentService.synchronize(order.id));
    const result = await invoiceService.getById(invoice.id, actor);
    assert.equal(result.status, 'PENDING'); assert.equal(result.requiresReview, true);
    assert.equal(result.issuanceStatus, 'REVIEW');
    order.total_amount = '123.45';
    await invoiceService.reconcile(invoice.id, actor, 'Valor conferido no provedor');
    const reconciled = await invoiceService.getById(invoice.id, actor);
    assert.equal(reconciled.status, 'PAID'); assert.equal(reconciled.requiresReview, false);
  });

  await t.test('expiração do Pix mantém a dívida e permite baixa manual auditada', async () => {
    const invoice = await invoiceService.create(input, randomUUID(), actor);
    const order = orders.get(invoice.mpOrderId!)!; state(order, 'canceled', 'expired');
    await paymentService.synchronize(order.id);
    let result = await invoiceService.getById(invoice.id, actor);
    assert.equal(result.issuanceStatus, 'EXPIRED'); assert.equal(result.status, 'PENDING');
    result = await invoiceService.updateStatus(invoice.id, 'PAID', actor, 'Recebido por transferência externa');
    assert.equal(result.status, 'PAID'); assert.equal(result.paymentSource, 'MANUAL');
    const audits = await paymentRepository.audits(invoice.id);
    assert.ok(audits.some(a => a.action === 'MANUAL_PAYMENT' && a.actorId === actor.id));
  });

  await t.test('baixa manual exige cancelamento confirmado e justificativa', async () => {
    const invoice = await invoiceService.create(input, randomUUID(), actor);
    await assert.rejects(() => invoiceService.updateStatus(invoice.id, 'PAID', actor, ''));
    failCancel = true;
    await assert.rejects(() => invoiceService.updateStatus(invoice.id, 'PAID', actor, 'Recebido em espécie'));
    assert.equal((await invoiceService.getById(invoice.id, actor)).status, 'PENDING');
    failCancel = false;
    const result = await invoiceService.updateStatus(invoice.id, 'PAID', actor, 'Recebido em espécie');
    assert.equal(result.status, 'PAID'); assert.equal(orders.get(invoice.mpOrderId!)!.status, 'canceled');
  });

  await t.test('pagamento durante cancelamento impede baixa manual', async () => {
    const invoice = await invoiceService.create(input, randomUUID(), actor);
    paidAtCancellation = true;
    await assert.rejects(() => invoiceService.updateStatus(invoice.id, 'PAID', actor, 'Recebido em espécie'));
    paidAtCancellation = false;
    await paymentService.synchronize(invoice.mpOrderId!);
    assert.equal((await invoiceService.getById(invoice.id, actor)).paymentSource, 'MERCADO_PAGO');
  });

  await t.test('lote persiste antes da emissão, rejeita duplicatas e reusa a operação', async () => {
    const key = randomUUID();
    const data = { description: 'Lote', amount: 50, dueDate: '2026-11-10', userIds: [user.id] };
    const first = await invoiceService.createBatch(data, key, actor);
    const second = await invoiceService.createBatch(data, key, actor);
    assert.equal(first.operationId, second.operationId);
    assert.equal(first.created[0]!.issuanceStatus, 'QUEUED');
    await assert.rejects(() => invoiceService.createBatch({ ...data, userIds: [user.id, user.id] }, randomUUID(), actor));
  });

  await t.test('simulação de R$ 50 não quita dívida com o valor da fatura', async () => {
    process.env.MERCADO_PAGO_SANDBOX = 'true';
    try {
      const invoice = await invoiceService.create(input, randomUUID(), actor);
      const order = orders.get(invoice.mpOrderId!)!; state(order, 'processed', 'accredited');
      await paymentService.synchronize(order.id);
      const result = await invoiceService.getById(invoice.id, actor);
      assert.equal(result.paymentEnvironment, 'TEST'); assert.equal(result.paymentAmount, '50');
      assert.equal(result.status, 'PENDING'); assert.equal(result.issuanceStatus, 'PAID');
    } finally { process.env.MERCADO_PAGO_SANDBOX = 'false'; }
  });

  await t.test('notificação anterior à gravação da resposta recupera a tentativa persistida', async () => {
    const batch = await invoiceService.createBatch({ description: 'Webhook antecipado', amount: 50, dueDate: '2026-11-10', userIds: [user.id] }, randomUUID(), actor);
    const invoice = batch.created[0]!;
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    const order = newOrder(attempt.requestPayload); orders.set(order.id, order);
    const before = creates;
    await paymentService.synchronize(order.id);
    await paymentService.issue(attempt.id);
    const result = await invoiceService.getById(invoice.id, actor);
    assert.equal(result.mpOrderId, order.id); assert.equal(result.issuanceStatus, 'ACTIVE'); assert.equal(creates, before);
  });

  await t.test('resposta antiga não regride pagamento já confirmado', async () => {
    const invoice = await invoiceService.create(input, randomUUID(), actor);
    const order = orders.get(invoice.mpOrderId!)!;
    const stale = structuredClone(order);
    state(order, 'processed', 'accredited');
    await paymentService.synchronize(order.id);
    const found = await prisma.paymentAttempt.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    const locked = await paymentRepository.claimAttempt(found.id);
    try { await paymentService.applyOrder(locked, stale); }
    finally { await paymentRepository.releaseAttempt(locked.id, locked.lockToken!); }
    assert.equal((await invoiceService.getById(invoice.id, actor)).status, 'PAID');
  });

  await t.test('perda de lease impede gravação pelo worker antigo', async () => {
    const batch = await invoiceService.createBatch({ description: 'Lease', amount: 50, dueDate: '2026-11-10', userIds: [user.id] }, randomUUID(), actor);
    const invoice = batch.created[0]!;
    const found = await prisma.paymentAttempt.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    const old = await paymentRepository.claimAttempt(found.id);
    await prisma.paymentAttempt.update({ where: { id: found.id }, data: { lockedUntil: new Date(0) } });
    const current = await paymentRepository.claimAttempt(found.id);
    await assert.rejects(() => paymentRepository.saveAttempt({ id: old.id, lockToken: old.lockToken!, invoiceId: invoice.id,
      invoiceVersion: old.invoice.version, attempt: { state: 'PAID' }, invoice: { status: 'PAID' } }), (e: any) => e.code === 'PAYMENT_BUSY');
    await paymentRepository.releaseAttempt(current.id, current.lockToken!);
    assert.equal((await invoiceService.getById(invoice.id, actor)).status, 'PENDING');
  });

  await t.test('limite de retries preserva Retry-After e exige conciliação auditada', async () => {
    const invoice = await invoiceService.create(input, randomUUID(), actor);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    failRead = true;
    try { for (let i = 0; i < 8; i++) await paymentService.issue(attempt.id); }
    finally { failRead = false; }
    const failed = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    assert.equal(failed.state, 'REVIEW'); assert.ok(failed.retryAt.getTime() >= Date.now() + 110_000);
    assert.equal((await invoiceService.getById(invoice.id, actor)).requiresReview, true);
    await invoiceService.reconcile(invoice.id, actor, 'Conta e disponibilidade conferidas');
    assert.equal((await invoiceService.getById(invoice.id, actor)).requiresReview, false);
  });

  await t.test('retry administrativo reutiliza a tentativa e o payload persistidos', async () => {
    rejectCreate = true;
    let invoice;
    try { invoice = await invoiceService.create(input, randomUUID(), actor); }
    finally { rejectCreate = false; }
    assert.equal(invoice.issuanceStatus, 'REVIEW');
    const before = await prisma.paymentAttempt.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    await invoiceService.retry(invoice.id, actor, 'Configuração corrigida');
    await paymentService.issue(before.id);
    const after = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: before.id } });
    assert.equal(after.state, 'ACTIVE'); assert.equal(after.idempotencyKey, before.idempotencyKey);
    assert.deepEqual(after.requestPayload, before.requestPayload);
  });

  await t.test('conciliação legada usa a referência efetiva sem criar nova cobrança', async () => {
    const payload = { external_reference: randomUUID(), total_amount: '123.45' };
    const order = newOrder(payload); state(order, 'processed', 'accredited'); orders.set(order.id, order);
    const legacy = await prisma.invoice.create({ data: { description: 'Legada', amount: '123.45', dueDate: new Date('2026-11-10'),
      userId: user.id, unitId: unit.id, mpOrderId: order.id, requiresReview: true } });
    const before = creates;
    const result = await invoiceService.reconcile(legacy.id, actor, 'Cobrança anterior conferida');
    assert.equal(result.status, 'PAID'); assert.equal(result.requiresReview, false); assert.equal(creates, before);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { invoiceId: legacy.id } });
    assert.equal(attempt.externalReference, order.external_reference);
    assert.equal((attempt.requestPayload as any).originalRequestUnavailable, true);
  });

  await t.test('cancelar lote ainda não emitido impede criação posterior do Pix', async () => {
    const batch = await invoiceService.createBatch({ description: 'Cancelar antes da emissão', amount: 50, dueDate: '2026-11-10', userIds: [user.id] }, randomUUID(), actor);
    const invoice = batch.created[0]!;
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    await invoiceService.cancel(invoice.id, actor, 'Cobrança indevida');
    const before = creates; await paymentService.issue(attempt.id);
    assert.equal(creates, before); assert.equal((await invoiceService.getById(invoice.id, actor)).status, 'CANCELLED');
  });

  await t.test('HTTP retorna erros seguros e valida autenticação, filtros e webhook', async () => {
    const app = express(); app.use(express.json()); app.use('/invoices', invoiceRoutes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}/invoices`;
    const token = jwt.sign(actor, process.env.JWT_SECRET!);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    try {
      assert.equal((await fetch(base)).status, 401);
      const noKey = await fetch(base, { method: 'POST', headers, body: JSON.stringify(input) });
      assert.equal(noKey.status, 400);
      const page = await fetch(base + '?page=abc', { headers }); assert.equal(page.status, 400);
      const webhook = await fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(webhook.status, 401);
      const result = await fetch(base, { method: 'POST', headers: { ...headers, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(input) });
      assert.equal(result.status, 201);
      const response: any = await result.json(); assert.equal('mpResponse' in response, false);
      const health = await fetch(base + '/payments/health', { headers }); assert.equal(health.status, 200);
      const event = { type: 'order', action: 'order.processed', user_id: sellerId, live_mode: true, data: { id: response.mpOrderId } };
      const ts = String(Date.now()); const reqId = randomUUID();
      const sig = createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET!).update(`id:${response.mpOrderId.toLowerCase()};request-id:${reqId};ts:${ts};`).digest('hex');
      t.mock.method(paymentRepository, 'enqueueWebhook', async () => { throw new Error('private database failure'); });
      const persistFailure = await fetch(base + '/webhook?data.id=' + response.mpOrderId, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-signature': `ts=${ts},v1=${sig}`, 'x-request-id': reqId }, body: JSON.stringify(event) });
      assert.equal(persistFailure.status, 500);
      assert.equal(JSON.stringify(await persistFailure.json()).includes('private'), false);

      t.mock.method(paymentRepository, 'health', async () => { throw new Error('private mysql information'); });
      const failed = await fetch(base + '/payments/health', { headers });
      assert.equal(failed.status, 500); assert.equal(JSON.stringify(await failed.json()).includes('private'), false);
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });

  t.after(async () => {
    const invoices = await prisma.invoice.findMany({ where: { userId: user.id }, select: { id: true, operationId: true } });
    const ids = invoices.map(i => i.id);
    await prisma.paymentWebhook.deleteMany({ where: { sellerId } });
    await prisma.invoiceAudit.deleteMany({ where: { invoiceId: { in: ids } } });
    await prisma.paymentAttempt.deleteMany({ where: { invoiceId: { in: ids } } });
    await prisma.invoice.deleteMany({ where: { id: { in: ids } } });
    await prisma.paymentOperation.deleteMany({ where: { id: { in: invoices.flatMap(i => i.operationId ? [i.operationId] : []) } } });
    await prisma.user.delete({ where: { id: user.id } }); await prisma.unit.delete({ where: { id: unit.id } });
    await prisma.$disconnect();
  });
});
