import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { incidentService } from '../src/services/incidentService';
import { incidentRepository } from '../src/repositories/incidentRepository';
import { userRepository } from '../src/repositories/userRepository';
import { createIncidentSchema, updateIncidentSchema, incidentQuerySchema } from '../src/schemas/incidentSchema';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
const resident = { id: randomUUID(), role: 'MORADOR', isSyndic: false };
const admin = { id: randomUUID(), role: 'ADMIN', isSyndic: false };
const input = () => ({ title: ' Barulho no corredor ', description: ' Música alta à noite ', category: 'BARULHO' as const });
const bearer = (id: string, role = 'MORADOR', isSyndic = false) =>
  `Bearer ${createAuthTokens({ id, role, isSyndic, tokenVersion: 0 }).token}`;
const statusCode = (code: number) => (error: any) => error.statusCode === code;

test('ocorrências: schemas validam entrada e descartam campos controlados pelo servidor', () => {
  assert.deepEqual(createIncidentSchema.parse({ ...input(), authorId: admin.id, unitId: randomUUID(), status: 'CLOSED', response: 'Forjada' }), {
    title: 'Barulho no corredor', description: 'Música alta à noite', category: 'BARULHO',
  });
  for (const patch of [
    { title: '' }, { title: ' ' }, { title: 'a'.repeat(201) }, { title: null },
    { description: ' ' }, { category: 'INVALIDA' }, { category: { in: ['BARULHO'] } },
  ]) assert.equal(createIncidentSchema.safeParse({ ...input(), ...patch }).success, false);
  for (const data of [{}, { authorId: resident.id }, { status: 'INVALIDO' }, { response: 'a'.repeat(2001) }, { response: null }]) {
    assert.equal(updateIncidentSchema.safeParse(data).success, false);
  }
  assert.deepEqual(updateIncidentSchema.parse({ response: ' Resposta ', title: 'Ignorado' }), { response: 'Resposta' });
  assert.equal(updateIncidentSchema.safeParse({ response: '' }).success, true);
  assert.equal(incidentQuerySchema.safeParse({ status: ['OPEN'] }).success, false);
  assert.equal(incidentQuerySchema.safeParse({ category: 'INVALIDA' }).success, false);
});

test('ocorrências: serviço restringe a consulta pelo autor e libera o painel', async t => {
  for (const actor of [resident, admin, { ...resident, isSyndic: true }, { ...admin, role: 'FUNCIONARIO' }]) {
    await t.test(`visibilidade de ${actor.role}, síndica ${!!actor.isSyndic}`, async t => {
      const panel = actor.role !== 'MORADOR' || actor.isSyndic;
      const list = t.mock.method(incidentRepository, 'findAll', async () => []);
      const find = t.mock.method(incidentRepository, 'findById', async () => ({ id: 'ocorrência' }) as any);
      assert.deepEqual(await incidentService.list(actor, { status: 'OPEN', category: 'BARULHO' }), []);
      assert.deepEqual(list.mock.calls[0]!.arguments[0], {
        status: 'OPEN', category: 'BARULHO', authorId: panel ? undefined : actor.id,
      });
      assert.equal((await incidentService.getById('ocorrência', actor)).id, 'ocorrência');
      assert.deepEqual(find.mock.calls[0]!.arguments, ['ocorrência', panel ? undefined : actor.id]);
    });
  }
  await t.test('ocorrência ausente ou invisível responde 404', async t => {
    t.mock.method(incidentRepository, 'findById', async () => null);
    await assert.rejects(() => incidentService.getById(randomUUID(), resident), statusCode(404));
  });
});

test('ocorrências: criação usa autor e unidade do banco e recusa painel ou falta de unidade', async t => {
  const user = { ...resident, unitId: randomUUID() };
  await t.test('persiste somente campos permitidos com a unidade atual', async t => {
    t.mock.method(userRepository, 'findById', async () => user as any);
    const create = t.mock.method(incidentRepository, 'create', async (data: Parameters<typeof incidentRepository.create>[0]) => data as any);
    const parsed = createIncidentSchema.parse({ ...input(), unitId: randomUUID(), authorId: admin.id, status: 'CLOSED' });
    await incidentService.create(parsed, user.id);
    assert.deepEqual(create.mock.calls[0]!.arguments[0], { ...parsed, authorId: user.id, unitId: user.unitId });
  });
  for (const [label, value] of [
    ['usuário inexistente', null], ['morador sem unidade', { ...user, unitId: null }],
    ['admin', { ...user, role: 'ADMIN' }], ['funcionário', { ...user, role: 'FUNCIONARIO' }],
  ] as const) {
    await t.test(`403 para ${label}`, async t => {
      t.mock.method(userRepository, 'findById', async () => value as any);
      const create = t.mock.method(incidentRepository, 'create', async () => assert.fail('Não deve persistir.'));
      await assert.rejects(() => incidentService.create(input(), resident.id), statusCode(403));
      assert.equal(create.mock.callCount(), 0);
    });
  }
});

test('ocorrências: resposta registra horário, status isolado preserva horário e CLOSED é imutável', async t => {
  for (const actor of [admin, { ...resident, isSyndic: true }, { ...admin, role: 'FUNCIONARIO' }]) {
    await t.test(`gestão atualiza como ${actor.role}, síndica ${!!actor.isSyndic}`, async t => {
      t.mock.method(incidentRepository, 'findById', async () => ({ status: 'OPEN' }) as any);
      const update = t.mock.method(incidentRepository, 'update', async (_id: string, _data: Parameters<typeof incidentRepository.update>[1]) => ({ status: 'RESOLVED' }) as any);
      const before = Date.now();
      await incidentService.update('id', { status: 'RESOLVED', response: 'Providenciado.' }, actor);
      const sent = update.mock.calls[0]!.arguments[1];
      assert.equal(sent.status, 'RESOLVED');
      assert.equal(sent.response, 'Providenciado.');
      assert.ok(sent.respondedAt instanceof Date && sent.respondedAt.getTime() >= before && sent.respondedAt.getTime() <= Date.now());
      await incidentService.update('id', { status: 'IN_PROGRESS' }, actor);
      assert.equal(update.mock.calls[1]!.arguments[1].respondedAt, undefined);
      await incidentService.update('id', { response: '' }, actor);
      assert.ok(update.mock.calls[2]!.arguments[1].respondedAt instanceof Date);
    });
  }
  await t.test('morador não atualiza nem consulta antes do 403', async t => {
    const find = t.mock.method(incidentRepository, 'findById', async () => null);
    await assert.rejects(() => incidentService.update('id', { status: 'CLOSED' }, resident), statusCode(403));
    assert.equal(find.mock.callCount(), 0);
  });
  await t.test('não atualiza ocorrência inexistente', async t => {
    t.mock.method(incidentRepository, 'findById', async () => null);
    await assert.rejects(() => incidentService.update('id', { response: 'Resposta' }, admin), statusCode(404));
  });
  await t.test('não atualiza ocorrência já encerrada', async t => {
    t.mock.method(incidentRepository, 'findById', async () => ({ status: 'CLOSED' }) as any);
    const update = t.mock.method(incidentRepository, 'update', async () => assert.fail('Não deve persistir.'));
    await assert.rejects(() => incidentService.update('id', { response: 'Resposta' }, admin), statusCode(400));
    assert.equal(update.mock.callCount(), 0);
  });
  await t.test('recusa alteração se outra requisição encerrar antes da escrita', async t => {
    t.mock.method(incidentRepository, 'findById', async () => ({ status: 'OPEN' }) as any);
    t.mock.method(incidentRepository, 'update', async () => null);
    await assert.rejects(() => incidentService.update('id', { response: 'Resposta' }, admin), statusCode(400));
  });
});

test('ocorrências: HTTP e repositório com MySQL isolado', { skip: !enabled }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração só pode usar banco terminado em _test.');
  const suffix = randomUUID();
  const unitId = randomUUID();
  const otherUnitId = randomUUID();
  const ids = Array.from({ length: 7 }, () => randomUUID());
  const [residentId, neighborId, adminId, employeeId, syndicId, noUnitId, guestId] = ids as [string, string, string, string, string, string, string];
  await prisma.unit.create({ data: { id: unitId, block: `ocorrencias-${suffix}`, number: '1' } });
  t.after(async () => {
    try {
      await prisma.incident.deleteMany({ where: { authorId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.unit.deleteMany({ where: { id: { in: [unitId, otherUnitId] } } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.unit.create({ data: { id: otherUnitId, block: `ocorrencias-${suffix}`, number: '2' } });
  await prisma.user.createMany({ data: ids.map((id, index) => ({
    id, name: `Pessoa das ocorrências ${index}`, email: `${index}-ocorrencias-${suffix}@example.com`,
    cpf: `${index}-${suffix}`, password: 'hash-apenas-para-teste',
    role: id === adminId ? 'ADMIN' : id === employeeId ? 'FUNCIONARIO' : id === guestId ? 'VISITANTE' : 'MORADOR',
    isSyndic: id === syndicId,
    unitId: id === noUnitId ? null : id === neighborId ? otherUnitId : unitId,
  })) });
  const auth = {
    resident: bearer(residentId), neighbor: bearer(neighborId), admin: bearer(adminId, 'ADMIN'),
    employee: bearer(employeeId, 'FUNCIONARIO'), syndic: bearer(syndicId, 'MORADOR', true),
    noUnit: bearer(noUnitId), guest: bearer(guestId, 'VISITANTE'),
  };
  let ownId: string;
  let neighborIncidentId: string;

  await t.test('401 sem token e 403 por papel em todas as rotas', async () => {
    for (const token of [undefined, auth.guest]) {
      const calls = [
        request(app).get('/incidents'), request(app).get(`/incidents/${randomUUID()}`),
        request(app).post('/incidents').send(input()),
        request(app).put(`/incidents/${randomUUID()}`).send({ status: 'CLOSED' }),
      ];
      for (const call of calls) {
        if (token) call.set('Authorization', token);
        const result = await call.expect(token ? 403 : 401);
        assert.equal(typeof result.body.error, 'string');
      }
    }
    for (const token of [auth.admin, auth.employee, auth.noUnit]) {
      await request(app).post('/incidents').set('Authorization', token).send(input()).expect(403);
    }
    // A síndica é moradora com unidade e pode registrar ocorrência.
    await request(app).post('/incidents').set('Authorization', auth.syndic).send(input()).expect(201);
    await request(app).put(`/incidents/${randomUUID()}`).set('Authorization', auth.resident).send({ response: 'Forjada' }).expect(403);
  });
  await t.test('valida títulos, descrição, categorias, filtros, parâmetros e PUT vazio', async () => {
    for (const patch of [{ title: '' }, { title: ' ' }, { title: 'a'.repeat(201) }, { description: '' }, { category: 'INVALIDA' }]) {
      await request(app).post('/incidents').set('Authorization', auth.resident).send({ ...input(), ...patch }).expect(400);
    }
    for (const body of [{}, { title: 'Ignorado' }, { status: 'INVALIDO' }, { response: 'a'.repeat(2001) }, { response: null }]) {
      await request(app).put(`/incidents/${randomUUID()}`).set('Authorization', auth.admin).send(body).expect(400);
    }
    for (const query of ['status=INVALIDO', 'category=INVALIDA', 'status=OPEN&status=CLOSED']) {
      await request(app).get(`/incidents?${query}`).set('Authorization', auth.resident).expect(400);
    }
    await request(app).get('/incidents/inválido').set('Authorization', auth.resident).expect(400);
    await request(app).put('/incidents/inválido').set('Authorization', auth.admin).send({ status: 'CLOSED' }).expect(400);
  });
  await t.test('cria OPEN com autor e unidade reais, ignorando campos forjados', async () => {
    const result = await request(app).post('/incidents').set('Authorization', auth.resident).send({
      ...input(), unitId: otherUnitId, authorId: neighborId, status: 'CLOSED', response: 'Forjada', respondedAt: new Date().toISOString(),
    }).expect(201);
    ownId = result.body.id;
    assert.equal(result.body.title, input().title.trim());
    assert.equal(result.body.description, input().description.trim());
    assert.equal(result.body.status, 'OPEN');
    assert.equal(result.body.response, null);
    assert.equal(result.body.respondedAt, null);
    assert.deepEqual(result.body.author, { id: residentId, name: 'Pessoa das ocorrências 0' });
    assert.deepEqual(result.body.unit, { id: unitId, block: `ocorrencias-${suffix}`, number: '1' });
    assert.deepEqual(Object.keys(result.body).sort(), [
      'id', 'title', 'description', 'category', 'status', 'response', 'respondedAt', 'createdAt', 'updatedAt', 'author', 'unit',
    ].sort());
    const stored = await prisma.incident.findUniqueOrThrow({ where: { id: ownId } });
    assert.equal(stored.authorId, residentId);
    assert.equal(stored.unitId, unitId);
    const neighborResult = await request(app).post('/incidents').set('Authorization', auth.neighbor)
      .send({ ...input(), category: 'LIMPEZA' }).expect(201);
    neighborIncidentId = neighborResult.body.id;
  });
  await t.test('IDOR: morador só lista e lê as próprias; painel vê ambas', async () => {
    const own = await request(app).get(`/incidents?authorId=${neighborId}`).set('Authorization', auth.resident).expect(200);
    assert.deepEqual(own.body.map((item: { id: string }) => item.id), [ownId]);
    await request(app).get(`/incidents/${ownId}`).set('Authorization', auth.resident).expect(200);
    const hidden = await request(app).get(`/incidents/${neighborIncidentId}`).set('Authorization', auth.resident).expect(404);
    const absent = await request(app).get(`/incidents/${randomUUID()}`).set('Authorization', auth.resident).expect(404);
    assert.deepEqual(hidden.body, absent.body);
    await request(app).get(`/incidents/${ownId}`).set('Authorization', auth.neighbor).expect(404);
    for (const token of [auth.admin, auth.employee, auth.syndic]) {
      const all = await request(app).get('/incidents').set('Authorization', token).expect(200);
      assert.ok(all.body.some((item: { id: string }) => item.id === ownId));
      assert.ok(all.body.some((item: { id: string }) => item.id === neighborIncidentId));
      const dates = all.body.map((item: { createdAt: string }) => Date.parse(item.createdAt));
      assert.deepEqual(dates, [...dates].sort((a: number, b: number) => b - a));
      await request(app).get(`/incidents/${neighborIncidentId}`).set('Authorization', token).expect(200);
      await request(app).get(`/incidents/${randomUUID()}`).set('Authorization', token).expect(404);
    }
    await request(app).put(`/incidents/${ownId}`).set('Authorization', auth.resident)
      .send({ status: 'RESOLVED', response: 'Forjada' }).expect(403);
    assert.equal((await incidentRepository.findById(ownId))?.status, 'OPEN');
  });
  await t.test('gestão responde e muda status; status isolado preserva respondedAt', async () => {
    const before = Date.now();
    const response = await request(app).put(`/incidents/${ownId}`).set('Authorization', auth.employee)
      .send({ status: 'IN_PROGRESS', response: ' Verificaremos. ', authorId: neighborId, unitId: otherUnitId }).expect(200);
    assert.equal(response.body.response, 'Verificaremos.');
    assert.equal(response.body.status, 'IN_PROGRESS');
    assert.ok(Date.parse(response.body.respondedAt) >= before - 1000 && Date.parse(response.body.respondedAt) <= Date.now());
    assert.equal(response.body.author.id, residentId);
    assert.equal(response.body.unit.id, unitId);
    const statusOnly = await request(app).put(`/incidents/${ownId}`).set('Authorization', auth.syndic)
      .send({ status: 'RESOLVED' }).expect(200);
    assert.equal(statusOnly.body.respondedAt, response.body.respondedAt);
    await request(app).put(`/incidents/${randomUUID()}`).set('Authorization', auth.admin).send({ status: 'CLOSED' }).expect(404);
  });
  await t.test('filtros status e category preservam escopo do morador', async () => {
    for (const [query, expected] of [
      ['status=RESOLVED', [ownId]], ['status=OPEN', []], ['category=BARULHO', [ownId]],
      ['category=LIMPEZA', []], ['status=RESOLVED&category=BARULHO', [ownId]],
      ['status=OPEN&category=BARULHO', []],
    ] as const) {
      const result = await request(app).get(`/incidents?${query}`).set('Authorization', auth.resident).expect(200);
      assert.deepEqual(result.body.map((item: { id: string }) => item.id), expected);
    }
    const panel = await request(app).get('/incidents?status=OPEN&category=LIMPEZA').set('Authorization', auth.admin).expect(200);
    assert.ok(panel.body.some((item: { id: string }) => item.id === neighborIncidentId));
    assert.ok(panel.body.every((item: { status: string; category: string }) => item.status === 'OPEN' && item.category === 'LIMPEZA'));
  });
  await t.test('CLOSED não muda mais, inclusive na escrita condicional do repositório', async () => {
    const closed = await request(app).put(`/incidents/${ownId}`).set('Authorization', auth.admin)
      .send({ status: 'CLOSED', response: 'Encerrada.' }).expect(200);
    for (const body of [{ status: 'OPEN' }, { response: 'Nova resposta' }]) {
      await request(app).put(`/incidents/${ownId}`).set('Authorization', auth.employee).send(body).expect(400);
    }
    assert.equal(await incidentRepository.update(ownId, { status: 'OPEN', response: 'Concorrente' }), null);
    const stored = await request(app).get(`/incidents/${ownId}`).set('Authorization', auth.resident).expect(200);
    assert.deepEqual(stored.body, closed.body);
  });
  await t.test('relação de unidade pode ser nula na leitura sem expor campos pessoais', async () => {
    await prisma.incident.update({ where: { id: neighborIncidentId }, data: { unitId: null } });
    const result = await request(app).get(`/incidents/${neighborIncidentId}`).set('Authorization', auth.neighbor).expect(200);
    assert.equal(result.body.unit, null);
    assert.deepEqual(Object.keys(result.body.author).sort(), ['id', 'name']);
  });
});
