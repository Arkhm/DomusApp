import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { eventService } from '../src/services/eventService';
import { eventRepository } from '../src/repositories/eventRepository';
import { userRepository } from '../src/repositories/userRepository';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
const input = () => ({
  title: 'Assembleia', content: 'Pauta da assembleia',
  eventDate: new Date(Date.now() + 86_400_000).toISOString(), authorId: randomUUID(),
});
const bearer = (id: string, role = 'MORADOR', isSyndic = false) =>
  `Bearer ${createAuthTokens({ id, role, isSyndic, tokenVersion: 0 }).token}`;

test('eventos: validações do serviço', async t => {
  const cases = [
    ['título ausente', { title: '' }, /obrigatórios/],
    ['conteúdo ausente', { content: '' }, /obrigatórios/],
    ['data ausente', { eventDate: '' }, /obrigatórios/],
    ['data inválida', { eventDate: 'data-inválida' }, /Data do evento inválida/],
    ['capacidade zero', { capacity: 0 }, /Capacidade/],
    ['capacidade negativa', { capacity: -1 }, /Capacidade/],
    ['capacidade textual', { capacity: '10' }, /Capacidade/],
    ['categoria inválida', { category: 'FESTA' }, /Categoria inválida/],
    ['status inválido', { status: 'ACTIVE' }, /Status inválido/],
  ] as const;
  for (const [name, patch, message] of cases) {
    await t.test(`recusa ${name} antes de persistir`, async t => {
      const persist = t.mock.method(eventRepository, 'create', async () => {
        assert.fail('Entrada inválida não pode chegar ao repositório.');
      });
      await assert.rejects(() => eventService.create({ ...input(), ...patch } as Parameters<typeof eventService.create>[0]), message);
      assert.equal(persist.mock.callCount(), 0);
    });
  }

  await t.test('define os padrões e converte a data', async t => {
    const persist = t.mock.method(eventRepository, 'create', async (data: Parameters<typeof eventRepository.create>[0]) => data);
    const data = input();
    const result = await eventService.create(data);
    assert.equal(result.targetType, 'ALL');
    assert.equal(result.category, 'OUTRO');
    assert.equal(result.status, 'PUBLISHED');
    assert.equal(result.capacity, null);
    assert.equal(result.eventDate.toISOString(), data.eventDate);
    assert.equal(persist.mock.callCount(), 1);
  });

  await t.test('recusa capacidade fracionária no serviço', {
    todo: 'eventService.create verifica apenas tipo e mínimo; 1.5 chega ao repositório, embora a capacidade deva ser inteira.',
  }, async t => {
    t.mock.method(eventRepository, 'create', async (data: Parameters<typeof eventRepository.create>[0]) => data);
    await assert.rejects(() => eventService.create({ ...input(), capacity: 1.5 }), /Capacidade/);
  });

  await t.test('listagem recusa usuário inexistente', async t => {
    t.mock.method(userRepository, 'findById', async () => null);
    await assert.rejects(() => eventService.listForUser(randomUUID(), 'ADMIN'), /Usuário não encontrado/);
  });
});

test('eventos: HTTP, permissões e repositório com MySQL isolado', { skip: !enabled }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração só pode usar banco terminado em _test.');
  const suffix = randomUUID();
  const unitId = randomUUID();
  const otherUnitId = randomUUID();
  const adminId = randomUUID();
  const residentId = randomUUID();
  const syndicId = randomUUID();
  const ids = [adminId, residentId, syndicId];
  t.after(async () => {
    try {
      await prisma.event.deleteMany({ where: { authorId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.unit.deleteMany({ where: { id: { in: [unitId, otherUnitId] } } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.unit.createMany({ data: [
    { id: unitId, number: `eventos-${suffix}` },
    { id: otherUnitId, number: `eventos-outra-${suffix}` },
  ] });
  await prisma.user.createMany({ data: ids.map((id, index) => ({
    id, name: 'Pessoa dos eventos', email: `${index}-eventos-${suffix}@example.com`,
    cpf: `${index}-${suffix}`, password: 'hash-apenas-para-teste',
    role: index === 0 ? 'ADMIN' : 'MORADOR', isSyndic: index === 2, unitId,
  })) });
  const admin = bearer(adminId, 'ADMIN');
  const resident = bearer(residentId);
  const syndic = bearer(syndicId, 'MORADOR', true);
  const created = async (patch: Record<string, unknown> = {}) =>
    eventService.create({ ...input(), authorId: adminId, ...patch });

  await t.test('sem token retorna 401 em todas as operações', async () => {
    await request(app).get('/events').expect(401);
    await request(app).post('/events').send(input()).expect(401);
    await request(app).delete(`/events/${randomUUID()}`).expect(401);
  });
  await t.test('morador não cria nem apaga eventos administrativos', async () => {
    await request(app).post('/events').set('Authorization', resident).send(input()).expect(403);
    await request(app).delete(`/events/${randomUUID()}`).set('Authorization', resident).expect(403);
  });
  await t.test('HTTP rejeita data, capacidade e destino inválidos', async () => {
    for (const patch of [
      { eventDate: 'inválida' }, { capacity: 0 }, { capacity: -2 }, { capacity: 1.5 },
      { capacity: '5' }, { targetType: 'UNIT' },
    ]) {
      await request(app).post('/events').set('Authorization', admin).send({ ...input(), ...patch }).expect(400);
    }
  });
  await t.test('admin cria evento e autoria vem do token', async () => {
    const response = await request(app).post('/events').set('Authorization', admin)
      .send({ ...input(), authorId: residentId, category: 'ASSEMBLEIA', capacity: 1, location: 'Salão' }).expect(201);
    assert.equal(response.body.authorId, adminId);
    assert.equal(response.body.capacity, 1);
    assert.equal(response.body.category, 'ASSEMBLEIA');
    assert.equal(response.body.author.role, 'ADMIN');
    assert.equal((await eventRepository.findById(response.body.id))?.location, 'Salão');
    await request(app).delete(`/events/${response.body.id}`).set('Authorization', admin).expect(200);
    assert.equal(await eventRepository.findById(response.body.id), null);
  });
  await t.test('síndica cria e apaga o próprio evento', async () => {
    const response = await request(app).post('/events').set('Authorization', syndic).send(input()).expect(201);
    assert.equal(response.body.authorId, syndicId);
    await request(app).delete(`/events/${response.body.id}`).set('Authorization', syndic).expect(200);
  });
  await t.test('síndica não apaga evento de outro autor; admin pode', async () => {
    const event = await created();
    await request(app).delete(`/events/${event.id}`).set('Authorization', syndic).expect(400)
      .expect(({ body }) => assert.match(body.error, /permissão/));
    assert.ok(await eventRepository.findById(event.id));
    await eventService.delete(event.id, adminId, 'ADMIN');
  });
  await t.test('apagar evento inexistente falha explicitamente', async () => {
    await assert.rejects(() => eventService.delete(randomUUID(), adminId, 'ADMIN'), /Evento não encontrado/);
  });
  await t.test('morador vê publicados e cancelados globais ou da própria unidade, sem rascunhos', async () => {
    const global = await created({ eventDate: new Date(Date.now() + 10_000).toISOString() });
    const own = await created({ targetType: 'UNIT', targetUnitId: unitId, status: 'CANCELLED' });
    const other = await created({ targetType: 'UNIT', targetUnitId: otherUnitId });
    const draft = await created({ status: 'DRAFT' });
    const response = await request(app).get('/events').set('Authorization', resident).expect(200);
    const visible = new Set(response.body.map((event: { id: string }) => event.id));
    assert.ok(visible.has(global.id));
    assert.ok(visible.has(own.id));
    assert.ok(!visible.has(other.id));
    assert.ok(!visible.has(draft.id));
    const withoutUnit = await eventRepository.findForUser(null);
    assert.ok(withoutUnit.some(event => event.id === global.id));
    assert.ok(!withoutUnit.some(event => event.id === own.id));
    const panel = await request(app).get('/events').set('Authorization', admin).expect(200);
    assert.ok(panel.body.some((event: { id: string }) => event.id === draft.id));
    const dates = panel.body.map((event: { eventDate: string }) => Date.parse(event.eventDate));
    assert.deepEqual(dates, [...dates].sort((a: number, b: number) => a - b));
  });
});
