import test from 'node:test';
import { Prisma } from '@prisma/client';
import { HttpError } from '../src/lib/httpError';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { vehicleService } from '../src/services/vehicleService';
import { vehicleRepository } from '../src/repositories/vehicleRepository';
import { userRepository } from '../src/repositories/userRepository';
import { unitRepository } from '../src/repositories/unitRepository';

const bearer = (id: string, role = 'MORADOR') =>
  `Bearer ${createAuthTokens({ id, role, isSyndic: false, tokenVersion: 0 }).token}`;

test('veículos: validações do serviço', async t => {
  for (const [name, data, message] of [
    ['placa ausente', { model: 'Carro' }, /obrigatórios/],
    ['modelo ausente', { plate: 'ABC1234' }, /obrigatórios/],
    ['placa inválida', { plate: 'ABC12', model: 'Carro' }, /Placa inválida/],
  ] as const) {
    await t.test(`recusa ${name} antes de consultar o usuário`, async t => {
      const lookup = t.mock.method(userRepository, 'findById', async () => {
        assert.fail('Veículo inválido não pode consultar o usuário.');
      });
      await assert.rejects(() => vehicleService.create(randomUUID(), data), message);
      assert.equal(lookup.mock.callCount(), 0);
    });
  }
  await t.test('recusa usuário inexistente', async t => {
    t.mock.method(userRepository, 'findById', async () => null);
    await assert.rejects(() => vehicleService.listMine(randomUUID()), /Usuário não encontrado/);
  });
  await t.test('recusa usuário sem unidade', async t => {
    t.mock.method(userRepository, 'findById', async () => ({ unitId: null }) as any);
    await assert.rejects(() => vehicleService.listMine(randomUUID()), /nenhuma unidade/);
    await assert.rejects(() => vehicleService.create(randomUUID(), { plate: 'ABC1234', model: 'Carro' }), /nenhuma unidade/);
  });
  await t.test('recusa unidade removida entre as consultas', async t => {
    t.mock.method(unitRepository, 'withLockedUnit', async (_id: string, work: any) => work({}));
    t.mock.method(userRepository, 'findById', async () => ({ unitId: randomUUID() }) as any);
    t.mock.method(unitRepository, 'findById', async () => null);
    await assert.rejects(() => vehicleService.create(randomUUID(), { plate: 'ABC1234', model: 'Carro' }), /Unidade não encontrada/);
  });
});

test('veículos: cadastro consulta e grava usando a transação que bloqueou a unidade', async t => {
  const transaction = {} as any;
  const unitId = randomUUID();
  t.mock.method(userRepository, 'findById', async () => ({ unitId }) as any);
  t.mock.method(unitRepository, 'withLockedUnit', async (id: string, work: any) => {
    assert.equal(id, unitId);
    return work(transaction);
  });
  t.mock.method(unitRepository, 'findById', async (_id: string, tx: any) => {
    assert.equal(tx, transaction); return { parkingSpots: 1 } as any;
  });
  t.mock.method(vehicleRepository, 'countByUnit', async (_id: string, tx: any) => {
    assert.equal(tx, transaction); return 0;
  });
  t.mock.method(vehicleRepository, 'findByPlate', async (_plate: string, tx: any) => {
    assert.equal(tx, transaction); return null;
  });
  t.mock.method(vehicleRepository, 'create', async (data: any, tx: any) => {
    assert.equal(tx, transaction); return data;
  });
  const result = await vehicleService.create(randomUUID(), { plate: 'abc-1234', model: ' Carro ' });
  assert.equal(result.unitId, unitId);
  assert.equal(result.model, 'Carro');
  assert.equal(result.plate, 'ABC1234');
});


const status = (code: number) => (error: any) => error.statusCode === code;

test('veículos: admin escolhe unidade e respeita o mesmo lock e limite', async t => {
  const unitId = randomUUID();
  const tx = {} as any;
  t.mock.method(userRepository, 'findById', async () => { assert.fail('Admin não depende de unidade própria.'); });
  t.mock.method(unitRepository, 'withLockedUnit', async (id: string, work: any) => { assert.equal(id, unitId); return work(tx); });
  const unit = t.mock.method(unitRepository, 'findById', async (_id: string, transaction: any) => {
    assert.equal(transaction, tx); return { parkingSpots: 1 } as any;
  });
  const count = t.mock.method(vehicleRepository, 'countByUnit', async (_id: string, transaction: any) => { assert.equal(transaction, tx); return 0; });
  const plate = t.mock.method(vehicleRepository, 'findByPlate', async (_plate: string, transaction: any) => { assert.equal(transaction, tx); return null; });
  const create = t.mock.method(vehicleRepository, 'create', async (data: any, transaction: any) => { assert.equal(transaction, tx); return data; });
  const data = { plate: 'abc-1234', model: ' Carro ', unitId };
  assert.equal((await vehicleService.create(randomUUID(), data, 'ADMIN')).unitId, unitId);
  await assert.rejects(vehicleService.create(randomUUID(), { plate: 'ABC1234', model: 'Carro' }, 'ADMIN'), status(400));
  await assert.rejects(vehicleService.create(randomUUID(), data, 'FUNCIONARIO'), status(403));
  count.mock.mockImplementation(async () => 1);
  await assert.rejects(vehicleService.create(randomUUID(), data, 'ADMIN'), /ocupadas/);
  unit.mock.mockImplementation(async () => ({ parkingSpots: 0 }) as any);
  await assert.rejects(vehicleService.create(randomUUID(), data, 'ADMIN'), /não possui vagas/);
  unit.mock.mockImplementation(async () => null);
  await assert.rejects(vehicleService.create(randomUUID(), data, 'ADMIN'), status(404));
  unit.mock.mockImplementation(async () => ({ parkingSpots: 1 }) as any);
  count.mock.mockImplementation(async () => 0);
  plate.mock.mockImplementation(async () => ({ id: randomUUID() }) as any);
  await assert.rejects(vehicleService.create(randomUUID(), data, 'ADMIN'), status(409));
  count.mock.mockImplementation(async () => 1);
  await assert.rejects(vehicleService.create(randomUUID(), data, 'ADMIN'), status(409));
  count.mock.mockImplementation(async () => 0);
  plate.mock.mockImplementation(async () => null);
  create.mock.mockImplementation(async () => { throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '7' }); });
  await assert.rejects(vehicleService.create(randomUUID(), data, 'ADMIN'), status(409));
});

test('veículos: morador nunca escolhe outra unidade, mesmo chamando o serviço', async t => {
  const own = randomUUID();
  const tx = {} as any;
  t.mock.method(userRepository, 'findById', async () => ({ unitId: own }) as any);
  t.mock.method(unitRepository, 'withLockedUnit', async (id: string, work: any) => { assert.equal(id, own); return work(tx); });
  t.mock.method(unitRepository, 'findById', async () => ({ parkingSpots: 2 }) as any);
  t.mock.method(vehicleRepository, 'countByUnit', async () => 0);
  t.mock.method(vehicleRepository, 'findByPlate', async () => null);
  t.mock.method(vehicleRepository, 'create', async (data: any) => data);
  const result = await vehicleService.create(randomUUID(), { plate: 'ABC1234', model: 'Carro', unitId: randomUUID() });
  assert.equal(result.unitId, own);
});

test('veículos: filtros chegam ao Prisma com contagem total e ordenação', async t => {
  const unitId = randomUUID();
  const original = prisma.vehicle.findMany;
  const find = t.mock.fn(async (_query: any) => []);
  prisma.vehicle.findMany = find as any;
  t.after(() => { prisma.vehicle.findMany = original; });
  await vehicleService.listAll({ plate: ' ab-c1 ', unitId, block: ' A ' });
  const query = find.mock.calls[0]!.arguments[0] as any;
  assert.deepEqual(query.where, { plate: { contains: 'ABC1' }, unitId, unit: { block: 'A' } });
  assert.deepEqual(query.orderBy, [{ unit: { block: 'asc' } }, { unit: { number: 'asc' } }, { plate: 'asc' }]);
  assert.equal(query.include.unit.select.parkingSpots, true);
  assert.equal(query.include.unit.select._count.select.vehicles, true);
  await assert.rejects(vehicleService.listAll({ unitId: 'inválido' }));
  await assert.rejects(vehicleService.listAll({ block: ' ' }));
});

test('veículos: HTTP valida filtros, cadastro por papel e unidade imutável', async t => {
  const actors = ['ADMIN', 'MORADOR', 'FUNCIONARIO'].map(role => ({ id: randomUUID(), role, isSyndic: false, status: 'ACTIVE', tokenVersion: 0 }));
  const [admin, resident, employee] = actors;
  t.mock.method(userRepository, 'findAuthState', async (id: string) => actors.find(actor => actor.id === id) as any);
  const list = t.mock.method(vehicleService, 'listAll', async (filters: any) => [filters] as any);
  const create = t.mock.method(vehicleService, 'create', async (_id: string, data: any, role?: string) => {
    if (role === 'ADMIN' && !data.unitId) throw new HttpError(400, 'Informe a unidade.');
    return { ...data, role } as any;
  });
  const unitId = randomUUID();
  for (const actor of [admin!, employee!]) {
    const response = await request(app).get('/vehicles').query({ plate: 'abc', block: ' A ', unitId }).set('Authorization', bearer(actor.id, actor.role)).expect(200);
    assert.deepEqual(response.body, [{ plate: 'abc', block: 'A', unitId }]);
    for (const query of [{ unitId: 'nope' }, { block: ' ' }, { plate: 'X'.repeat(21) }, { block: ['A', 'B'] }]) {
      await request(app).get('/vehicles').query(query).set('Authorization', bearer(actor.id, actor.role)).expect(400);
    }
  }
  assert.equal(list.mock.callCount(), 2);
  await request(app).get('/vehicles').set('Authorization', bearer(resident!.id)).expect(403);
  await request(app).get('/vehicles').expect(401);
  const data = { plate: 'ABC1234', model: 'Carro', unitId };
  await request(app).post('/vehicles').set('Authorization', bearer(admin!.id, 'ADMIN')).send(data).expect(201);
  assert.equal(create.mock.calls[0]!.arguments[2], 'ADMIN');
  await request(app).post('/vehicles').set('Authorization', bearer(admin!.id, 'ADMIN')).send({ plate: data.plate, model: data.model }).expect(400);
  create.mock.mockImplementation(async () => { throw new HttpError(409, 'Placa duplicada.'); });
  await request(app).post('/vehicles').set('Authorization', bearer(admin!.id, 'ADMIN')).send(data).expect(409);
  for (const method of ['post', 'put', 'delete'] as const) {
    const url = method === 'post' ? '/vehicles' : `/vehicles/${randomUUID()}`;
    await request(app)[method](url).set('Authorization', bearer(employee!.id, 'FUNCIONARIO')).send(data).expect(403);
  }
  t.mock.method(vehicleRepository, 'findById', async () => ({ unitId }) as any);
  t.mock.method(vehicleRepository, 'update', async (_id: string, changes: any) => { assert.equal(changes.unitId, undefined); return changes; });
  await request(app).put(`/vehicles/${randomUUID()}`).set('Authorization', bearer(admin!.id, 'ADMIN')).send({ model: 'Novo', unitId: randomUUID() }).expect(200);
  await request(app).put(`/vehicles/${randomUUID()}`).set('Authorization', bearer(resident!.id)).send(data).expect(403);
});
