import test from 'node:test';
import app from '../src/app';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { User } from '@prisma/client';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { noticeService } from '../src/services/noticeService';
import { noticeRepository } from '../src/repositories/noticeRepository';
import { userRepository } from '../src/repositories/userRepository';

test('avisos: autenticação em todas as rotas e RBAC nas operações administrativas', async t => {
  t.mock.method(userRepository, 'findAuthState', async (id: string) => ({ id, status: 'ACTIVE', role: 'MORADOR', isSyndic: false, tokenVersion: 0 }));
  const id = randomUUID();
  const token = createAuthTokens({ id, role: 'MORADOR', isSyndic: false, tokenVersion: 0 }).token;
  for (const [method, path] of [['get', '/notices'], ['post', '/notices'], ['post', `/notices/${id}/read`],
    ['delete', `/notices/${id}`]] as const) {
    assert.equal((await request(app)[method](path).send({})).status, 401);
    if ((path === '/notices' && method === 'post') || method === 'delete') {
      assert.equal((await request(app)[method](path).set('Authorization', `Bearer ${token}`).send({})).status, 403);
    }
  }
});

test('avisos: serviço valida conteúdo, status e prioridade antes de gravar', async t => {
  const base = { title: 'Comunicado', content: 'Conteúdo do aviso', authorId: randomUUID() };
  for (const [data, error] of [[{ ...base, title: '' }, /obrigatórios/], [{ ...base, content: '' }, /obrigatórios/],
    [{ ...base, status: 'ARCHIVED' }, /Status inválido/], [{ ...base, priority: 'LOW' }, /Prioridade inválida/]] as const) {
    await t.test(error.source + JSON.stringify(data), async s => {
      const create = s.mock.method(noticeRepository, 'create', async () => { throw new Error('Gravação indevida.'); });
      await assert.rejects(noticeService.create({ ...data }), error);
      assert.equal(create.mock.callCount(), 0);
    });
  }
});

test('avisos: consulta e leitura rejeitam registros inexistentes; exclusão exige autor ou ADMIN', async t => {
  const id = randomUUID();
  await t.test('usuário inexistente', async s => {
    s.mock.method(userRepository, 'findById', async () => null);
    await assert.rejects(noticeService.listForUser(id, 'ADMIN'), /Usuário não encontrado/);
  });
  await t.test('aviso inexistente', async s => {
    s.mock.method(noticeRepository, 'findById', async () => null);
    await assert.rejects(noticeService.delete(id, id, 'ADMIN'), /Aviso não encontrado/);
    await assert.rejects(noticeService.markAsRead(id, id), /Aviso não encontrado/);
  });
  await t.test('outro autor sem privilégio não pode excluir', async s => {
    s.mock.method(noticeRepository, 'findById', async () => ({ id, authorId: randomUUID() }) as any);
    const remove = s.mock.method(noticeRepository, 'delete', async () => { throw new Error('Exclusão indevida.'); });
    await assert.rejects(noticeService.delete(id, randomUUID(), 'MORADOR'), /permissão/);
    assert.equal(remove.mock.callCount(), 0);
  });
});

test('avisos: visão do painel depende do usuário persistido e contador ausente assume zero', async t => {
  const id = randomUUID();
  t.mock.method(userRepository, 'findById', async () => ({ id, role: 'MORADOR', isSyndic: true }) as any);
  t.mock.method(noticeRepository, 'findAll', async () => [{ id: randomUUID(), targetType: 'ALL', targetUnitId: null }] as any);
  t.mock.method(noticeRepository, 'countAddressees', async () => 3);
  const result = await noticeService.listForUser(id, 'MORADOR');
  assert.equal(result[0]!.readCount, 0);
  assert.equal(result[0]!.totalAddressees, 3);
  assert.equal(result[0]!._count, undefined);
});

test('avisos: HTTP e repository com MySQL isolado', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/);
  const prefix = randomUUID();
  const unitIds = [randomUUID(), randomUUID()];
  const userIds = Array.from({ length: 5 }, () => randomUUID());
  const noticeIds: string[] = [];
  t.after(async () => {
    try {
      await prisma.notice.deleteMany({ where: { OR: [{ id: { in: noticeIds } }, { title: { startsWith: prefix } }] } });
      await prisma.user.deleteMany({ where: { OR: [{ id: { in: userIds } }, { email: `${prefix}-injetado@example.test` }] } });
      await prisma.unit.deleteMany({ where: { OR: [{ id: { in: unitIds } }, { block: `${prefix}-injetado` }] } });
    } finally { await prisma.$disconnect(); }
  });
  for (const [index, id] of unitIds.entries()) {
    await prisma.unit.create({ data: { id, block: prefix, number: String(index) } });
  }
  const roles = ['ADMIN', 'MORADOR', 'MORADOR', 'MORADOR', 'MORADOR'];
  const users: User[] = [];
  for (const [index, id] of userIds.entries()) {
    users.push(await prisma.user.create({ data: { id, name: `Usuário ${index}`, email: `${prefix}-${index}@example.test`,
      cpf: `${prefix}-${index}`, password: 'hash-teste', role: roles[index],
      status: index === 3 ? 'INACTIVE' : 'ACTIVE', unitId: index === 0 || index === 4 ? null : unitIds[index === 2 ? 1 : 0] } }));
  }
  const admin = `Bearer ${createAuthTokens(users[0]!).token}`;
  const resident = `Bearer ${createAuthTokens(users[1]!).token}`;
  const other = `Bearer ${createAuthTokens(users[2]!).token}`;
  const noUnit = `Bearer ${createAuthTokens(users[4]!).token}`;
  const fixtures: Record<string, any> = {};
  for (const [name, data] of Object.entries({
    all: {}, own: { targetType: 'UNIT', targetUnitId: unitIds[0], priority: 'URGENT' },
    other: { targetType: 'UNIT', targetUnitId: unitIds[1] },
    draft: { status: 'DRAFT' }, ownDraft: { status: 'DRAFT', targetType: 'UNIT', targetUnitId: unitIds[0] },
  })) {
    const result = await request(app).post('/notices').set('Authorization', admin)
      .send({ title: `${prefix}-${name}`, content: 'Conteúdo do aviso', ...data });
    assert.equal(result.status, 201);
    fixtures[name] = result.body;
    noticeIds.push(result.body.id);
  }

  await t.test('criação aplica defaults, mantém relações e valida aviso de unidade sem destinatário', async () => {
    assert.equal(fixtures.all.targetType, 'ALL');
    assert.equal(fixtures.all.status, 'PUBLISHED');
    assert.equal(fixtures.all.priority, 'NORMAL');
    assert.equal(fixtures.all.authorId, users[0]!.id);
    assert.equal(fixtures.all.author.name, users[0]!.name);
    assert.equal(fixtures.own.targetUnit.id, unitIds[0]);
    assert.equal(fixtures.own.priority, 'URGENT');
    assert.equal((await noticeRepository.findById(fixtures.all.id))?.authorId, users[0]!.id);
    const invalid = await request(app).post('/notices').set('Authorization', admin)
      .send({ title: `${prefix}-inválido`, content: 'Sem unidade', targetType: 'UNIT' });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /targetUnitId/);
  });

  await t.test('morador recebe somente publicados ALL e da própria unidade; sem unidade recebe ALL', async () => {
    for (const [token, expected] of [[resident, ['all', 'own']], [other, ['all', 'other']], [noUnit, ['all']]] as const) {
      const result = await request(app).get('/notices').set('Authorization', token);
      assert.equal(result.status, 200);
      const ownFixtures = result.body.filter((notice: any) => notice.title.startsWith(prefix));
      assert.deepEqual(ownFixtures.map((notice: any) => notice.id).sort(), expected.map(name => fixtures[name].id).sort());
      assert.ok(ownFixtures.every((notice: any) => notice.isRead === false && !('readBy' in notice)));
    }
    const persistedRole = await noticeService.listForUser(users[1]!.id, 'ADMIN');
    assert.equal(persistedRole.some((notice: any) => notice.id === fixtures.draft.id), false);
  });

  await t.test('leitura é idempotente, individual e refletida na listagem', async () => {
    for (let count = 0; count < 2; count++) {
      const result = await request(app).post(`/notices/${fixtures.all.id}/read`).set('Authorization', resident);
      assert.equal(result.status, 200);
      assert.match(result.body.message, /lido/);
    }
    assert.equal(await prisma.noticeRead.count({ where: { noticeId: fixtures.all.id, userId: users[1]!.id } }), 1);
    const mine = await request(app).get('/notices').set('Authorization', resident);
    const theirs = await request(app).get('/notices').set('Authorization', other);
    assert.equal(mine.body.find((notice: any) => notice.id === fixtures.all.id).isRead, true);
    assert.equal(theirs.body.find((notice: any) => notice.id === fixtures.all.id).isRead, false);
    const absent = await request(app).post(`/notices/${randomUUID()}/read`).set('Authorization', resident);
    assert.equal(absent.status, 400);
  });

  await t.test('painel inclui rascunhos e contagens consideram somente moradores ativos', async () => {
    const result = await request(app).get('/notices').set('Authorization', admin);
    assert.equal(result.status, 200);
    assert.ok(result.body.some((notice: any) => notice.id === fixtures.draft.id));
    const targeted = result.body.find((notice: any) => notice.id === fixtures.own.id);
    assert.equal(targeted.totalAddressees, 1);
    assert.equal(targeted.readCount, 0);
    const general = result.body.find((notice: any) => notice.id === fixtures.all.id);
    assert.equal(general.readCount, 1);
    assert.ok(general.totalAddressees >= 3);
    assert.equal('_count' in general, false);
    assert.equal(await noticeRepository.countAddressees({ targetType: 'UNIT', targetUnitId: unitIds[1]! }), 1);
  });

  await t.test('POST ignora autor, relações aninhadas, leituras e identificador enviados no body', async () => {
    const injectedId = randomUUID();
    const result = await request(app).post('/notices').set('Authorization', admin).send({
      id: injectedId, title: `${prefix}-mass-assignment`, content: 'Conteúdo permitido', authorId: users[2]!.id,
      author: { create: { name: 'Autor injetado', email: `${prefix}-injetado@example.test`, cpf: randomUUID(), password: 'hash' } },
      targetUnit: { create: { block: `${prefix}-injetado`, number: '99' } },
      readBy: { create: { userId: users[1]!.id } },
    });
    assert.equal(result.status, 201);
    noticeIds.push(result.body.id);
    assert.notEqual(result.body.id, injectedId);
    assert.equal(result.body.authorId, users[0]!.id);
    assert.equal(result.body.targetUnitId, null);
    assert.equal(await prisma.user.count({ where: { email: `${prefix}-injetado@example.test` } }), 0);
    assert.equal(await prisma.unit.count({ where: { block: `${prefix}-injetado` } }), 0);
    assert.equal(await prisma.noticeRead.count({ where: { noticeId: result.body.id } }), 0);
  });

  for (const [name, notice] of [['outra unidade', fixtures.other], ['rascunho', fixtures.draft]] as const) {
    await t.test(`leitura deve rejeitar aviso de ${name}`, async () => {
        const result = await request(app).post(`/notices/${notice.id}/read`).set('Authorization', resident);
        assert.equal(result.status, 403);
        assert.equal(await prisma.noticeRead.count({ where: { noticeId: notice.id, userId: users[1]!.id } }), 0);
      });
  }

  await t.test('autor pode excluir e ADMIN pode excluir aviso de outro autor', async () => {
    const authored = await noticeService.create({ title: `${prefix}-autor`, content: 'Aviso do autor', authorId: users[1]!.id });
    noticeIds.push(authored.id);
    await noticeService.delete(authored.id, users[1]!.id, 'MORADOR');
    assert.equal(await noticeRepository.findById(authored.id), null);
    const another = await noticeService.create({ title: `${prefix}-outro-autor`, content: 'Outro aviso', authorId: users[2]!.id });
    noticeIds.push(another.id);
    const removed = await request(app).delete(`/notices/${another.id}`).set('Authorization', admin);
    assert.equal(removed.status, 200);
    assert.match(removed.body.message, /removido com sucesso/);
    assert.equal(await noticeRepository.findById(another.id), null);
    assert.equal((await request(app).delete(`/notices/${randomUUID()}`).set('Authorization', admin)).status, 400);
  });
});
