import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { parkingSpotService as service } from '../src/services/parkingSpotService';
import { parkingSpotRepository as repo } from '../src/repositories/parkingSpotRepository';
import { unitRepository } from '../src/repositories/unitRepository';
import { userRepository } from '../src/repositories/userRepository';
import { vehicleRepository } from '../src/repositories/vehicleRepository';
import { vehicleService } from '../src/services/vehicleService';
import { createParkingSpotSchema, parkingSpotQuerySchema } from '../src/schemas/parkingSpotSchema';

const unitId = randomUUID();
const otherUnitId = randomUUID();
const spot = { id: randomUUID(), number: 'A-01', type: 'RESIDENT', unitId, unit: { id: unitId } };
const tx = {} as Prisma.TransactionClient;
const status = (code: number) => (error: any) => error.statusCode === code;
const bearer = (actor: { id: string; role: string; isSyndic?: boolean }) =>
  `Bearer ${createAuthTokens({ ...actor, isSyndic: actor.isSyndic ?? false, tokenVersion: 0 }).token}`;

test('vagas: normalização, validação de filtros, corpo e campos imutáveis', async t => {
  assert.deepEqual(createParkingSpotSchema.parse({ number: ' a - 01 ', type: 'DISABLED' }), { number: 'A-01', type: 'DISABLED' });
  for (const data of [{ number: ' ', type: 'RESIDENT' }, { number: 'X', type: 'OTHER' },
    { number: 'X'.repeat(81), type: 'RESIDENT' }, { number: {}, type: 'RESIDENT' },
    { number: 'X', type: 'RESIDENT', unitId }]) {
    assert.equal(createParkingSpotSchema.safeParse(data).success, false);
  }
  for (const query of [{ type: 'OTHER' }, { free: 'yes' }, { free: ['true'] }, { unitId: 'x' }, { block: {} }]) {
    assert.equal(parkingSpotQuerySchema.safeParse(query).success, false);
  }
  await t.test('consulta usa AND para não sobrescrever unidade com disponibilidade', async t => {
    const find = t.mock.method(repo, 'findAll', async () => []);
    await service.list({ unitId, free: 'true', block: ' A ', type: 'RESIDENT' });
    assert.deepEqual(find.mock.calls[0].arguments[0], {
      type: 'RESIDENT', AND: [{ unitId }, { unit: { block: 'A' } }, { unitId: null }],
    });
    await service.list({ free: 'false' });
    assert.deepEqual(find.mock.calls[1].arguments[0], { type: undefined, AND: [{ unitId: { not: null } }] });
  });
  await t.test('me busca unidade pelo usuário autenticado', async t => {
    t.mock.method(userRepository, 'findById', async () => ({ unitId }) as any);
    const find = t.mock.method(repo, 'findAll', async () => [spot] as any);
    assert.equal((await service.listMine(randomUUID())).length, 1);
    assert.deepEqual(find.mock.calls[0].arguments[0], { unitId });
  });
  await t.test('sem unidade retorna vazio e usuário removido retorna 404', async t => {
    t.mock.method(userRepository, 'findById', async () => ({ unitId: null }) as any);
    assert.deepEqual(await service.listMine(randomUUID()), []);
    t.mock.method(userRepository, 'findById', async () => null);
    await assert.rejects(service.listMine(randomUUID()), status(404));
  });
});

test('vagas: transações, conflitos e sincronização de contadores', async t => {
  const setup = (s: any, record: any = spot) => {
    s.mock.method(repo, 'withLockedSpot', async (_id: string, work: any) => work(tx));
    s.mock.method(repo, 'findById', async () => record);
    s.mock.method(unitRepository, 'lockUnits', async () => {});
    s.mock.method(unitRepository, 'findById', async () => ({ id: otherUnitId }) as any);
  };
  await t.test('atribuição transfere e reconta ambas as unidades sob o mesmo lock', async s => {
    setup(s);
    const locks = s.mock.method(unitRepository, 'lockUnits', async (ids: string[], transaction: any) => {
      assert.deepEqual(ids, [unitId, otherUnitId].sort()); assert.equal(transaction, tx);
    });
    const change = s.mock.method(repo, 'update', async (_id: string, data: any, transaction: any) => {
      assert.equal(transaction, tx); return { ...spot, ...data } as any;
    });
    s.mock.method(repo, 'countByUnit', async (id: string, transaction: any) => {
      assert.equal(transaction, tx); return id === unitId ? 1 : 3;
    });
    s.mock.method(vehicleRepository, 'countByUnit', async () => 1);
    const update = s.mock.method(unitRepository, 'update', async (_id: string, data: any, transaction: any) => {
      assert.equal(transaction, tx); return data;
    });
    assert.equal((await service.assign(spot.id, { unitId: otherUnitId })).unitId, otherUnitId);
    assert.equal(locks.mock.callCount(), 1); assert.equal(change.mock.callCount(), 1);
    assert.deepEqual(update.mock.calls.map((call: any) => call.arguments.slice(0, 2)), [unitId, otherUnitId].sort().map(id =>
      [id, { parkingSpots: id === unitId ? 1 : 3 }]));
  });
  await t.test('desatribuição com veículos excedentes retorna 409 dentro da transação', async s => {
    setup(s);
    s.mock.method(repo, 'update', async () => ({ ...spot, unitId: null }) as any);
    s.mock.method(repo, 'countByUnit', async () => 0);
    s.mock.method(vehicleRepository, 'countByUnit', async () => 1);
    const update = s.mock.method(unitRepository, 'update', async () => assert.fail('Contador inválido.'));
    await assert.rejects(service.assign(spot.id, { unitId: null }), (error: any) =>
      error.statusCode === 409 && /Remova veículos/.test(error.message));
    assert.equal(update.mock.callCount(), 0);
  });
  await t.test('remoção reconta a unidade, incluindo zero vagas', async s => {
    setup(s);
    const remove = s.mock.method(repo, 'delete', async () => spot as any);
    s.mock.method(repo, 'countByUnit', async () => 0);
    s.mock.method(vehicleRepository, 'countByUnit', async () => 0);
    const update = s.mock.method(unitRepository, 'update', async () => ({}) as any);
    await service.delete(spot.id);
    assert.deepEqual(remove.mock.calls[0].arguments, [spot.id, tx]);
    assert.deepEqual(update.mock.calls[0].arguments, [unitId, { parkingSpots: 0 }, tx]);
  });
  await t.test('visitante não recebe unidade; vaga atribuída não pode virar visitante', async s => {
    setup(s, { ...spot, type: 'VISITOR', unitId: null });
    await assert.rejects(service.assign(spot.id, { unitId }), status(400));
    s.mock.method(repo, 'findById', async () => spot as any);
    await assert.rejects(service.update(spot.id, { type: 'VISITOR' }), status(409));
  });
  await t.test('vagas inexistentes, unidade inexistente e atribuição repetida', async s => {
    setup(s, null);
    for (const work of [() => service.delete(spot.id), () => service.update(spot.id, { number: 'A-02' }),
      () => service.assign(spot.id, { unitId })]) await assert.rejects(work(), status(404));
    s.mock.method(repo, 'findById', async () => spot as any);
    s.mock.method(unitRepository, 'findById', async () => null);
    await assert.rejects(service.assign(spot.id, { unitId: otherUnitId }), status(404));
    s.mock.method(unitRepository, 'findById', async () => ({ id: unitId }) as any);
    assert.equal((await service.assign(spot.id, { unitId })).id, spot.id);
  });
  await t.test('edição normaliza número e converte P2002 em 409; outros erros são preservados', async s => {
    setup(s);
    const update = s.mock.method(repo, 'update', async (_id: string, data: any) => ({ ...spot, ...data }) as any);
    assert.equal((await service.update(spot.id, { number: ' b - 02 ', type: 'DISABLED' })).number, 'B-02');
    assert.equal(update.mock.calls[0].arguments[2], tx);
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '7' });
    // Remockar o mesmo método no mesmo teste faz o restore devolver o primeiro mock, não o original.
    const create = s.mock.method(repo, 'create', async () => { throw duplicate; });
    await assert.rejects(service.create({ number: 'A-01', type: 'RESIDENT' }), status(409));
    update.mock.mockImplementation(async () => { throw duplicate; });
    await assert.rejects(service.update(spot.id, { number: 'A-01' }), status(409));
    create.mock.mockImplementation(async () => { throw new Error('Falha'); });
    await assert.rejects(service.create({ number: 'A-01', type: 'RESIDENT' }), /Falha/);
  });
});

test('vagas: HTTP autenticação, papéis e validação sem banco', async t => {
  const actors = [
    { id: randomUUID(), role: 'ADMIN' }, { id: randomUUID(), role: 'FUNCIONARIO' },
    { id: randomUUID(), role: 'MORADOR' }, { id: randomUUID(), role: 'MORADOR', isSyndic: true },
  ];
  t.mock.method(userRepository, 'findAuthState', async (id: string) => ({ ...actors.find(actor => actor.id === id),
    id, tokenVersion: 0, status: 'ACTIVE' }) as any);
  t.mock.method(repo, 'findAll', async () => []);
  t.mock.method(repo, 'create', async (data: any) => ({ id: spot.id, ...data, unitId: null }) as any);
  for (const actor of actors) {
    const manage = actor.role !== 'MORADOR';
    await request(app).get('/parking-spots').set('Authorization', bearer(actor)).expect(manage ? 200 : 403);
    await request(app).post('/parking-spots').set('Authorization', bearer(actor))
      .send({ number: ' a - 01 ', type: 'RESIDENT' }).expect(manage ? 201 : 403);
    for (const [path, body] of [[`/parking-spots/${spot.id}`, {}], [`/parking-spots/${spot.id}/assign`, { unitId: 'invalid' }]] as const) {
      await request(app).put(path).set('Authorization', bearer(actor)).send(body).expect(manage ? 400 : 403);
    }
    if (!manage) await request(app).delete(`/parking-spots/${spot.id}`).set('Authorization', bearer(actor)).expect(403);
  }
  for (const [method, path] of [['get', '/parking-spots'], ['get', '/parking-spots/me'], ['post', '/parking-spots'],
    ['put', `/parking-spots/${spot.id}`], ['put', `/parking-spots/${spot.id}/assign`], ['delete', `/parking-spots/${spot.id}`]] as const) {
    await request(app)[method](path).send({}).expect(401);
  }
  const admin = bearer(actors[0]!);
  for (const query of [{ free: '1' }, { unitId: 'invalid' }, { type: 'OTHER' }]) {
    await request(app).get('/parking-spots').query(query).set('Authorization', admin).expect(400);
  }
  await request(app).delete('/parking-spots/invalid').set('Authorization', admin).expect(400);
  await request(app).post('/parking-spots').set('Authorization', admin).send({ number: 'X', type: 'RESIDENT', unitId }).expect(400);
  t.mock.method(userRepository, 'findById', async () => ({ unitId }) as any);
  await request(app).get('/parking-spots/me').query({ unitId: otherUnitId })
    .set('Authorization', bearer(actors[2]!)).expect(200);
  await request(app).get('/parking-spots/me').set('Authorization', admin).expect(403);
});
