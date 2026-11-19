import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Prisma, User } from '@prisma/client';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { HttpError } from '../src/lib/httpError';
import { prisma } from '../src/lib/prisma';
import { userRepository } from '../src/repositories/userRepository';
import { noticeRepository } from '../src/repositories/noticeRepository';
import { eventRepository } from '../src/repositories/eventRepository';
import { incidentRepository } from '../src/repositories/incidentRepository';
import { notificationRepository } from '../src/repositories/notificationRepository';
import { notificationService } from '../src/services/notificationService';

const userId = randomUUID();
const unitId = randomUUID();
const sourceId = randomUUID();
const actor = { id: userId, status: 'ACTIVE', role: 'MORADOR', isSyndic: true, unitId, tokenVersion: 0 } as User;
const notFound = (error: unknown) => error instanceof HttpError && error.statusCode === 404;

// readAt muda a cada leitura; o resto do upsert é exato.
function assertReadUpsert(mock: { mock: { calls: { arguments: unknown[] }[] } }, type: string) {
  const { update, ...rest } = mock.mock.calls[0]?.arguments[0] as { update: { readAt: unknown } };
  assert.deepEqual(rest, { where: { userId_type_sourceId: { userId, type, sourceId } }, create: { userId, type, sourceId } });
  assert.ok(update.readAt instanceof Date);
}

test('notificações: OpenAPI preserva as operações de notificações, relatórios e vagas', () => {
  const yaml = parseDocument(readFileSync('docs/openapi.yaml', 'utf8'));
  assert.deepEqual(yaml.errors, []);
  const document = yaml.toJS();
  for (const [path, method] of [
    ['/notifications', 'get'], ['/notifications/{type}/{id}/read', 'post'],
    ...['occupancy', 'charges-summary', 'incidents', 'reservations'].map(name => ['/reports/' + name, 'get']),
    ['/parking-spots', 'get'], ['/parking-spots', 'post'], ['/parking-spots/me', 'get'],
    ['/parking-spots/{id}', 'put'], ['/parking-spots/{id}', 'delete'], ['/parking-spots/{id}/assign', 'put'],
  ]) assert.ok(document.paths[path!]?.[method!], `${method} ${path}`);
  function check(value: any) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) assert.ok(value.$ref.split('/').slice(1).reduce((node: any, key: string) => node?.[key], document), value.$ref);
    for (const child of Object.values(value)) check(child);
  }
  check(document);
});

// Os métodos do Prisma são proxies sem descriptor.value para mock.method.
function mockPrismaMethod<T, K extends keyof T, F extends (...args: never[]) => unknown>(t: TestContext, target: T, key: K, implementation: F) {
  const original = target[key];
  const mocked = t.mock.fn(implementation);
  target[key] = mocked as T[K];
  t.after(() => { target[key] = original; });
  return mocked;
}

test('notificações: autenticação atual, parâmetros e 404 HTTP', async t => {
  t.mock.method(userRepository, 'findAuthState', async () => actor);
  t.mock.method(userRepository, 'findById', async () => actor);
  const token = createAuthTokens(actor).token;
  const authorization = `Bearer ${token}`;
  assert.equal((await request(app).get('/notifications')).status, 401);
  assert.equal((await request(app).post(`/notifications/NOTICE/${sourceId}/read`)).status, 401);

  const write = t.mock.method(notificationRepository, 'markRead', async () => { throw new HttpError(404, 'Notificação não encontrada.'); });
  for (const path of [`/notifications/OTHER/${sourceId}/read`, '/notifications/NOTICE/invalido/read']) {
    assert.equal((await request(app).post(path).set('Authorization', authorization)).status, 400);
  }
  assert.equal(write.mock.callCount(), 0);
  for (const type of ['NOTICE', 'EVENT', 'INCIDENT']) {
    const result = await request(app).post(`/notifications/${type}/${sourceId}/read`).set('Authorization', authorization)
      .send({ userId: randomUUID(), unitId: randomUUID() });
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { error: 'Notificação não encontrada.' });
    assert.deepEqual(write.mock.calls.at(-1)?.arguments, [userId, type, sourceId, unitId]);
  }
  t.mock.method(userRepository, 'findAuthState', async () => ({ ...actor, tokenVersion: 1 }));
  assert.equal((await request(app).get('/notifications').set('Authorization', authorization)).status, 401);
});

test('notificações: lista pessoal usa destinatários mesmo para síndico e serializa datas', async t => {
  const createdAt = new Date('2026-11-01T12:00:00Z');
  const later = new Date('2026-11-02T12:00:00Z');
  t.mock.method(userRepository, 'findAuthState', async () => actor);
  t.mock.method(userRepository, 'findById', async () => actor);
  const notices = t.mock.method(noticeRepository, 'findForUser', async () => [
    { id: sourceId, title: 'Comunicado lido', createdAt, readBy: [{ id: randomUUID() }] },
    { id: 'unread', title: 'Comunicado editado', createdAt, readBy: [] },
  ] as Awaited<ReturnType<typeof noticeRepository.findForUser>>);
  const events = t.mock.method(eventRepository, 'findForUser', async () => [
    { id: sourceId, title: 'Evento cancelado', status: 'CANCELLED', createdAt: later },
    { id: 'event-unread', title: 'Evento publicado', status: 'PUBLISHED', createdAt },
  ] as Awaited<ReturnType<typeof eventRepository.findForUser>>);
  const incidentId = randomUUID();
  const changedAt = new Date('2026-11-03T12:00:00Z');
  const incidents = t.mock.method(incidentRepository, 'findAll', async () => [
    { id: incidentId, title: 'Vazamento', status: 'RESOLVED', updatedAt: changedAt },
    { id: 'incident-reread', title: 'Barulho', status: 'IN_PROGRESS', updatedAt: createdAt },
  ] as Awaited<ReturnType<typeof incidentRepository.findAll>>);
  const reads = t.mock.method(notificationRepository, 'findReads', async () => [
    { type: 'EVENT', sourceId, readAt: createdAt },
    // Lida antes da última alteração: volta a ser não lida.
    { type: 'INCIDENT', sourceId: incidentId, readAt: later },
    { type: 'INCIDENT', sourceId: 'incident-reread', readAt: later },
  ]);
  const panel = t.mock.method(noticeRepository, 'findAll', async () => { throw new Error('Acesso indevido ao painel'); });

  const result = await request(app).get('/notifications').set('Authorization', `Bearer ${createAuthTokens(actor).token}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 6);
  assert.deepEqual(result.body[0], { id: `INCIDENT:${incidentId}`, type: 'INCIDENT', sourceId: incidentId, title: 'Vazamento',
    description: 'Ocorrência resolvida', createdAt: changedAt.toISOString(), isRead: false });
  assert.equal(result.body.find((item: { id: string }) => item.id === 'INCIDENT:incident-reread').isRead, true);
  assert.deepEqual(incidents.mock.calls[0]?.arguments, [{ authorId: userId, OR: [{ status: { not: 'OPEN' } }, { response: { not: null } }] }]);
  assert.deepEqual(result.body[1], { id: `EVENT:${sourceId}`, type: 'EVENT', sourceId, title: 'Evento cancelado',
    description: 'Evento cancelado', createdAt: later.toISOString(), isRead: true });
  assert.equal(result.body.find((item: { id: string }) => item.id === `NOTICE:${sourceId}`).isRead, true);
  assert.equal(result.body.find((item: { id: string }) => item.id === 'NOTICE:unread').isRead, false);
  assert.equal(result.body.find((item: { id: string }) => item.id === 'EVENT:event-unread').isRead, false);
  assert.deepEqual(notices.mock.calls[0]?.arguments, [userId, unitId]);
  assert.deepEqual(events.mock.calls[0]?.arguments, [unitId]);
  assert.deepEqual(reads.mock.calls[0]?.arguments, [userId]);
  assert.equal(panel.mock.callCount(), 0);

  t.mock.method(userRepository, 'findById', async () => ({ ...actor, unitId: null }));
  await notificationService.list(userId);
  assert.deepEqual(notices.mock.calls.at(-1)?.arguments, [userId, null]);
  assert.deepEqual(events.mock.calls.at(-1)?.arguments, [null]);
});

test('notificações: sessão ausente ou inativa não consulta itens nem grava leituras', async t => {
  const list = t.mock.method(noticeRepository, 'findForUser', async () => []);
  const write = t.mock.method(notificationRepository, 'markRead', async () => { throw new Error('Gravação indevida'); });
  for (const user of [null, { ...actor, status: 'INACTIVE' }]) {
    t.mock.method(userRepository, 'findById', async () => user);
    const unauthorized = (error: unknown) => error instanceof HttpError && error.statusCode === 401;
    await assert.rejects(notificationService.list(userId), unauthorized);
    await assert.rejects(notificationService.markRead(userId, 'NOTICE', sourceId), unauthorized);
  }
  assert.equal(list.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
});

test('notificações: repository verifica publicação e destinatários antes de qualquer leitura', async t => {
  for (const type of ['NOTICE', 'EVENT'] as const) {
    for (const currentUnit of [unitId, null]) {
      await t.test(`${type}, unidade ${currentUnit ?? 'ausente'}`, async s => {
        mockPrismaMethod(s, prisma, '$transaction', async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => run(prisma));
        const lock = mockPrismaMethod(s, prisma, '$queryRaw', async () => []);
        const lookup = mockPrismaMethod(s, type === 'NOTICE' ? prisma.notice : prisma.event, 'findFirst', async () => null);
        const noticeWrite = mockPrismaMethod(s, prisma.noticeRead, 'upsert', async () => { throw new Error('Gravação indevida'); });
        const notificationWrite = mockPrismaMethod(s, prisma.notificationRead, 'upsert', async () => { throw new Error('Gravação indevida'); });
        await assert.rejects(notificationRepository.markRead(userId, type, sourceId, currentUnit), notFound);
        assert.equal(lock.mock.callCount(), 1);
        assert.deepEqual(lookup.mock.calls[0]?.arguments, [{ where: {
          id: sourceId, status: type === 'NOTICE' ? 'PUBLISHED' : { in: ['PUBLISHED', 'CANCELLED'] },
          OR: [{ targetType: 'ALL' }, ...(currentUnit ? [{ targetType: 'UNIT', targetUnitId: currentUnit }] : [])],
        }, select: { id: true } }]);
        assert.equal(noticeWrite.mock.callCount(), 0);
        assert.equal(notificationWrite.mock.callCount(), 0);
      });
    }
  }
});

test('notificações: leitura idempotente de comunicado grava NoticeRead e NotificationRead na mesma transação', async t => {
  const transaction = mockPrismaMethod(t, prisma, '$transaction', async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => run(prisma));
  mockPrismaMethod(t, prisma, '$queryRaw', async () => []);
  mockPrismaMethod(t, prisma.notice, 'findFirst', async () => ({ id: sourceId }));
  const noticeWrite = mockPrismaMethod(t, prisma.noticeRead, 'upsert', async () => ({}));
  const notificationWrite = mockPrismaMethod(t, prisma.notificationRead, 'upsert', async () => ({}));
  for (let i = 0; i < 2; i++) await notificationRepository.markRead(userId, 'NOTICE', sourceId, unitId);
  assert.equal(transaction.mock.callCount(), 2);
  assert.deepEqual(noticeWrite.mock.calls[0]?.arguments, [{
    where: { noticeId_userId: { noticeId: sourceId, userId } }, create: { noticeId: sourceId, userId }, update: {},
  }]);
  assertReadUpsert(notificationWrite, 'NOTICE');
  mockPrismaMethod(t, prisma.noticeRead, 'upsert', async () => { throw new Error('Falha na leitura'); });
  await assert.rejects(notificationRepository.markRead(userId, 'NOTICE', sourceId, unitId), /Falha na leitura/);
  assert.equal(notificationWrite.mock.callCount(), 2);
});

test('notificações: evento visível grava só sua leitura e não reutiliza leituras de outro usuário', async t => {
  mockPrismaMethod(t, prisma, '$transaction', async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => run(prisma));
  mockPrismaMethod(t, prisma, '$queryRaw', async () => []);
  mockPrismaMethod(t, prisma.event, 'findFirst', async () => ({ id: sourceId }));
  const noticeWrite = mockPrismaMethod(t, prisma.noticeRead, 'upsert', async () => { throw new Error('Gravação indevida'); });
  const notificationWrite = mockPrismaMethod(t, prisma.notificationRead, 'upsert', async () => ({}));
  await notificationRepository.markRead(userId, 'EVENT', sourceId, null);
  assert.equal(noticeWrite.mock.callCount(), 0);
  assertReadUpsert(notificationWrite, 'EVENT');
  const read = mockPrismaMethod(t, prisma.notificationRead, 'findMany', async () => []);
  await notificationRepository.findReads(userId);
  assert.deepEqual(read.mock.calls[0]?.arguments, [{ where: { userId, type: { in: ['EVENT', 'INCIDENT'] } }, select: { type: true, sourceId: true, readAt: true } }]);
});

test('notificações: ocorrência só pode ser lida pelo autor e reabre após nova alteração', async t => {
  mockPrismaMethod(t, prisma, '$transaction', async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => run(prisma));
  const lookup = mockPrismaMethod(t, prisma.incident, 'findFirst', async () => null);
  const write = mockPrismaMethod(t, prisma.notificationRead, 'upsert', async () => ({}));
  await assert.rejects(notificationRepository.markRead(userId, 'INCIDENT', sourceId, unitId), notFound);
  assert.deepEqual(lookup.mock.calls[0]?.arguments, [{ where: { id: sourceId, authorId: userId }, select: { id: true } }]);
  assert.equal(write.mock.callCount(), 0);

  mockPrismaMethod(t, prisma.incident, 'findFirst', async () => ({ id: sourceId }));
  await notificationRepository.markRead(userId, 'INCIDENT', sourceId, null);
  assertReadUpsert(write, 'INCIDENT');
});
