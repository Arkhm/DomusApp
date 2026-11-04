import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { commonAreaRepository } from '../src/repositories/commonAreaRepository';
import { commonAreaService } from '../src/services/commonAreaService';
import { reservationClock } from '../src/services/reservationService';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
const bearer = (id: string, role = 'MORADOR', isSyndic = false) =>
  `Bearer ${createAuthTokens({ id, role, isSyndic, tokenVersion: 0 }).token}`;

test('áreas comuns: serviço normaliza e restringe os campos', async t => {
  const persist = t.mock.method(commonAreaRepository, 'create', async (data: any) => data);
  assert.deepEqual(await commonAreaService.create({ name: ' Salão ', capacity: null, userId: 'intruso' } as any),
    { name: 'Salão', capacity: null });
  for (const data of [{ name: '' }, { name: 'a'.repeat(101) }, { name: 'Salão', capacity: 0 },
    { name: 'Salão', capacity: 1.5 }, { name: 'Salão', isActive: 'false' }]) {
    assert.throws(() => commonAreaService.create(data as any));
  }
  assert.equal(persist.mock.callCount(), 1);
  assert.throws(() => commonAreaService.update(randomUUID(), {}));
});

test('áreas comuns: serviço trata visibilidade, inexistência e o dia em Brasília', async t => {
  const calls: boolean[] = [];
  t.mock.method(commonAreaRepository, 'findAll', async (panel: boolean) => { calls.push(panel); return []; });
  for (const user of [{ role: 'MORADOR' }, { role: 'ADMIN' }, { role: 'FUNCIONARIO' }, { role: 'MORADOR', isSyndic: true }]) {
    await commonAreaService.list(user);
  }
  assert.deepEqual(calls, [false, true, true, true]);
  t.mock.method(commonAreaRepository, 'withLockedArea', async (_id: string, work: any) => work({}));
  const find = t.mock.method(commonAreaRepository, 'findById', async () => null as any);
  for (const operation of [() => commonAreaService.update(randomUUID(), { name: 'Novo' }),
    () => commonAreaService.delete(randomUUID())]) {
    await assert.rejects(operation, (error: any) => error.statusCode === 404);
  }
  find.mock.mockImplementation(async () => ({ id: randomUUID() } as any));
  t.mock.method(reservationClock, 'now', () => new Date('2035-01-02T02:59:59Z'));
  const future = t.mock.method(commonAreaRepository, 'hasFutureReservations', async (_id: string, today: Date) => {
    assert.equal(today.toISOString(), '2035-01-01T00:00:00.000Z'); return true;
  });
  await assert.rejects(() => commonAreaService.delete(randomUUID()), (error: any) => error.statusCode === 400);
  future.mock.mockImplementation(async () => false);
  t.mock.method(commonAreaRepository, 'delete', async () => ({} as any));
  assert.match((await commonAreaService.delete(randomUUID())).message, /removida/);
  t.mock.method(commonAreaRepository, 'update', async (_id: string, data: any) => data);
  assert.deepEqual(await commonAreaService.update(randomUUID(), { name: ' Novo ' }), { name: 'Novo' });
});

test('áreas comuns: HTTP e repositório com banco isolado', { skip: !enabled }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração só pode usar banco terminado em _test.');
  const suffix = randomUUID();
  const users = Array.from({ length: 4 }, () => randomUUID());
  const areas: string[] = [];
  await prisma.user.createMany({ data: users.map((id, i) => ({ id, name: `Pessoa áreas ${suffix}`,
    email: `area-${i}-${suffix}@example.com`, cpf: `area-${i}-${suffix}`, password: 'hash-teste',
    role: i === 0 ? 'ADMIN' : i === 1 ? 'FUNCIONARIO' : 'MORADOR', isSyndic: i === 3,
  })) });
  t.after(async () => {
    try {
      await prisma.commonArea.deleteMany({ where: { id: { in: areas } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    } finally { await prisma.$disconnect(); }
  });
  const [admin, employee, resident, syndic] = users.map((id, i) => bearer(id, i === 0 ? 'ADMIN' : i === 1 ? 'FUNCIONARIO' : 'MORADOR', i === 3));
  const areaData = { name: ` Salão ${suffix} `, description: ' Descrição ', capacity: 10, rules: ' Silêncio ' };
  const create = async (patch = {}) => {
    const result = await request(app).post('/common-areas').set('Authorization', admin!).send({ ...areaData, ...patch }).expect(201);
    areas.push(result.body.id); return result.body;
  };
  await t.test('autenticação e todos os papéis das rotas ADMIN', async () => {
    const id = randomUUID();
    await request(app).get('/common-areas').expect(401);
    for (const auth of [undefined, resident, employee, syndic]) {
      for (const call of [request(app).post('/common-areas').send(areaData),
        request(app).put(`/common-areas/${id}`).send({ name: 'Novo' }), request(app).delete(`/common-areas/${id}`)]) {
        if (auth) call.set('Authorization', auth);
        await call.expect(auth ? 403 : 401);
      }
    }
  });
  await t.test('CRUD, validações e visibilidade de área inativa', async () => {
    for (const data of [{}, { name: ' ' }, { name: 'a'.repeat(101) }, { name: 'A', capacity: -1 },
      { name: 'A', capacity: 1.5 }, { name: 'A', isActive: 'false' }]) {
      await request(app).post('/common-areas').set('Authorization', admin!).send(data).expect(400);
    }
    const active = await create();
    assert.equal(active.name, areaData.name.trim());
    assert.equal(active.rules, 'Silêncio');
    const inactive = await create({ name: `A inativa ${suffix}`, isActive: false, capacity: null });
    for (const [auth, seesInactive] of [[resident, false], [admin, true], [employee, true], [syndic, true]] as const) {
      const { body } = await request(app).get('/common-areas').set('Authorization', auth!).expect(200);
      assert.equal(body.some((item: any) => item.id === inactive.id), seesInactive);
      assert.ok(body.some((item: any) => item.id === active.id));
      if (seesInactive) assert.ok(body.findIndex((item: any) => item.id === inactive.id) < body.findIndex((item: any) => item.id === active.id));
    }
    await request(app).put(`/common-areas/${active.id}`).set('Authorization', admin!).send({}).expect(400);
    await request(app).put('/common-areas/inválido').set('Authorization', admin!).send({ name: 'Novo' }).expect(400);
    await request(app).delete('/common-areas/inválido').set('Authorization', admin!).expect(400);
    await request(app).put(`/common-areas/${randomUUID()}`).set('Authorization', admin!).send({ name: 'Novo' }).expect(404);
    await request(app).delete(`/common-areas/${randomUUID()}`).set('Authorization', admin!).expect(404);
    const updated = await request(app).put(`/common-areas/${active.id}`).set('Authorization', admin!)
      .send({ description: null, capacity: null, rules: null, isActive: false }).expect(200);
    assert.equal(updated.body.capacity, null);
    assert.equal(updated.body.isActive, false);
    await request(app).delete(`/common-areas/${inactive.id}`).set('Authorization', admin!).expect(200);
    assert.equal(await commonAreaRepository.findById(inactive.id), null);
  });
  await t.test('remoção bloqueia PENDING e APPROVED de hoje em diante e permite histórico', async () => {
    const area = await create();
    const date = new Date(); date.setUTCDate(date.getUTCDate() + 2); date.setUTCHours(0, 0, 0, 0);
    const reservation = await prisma.reservation.create({ data: { commonAreaId: area.id, userId: users[2]!, date,
      startTime: '10:00', endTime: '11:00' } });
    for (const status of ['PENDING', 'APPROVED'] as const) {
      await prisma.reservation.update({ where: { id: reservation.id }, data: { status } });
      const response = await request(app).delete(`/common-areas/${area.id}`).set('Authorization', admin!).expect(400);
      assert.match(response.body.error, /desative/);
    }
    await prisma.reservation.update({ where: { id: reservation.id }, data: { date: new Date('2000-01-01') } });
    await request(app).delete(`/common-areas/${area.id}`).set('Authorization', admin!).expect(200);
    assert.equal(await prisma.reservation.count({ where: { id: reservation.id } }), 0);
  });
});
