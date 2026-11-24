import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { commonAreaRepository } from '../src/repositories/commonAreaRepository';
import { reservationRepository } from '../src/repositories/reservationRepository';
import { reservationClock, reservationService } from '../src/services/reservationService';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
const resident = { id: randomUUID(), role: 'MORADOR' };
const admin = { id: randomUUID(), role: 'ADMIN' };
const input = () => ({ commonAreaId: randomUUID(), date: '2035-01-01', startTime: '10:00', endTime: '11:00' });
const bearer = (id: string, role = 'MORADOR', isSyndic = false) =>
  `Bearer ${createAuthTokens({ id, role, isSyndic, tokenVersion: 0 }).token}`;
const errorStatus = (status: number) => (error: any) => error.statusCode === status;

test('reservas: validação e relógio de Brasília no serviço', async t => {
  t.mock.method(commonAreaRepository, 'withLockedArea', async (_id: string, work: any) => work({}));
  const find = t.mock.method(commonAreaRepository, 'findById', async () => ({ isActive: true } as any));
  const collision = t.mock.method(reservationRepository, 'hasCollision', async () => false);
  const create = t.mock.method(reservationRepository, 'create', async (data: any) => data);
  const now = t.mock.method(reservationClock, 'now', () => new Date('2035-01-01T12:59:59.999Z'));
  const created = await reservationService.create(resident, { ...input(), userId: admin.id, status: 'APPROVED' } as any);
  assert.equal(create.mock.calls[0]!.arguments[0].userId, resident.id);
  assert.equal(created.status, 'PENDING');
  assert.equal(created.date.toISOString(), '2035-01-01T00:00:00.000Z');
  for (const instant of ['2035-01-01T13:00:00.000Z', '2035-01-01T13:00:00.001Z']) {
    now.mock.mockImplementation(() => new Date(instant));
    await assert.rejects(() => reservationService.create(resident, input()), errorStatus(400));
  }
  for (const patch of [{ date: '2035-02-29' }, { date: '2035-13-01' }, { date: '2035-1-01' },
    { startTime: '24:00' }, { endTime: '10:60' }, { startTime: '11:00' }, { startTime: '12:00' }]) {
    await assert.rejects(() => reservationService.create(resident, { ...input(), ...patch }));
  }
  await assert.rejects(() => reservationService.create(admin, input()), errorStatus(403));
  find.mock.mockImplementation(async () => null);
  await assert.rejects(() => reservationService.create(resident, input()), errorStatus(404));
  find.mock.mockImplementation(async () => ({ isActive: false } as any));
  await assert.rejects(() => reservationService.create(resident, input()), errorStatus(400));
  find.mock.mockImplementation(async () => ({ isActive: true } as any));
  now.mock.mockImplementation(() => new Date('2035-01-01T12:00:00Z'));
  collision.mock.mockImplementation(async () => true);
  await assert.rejects(() => reservationService.create(resident, input()), errorStatus(409));
  assert.equal(create.mock.callCount(), 1);
});

test('reservas: listagem aplica filtros e propriedade no servidor', async t => {
  const find = t.mock.method(reservationRepository, 'findAll', async (where: any) => where);
  const where = await reservationService.list(resident, { status: 'APPROVED', commonAreaId: input().commonAreaId,
    from: '2035-01-01', to: '2035-01-02', userId: admin.id } as any) as any;
  assert.equal(where.userId, resident.id);
  assert.equal(where.status, 'APPROVED');
  assert.equal(where.date.gte.toISOString(), '2035-01-01T00:00:00.000Z');
  assert.equal(where.date.lte.toISOString(), '2035-01-02T00:00:00.000Z');
  for (const user of [admin, { ...resident, isSyndic: true }, { ...admin, role: 'FUNCIONARIO' }]) {
    const query = await reservationService.list(user, {}) as any;
    assert.equal(query.userId, undefined);
  }
  assert.equal(find.mock.callCount(), 4);
  assert.throws(() => reservationService.list(resident, { from: '2035-01-02', to: '2035-01-01' }));
});

test('reservas: transições, IDOR e releitura dentro do bloqueio', async t => {
  t.mock.method(commonAreaRepository, 'withLockedArea', async (_id: string, work: any) => work({}));
  t.mock.method(reservationClock, 'now', () => new Date('2034-01-01T00:00:00Z'));
  const reservation = { id: randomUUID(), ...input(), date: new Date('2035-01-01'), status: 'PENDING',
    commonArea: { id: randomUUID() }, user: { id: resident.id } };
  const find = t.mock.method(reservationRepository, 'findById', async () => reservation as any);
  const collision = t.mock.method(reservationRepository, 'hasCollision', async () => false);
  t.mock.method(reservationRepository, 'update', async (_id: string, data: any) => data);
  for (const [action, user] of [['approve', resident], ['reject', { ...admin, role: 'FUNCIONARIO' }],
    ['cancel', admin]] as const) {
    await assert.rejects(() => reservationService.changeStatus(reservation.id, user, action), errorStatus(403));
  }
  find.mock.mockImplementation(async () => null);
  await assert.rejects(() => reservationService.changeStatus(reservation.id, admin, 'approve'), errorStatus(404));
  let reads = 0;
  find.mock.mockImplementation(async () => (++reads === 1 ? reservation : null) as any);
  await assert.rejects(() => reservationService.changeStatus(reservation.id, admin, 'approve'), errorStatus(404));
  find.mock.mockImplementation(async () => reservation as any);
  await assert.rejects(() => reservationService.changeStatus(reservation.id, { ...resident, id: randomUUID() }, 'cancel'), errorStatus(403));
  for (const action of ['approve', 'reject', 'cancel'] as const) {
    reservation.status = 'CANCELLED';
    await assert.rejects(() => reservationService.changeStatus(reservation.id, action === 'cancel' ? resident : admin, action), errorStatus(400));
  }
  reservation.status = 'PENDING';
  collision.mock.mockImplementation(async () => true);
  await assert.rejects(() => reservationService.changeStatus(reservation.id, admin, 'approve'), errorStatus(409));
  collision.mock.mockImplementation(async () => false);
  assert.equal((await reservationService.changeStatus(reservation.id, admin, 'approve')).status, 'APPROVED');
  assert.equal((await reservationService.changeStatus(reservation.id, { ...resident, isSyndic: true }, 'reject')).rejectionReason, null);
  assert.equal((await reservationService.changeStatus(reservation.id, admin, 'reject', { reason: ' Horário ' })).rejectionReason, 'Horário');
  for (const status of ['PENDING', 'APPROVED']) {
    reservation.status = status;
    assert.equal((await reservationService.changeStatus(reservation.id, resident, 'cancel')).status, 'CANCELLED');
  }
  reservation.date = new Date('2000-01-01'); reservation.status = 'PENDING';
  for (const action of ['approve', 'cancel'] as const) {
    await assert.rejects(() => reservationService.changeStatus(reservation.id, action === 'cancel' ? resident : admin, action), errorStatus(400));
  }
  assert.equal((await reservationService.changeStatus(reservation.id, admin, 'reject')).status, 'REJECTED');
  await assert.rejects(() => reservationService.changeStatus(reservation.id, admin, 'reject', { reason: 'a'.repeat(501) }));
});

test('reservas: HTTP, isolamento e concorrência com MySQL', { skip: !enabled }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração só pode usar banco terminado em _test.');
  const suffix = randomUUID();
  const users = Array.from({ length: 5 }, () => randomUUID());
  const areaIds: string[] = [];
  const unit = await prisma.unit.create({ data: { block: `reservas-${suffix}`, number: '1' } });
  t.after(async () => {
    try {
      await prisma.commonArea.deleteMany({ where: { id: { in: areaIds } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.unit.delete({ where: { id: unit.id } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.user.createMany({ data: users.map((id, i) => ({ id, name: `Pessoa reservas ${suffix}`,
    email: `reserva-${i}-${suffix}@example.com`, cpf: `reserva-${i}-${suffix}`, password: 'hash-teste',
    role: i === 0 ? 'ADMIN' : i === 1 ? 'FUNCIONARIO' : 'MORADOR', isSyndic: i === 3, unitId: i === 2 ? unit.id : null,
  })) });
  const [adminToken, employee, residentToken, syndic, neighbor] = users.map((id, i) => bearer(id, i === 0 ? 'ADMIN' : i === 1 ? 'FUNCIONARIO' : 'MORADOR', i === 3));
  const area = await commonAreaRepository.create({ name: `Reserva ${suffix}` }); areaIds.push(area.id);
  const inactive = await commonAreaRepository.create({ name: `Inativa ${suffix}`, isActive: false }); areaIds.push(inactive.id);
  const date = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const data = { commonAreaId: area.id, date, startTime: '10:00', endTime: '11:00' };
  const create = async (auth = residentToken!, patch = {}) =>
    (await request(app).post('/reservations').set('Authorization', auth).send({ ...data, ...patch }).expect(201)).body;
  await t.test('401 em todas as rotas e 403 em cada papel sem permissão', async () => {
    const id = randomUUID();
    for (const call of [request(app).get('/reservations'), request(app).post('/reservations').send(data),
      request(app).put(`/reservations/${id}/approve`), request(app).put(`/reservations/${id}/reject`).send({}), request(app).delete(`/reservations/${id}`)]) {
      await call.expect(401);
    }
    for (const auth of [adminToken, employee]) {
      await request(app).post('/reservations').set('Authorization', auth!).send(data).expect(403);
      await request(app).delete(`/reservations/${id}`).set('Authorization', auth!).expect(403);
    }
    for (const auth of [residentToken, employee]) {
      await request(app).put(`/reservations/${id}/approve`).set('Authorization', auth!).expect(403);
      await request(app).put(`/reservations/${id}/reject`).set('Authorization', auth!).send({}).expect(403);
    }
  });
  await t.test('validação de datas, horários, parâmetros e área', async () => {
    for (const patch of [{ startTime: '12:00' }, { endTime: '10:00' }, { date: '2000-01-01' },
      { date: '2035-02-29' }, { startTime: '24:00' }, { endTime: '11:60' }, { commonAreaId: inactive.id }]) {
      await request(app).post('/reservations').set('Authorization', residentToken!).send({ ...data, ...patch }).expect(400);
    }
    await request(app).post('/reservations').set('Authorization', residentToken!).send({ ...data, commonAreaId: randomUUID() }).expect(404);
    for (const query of ['status=INVALID', 'commonAreaId=x', 'from=2035-02-29', 'from=2035-01-02&to=2035-01-01', 'status=PENDING&status=APPROVED']) {
      await request(app).get(`/reservations?${query}`).set('Authorization', residentToken!).expect(400);
    }
    for (const action of ['approve', 'reject']) {
      await request(app).put(`/reservations/inválido/${action}`).set('Authorization', adminToken!).send({}).expect(400);
      await request(app).put(`/reservations/${randomUUID()}/${action}`).set('Authorization', adminToken!).send({}).expect(404);
    }
    await request(app).delete('/reservations/inválido').set('Authorization', residentToken!).expect(400);
    await request(app).delete(`/reservations/${randomUUID()}`).set('Authorization', residentToken!).expect(404);
  });
  await t.test('propriedade, formato e filtros de listagem; cancelamento não apaga', async () => {
    const own = await create(residentToken!, { userId: users[4], status: 'APPROVED' });
    const other = await create(neighbor!);
    assert.equal(own.status, 'PENDING'); assert.equal(own.user.id, users[2]);
    assert.equal(own.user.unit.id, unit.id); assert.equal(other.user.unit, null);
    assert.equal(own.date, `${date}T00:00:00.000Z`);
    assert.equal(own.user.password, undefined); assert.equal(own.user.email, undefined);
    assert.deepEqual(Object.keys(own).sort(), ['id', 'date', 'startTime', 'endTime', 'status', 'rejectionReason', 'createdAt', 'commonArea', 'user'].sort());
    await request(app).delete(`/reservations/${other.id}`).set('Authorization', residentToken!).expect(403);
    for (const [auth, panel] of [[residentToken, false], [adminToken, true], [employee, true], [syndic, true]] as const) {
      const { body } = await request(app).get(`/reservations?commonAreaId=${area.id}&status=PENDING&from=${date}&to=${date}`)
        .set('Authorization', auth!).expect(200);
      assert.ok(body.some((item: any) => item.id === own.id));
      assert.equal(body.some((item: any) => item.id === other.id), panel);
    }
    await request(app).delete(`/reservations/${own.id}`).set('Authorization', residentToken!).expect(200);
    assert.equal((await reservationRepository.findById(own.id))?.status, 'CANCELLED');
    await request(app).delete(`/reservations/${own.id}`).set('Authorization', residentToken!).expect(400);
    await request(app).delete(`/reservations/${other.id}`).set('Authorization', neighbor!).expect(200);
  });
  await t.test('aprovação, colisão estrita e horários adjacentes', async () => {
    const first = await create();
    await request(app).put(`/reservations/${first.id}/approve`).set('Authorization', adminToken!).expect(200);
    await request(app).put(`/reservations/${first.id}/approve`).set('Authorization', syndic!).expect(400);
    await request(app).put(`/reservations/${first.id}/reject`).set('Authorization', adminToken!).send({}).expect(400);
    for (const patch of [{}, { startTime: '09:30', endTime: '10:30' }, { startTime: '10:30', endTime: '11:30' },
      { startTime: '09:00', endTime: '12:00' }, { startTime: '10:15', endTime: '10:45' }]) {
      await request(app).post('/reservations').set('Authorization', residentToken!).send({ ...data, ...patch }).expect(409);
    }
    for (const patch of [{ startTime: '09:00', endTime: '10:00' }, { startTime: '11:00', endTime: '12:00' }]) {
      const adjacent = await create(residentToken!, patch);
      await request(app).put(`/reservations/${adjacent.id}/approve`).set('Authorization', syndic!).expect(200);
      await request(app).delete(`/reservations/${adjacent.id}`).set('Authorization', residentToken!).expect(200);
    }
    await request(app).delete(`/reservations/${first.id}`).set('Authorization', residentToken!).expect(200);
  });
  await t.test('rejeição com motivo opcional, limite e reserva no passado', async () => {
    const pending = await create();
    await request(app).put(`/reservations/${pending.id}/reject`).set('Authorization', adminToken!).send({ reason: 'a'.repeat(501) }).expect(400);
    const rejected = await request(app).put(`/reservations/${pending.id}/reject`).set('Authorization', syndic!).send({ reason: ' Manutenção ' }).expect(200);
    assert.equal(rejected.body.rejectionReason, 'Manutenção');
    await request(app).delete(`/reservations/${pending.id}`).set('Authorization', residentToken!).expect(400);
    const past = await create();
    await prisma.reservation.update({ where: { id: past.id }, data: { date: new Date('2000-01-01') } });
    await request(app).put(`/reservations/${past.id}/approve`).set('Authorization', adminToken!).expect(400);
    await request(app).delete(`/reservations/${past.id}`).set('Authorization', residentToken!).expect(400);
    const response = await request(app).put(`/reservations/${past.id}/reject`).set('Authorization', adminToken!).send({}).expect(200);
    assert.equal(response.body.rejectionReason, null);
  });
  await t.test('duas aprovações paralelas deixam exatamente uma APPROVED', async () => {
    const a = await create(); const b = await create(neighbor!);
    const results = await Promise.allSettled([a, b].map(item => reservationService.changeStatus(item.id,
      { id: users[0]!, role: 'ADMIN' }, 'approve')));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    assert.equal(failure.reason.statusCode, 409);
    assert.equal(await prisma.reservation.count({ where: { id: { in: [a.id, b.id] }, status: 'APPROVED' } }), 1);
    assert.equal(await prisma.reservation.count({ where: { id: { in: [a.id, b.id] }, status: 'PENDING' } }), 1);
  });
});
