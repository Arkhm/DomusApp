import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { vehicleService } from '../src/services/vehicleService';
import { vehicleRepository } from '../src/repositories/vehicleRepository';
import { userRepository } from '../src/repositories/userRepository';
import { unitRepository } from '../src/repositories/unitRepository';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
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

test('veículos: HTTP, unidade e repositório com MySQL isolado', { skip: !enabled }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração só pode usar banco terminado em _test.');
  const suffix = randomUUID();
  const unitId = randomUUID();
  const otherUnitId = randomUUID();
  const zeroUnitId = randomUUID();
  const limitedUnitId = randomUUID();
  const unitIds = [unitId, otherUnitId, zeroUnitId, limitedUnitId];
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const adminId = randomUUID();
  const peerId = randomUUID();
  const zeroId = randomUUID();
  const limitedId = randomUUID();
  const employeeId = randomUUID();
  const ids = [ownerId, otherId, adminId, peerId, zeroId, limitedId, employeeId];
  t.after(async () => {
    try {
      await prisma.vehicle.deleteMany({ where: { unitId: { in: unitIds } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.unit.createMany({ data: unitIds.map((id, index) => ({
    id, number: `veiculos-${index}-${suffix}`, parkingSpots: index === 2 ? 0 : index === 3 ? 1 : 5,
  })) });
  await prisma.user.createMany({ data: ids.map((id, index) => ({
    id, name: 'Pessoa dos veículos', email: `${index}-veiculos-${suffix}@example.com`,
    cpf: `${index}-${suffix}`, password: 'hash-apenas-para-teste',
    role: index === 2 ? 'ADMIN' : index === 6 ? 'FUNCIONARIO' : 'MORADOR',
    unitId: index === 1 ? otherUnitId : index === 4 ? zeroUnitId : index === 5 ? limitedUnitId : unitId,
  })) });
  const owner = bearer(ownerId);
  const other = bearer(otherId);
  const admin = bearer(adminId, 'ADMIN');
  const peer = bearer(peerId);
  const employee = bearer(employeeId, 'FUNCIONARIO');
  async function uniquePlate(mercosul = false) {
    let plate: string;
    do {
      const letters = Array.from({ length: 3 }, () => String.fromCharCode(65 + randomInt(26))).join('');
      plate = `${letters}${randomInt(10)}${mercosul ? String.fromCharCode(65 + randomInt(26)) : randomInt(10)}${randomInt(100).toString().padStart(2, '0')}`;
    } while (await vehicleRepository.findByPlate(plate));
    return plate;
  }
  const oldPlate = await uniquePlate();
  const mercosulPlate = await uniquePlate(true);
  const foreignPlate = await uniquePlate();
  const ownVehicle = await vehicleService.create(ownerId, { plate: oldPlate, model: 'Carro antigo' });
  const foreignVehicle = await vehicleService.create(otherId, { plate: foreignPlate, model: 'Carro de outra unidade' });

  await t.test('sem token retorna 401 em todas as operações', async () => {
    await request(app).get('/vehicles').expect(401);
    await request(app).get('/vehicles/me').expect(401);
    await request(app).post('/vehicles').send({ plate: mercosulPlate, model: 'Carro' }).expect(401);
    await request(app).delete(`/vehicles/${ownVehicle.id}`).expect(401);
  });
  await t.test('listagem administrativa recusa morador; equipe pode consultar e filtrar placa normalizada', async () => {
    await request(app).get('/vehicles').set('Authorization', owner).expect(403);
    const all = await request(app).get('/vehicles').set('Authorization', employee).expect(200);
    assert.ok(all.body.some((vehicle: { id: string }) => vehicle.id === foreignVehicle.id));
    const response = await request(app).get('/vehicles').query({ plate: oldPlate.toLowerCase() })
      .set('Authorization', admin).expect(200);
    assert.deepEqual(response.body.map((vehicle: { id: string }) => vehicle.id), [ownVehicle.id]);
    assert.equal(response.body[0].unit.id, unitId);
    await request(app).post('/vehicles').set('Authorization', employee)
      .send({ plate: mercosulPlate, model: 'Carro' }).expect(403);
    await request(app).delete(`/vehicles/${ownVehicle.id}`).set('Authorization', employee).expect(403);
  });
  await t.test('moradores da mesma unidade leem seus veículos sem expor outra unidade', async () => {
    for (const auth of [owner, peer]) {
      const response = await request(app).get('/vehicles/me').query({ unitId: otherUnitId })
        .set('Authorization', auth).expect(200);
      assert.deepEqual(response.body.map((vehicle: { id: string }) => vehicle.id), [ownVehicle.id]);
    }
    await request(app).get('/vehicles/me').set('Authorization', other).expect(200)
      .expect(({ body }) => assert.deepEqual(body.map((vehicle: { id: string }) => vehicle.id), [foreignVehicle.id]));
    await request(app).get(`/vehicles/${foreignVehicle.id}`).set('Authorization', owner).expect(404);
  });
  await t.test('IDOR: morador não apaga veículo de outra unidade', async () => {
    await request(app).delete(`/vehicles/${foreignVehicle.id}`).set('Authorization', owner).expect(400)
      .expect(({ body }) => assert.match(body.error, /permissão/));
    assert.equal((await vehicleRepository.findById(foreignVehicle.id))?.unitId, otherUnitId);
    await assert.rejects(() => vehicleService.delete(foreignVehicle.id, randomUUID(), 'MORADOR'), /permissão/);
  });
  await t.test('HTTP aceita placas antiga e Mercosul, normaliza campos e ignora unidade forjada', async () => {
    for (const plate of [mercosulPlate, await uniquePlate()]) {
      const formatted = `${plate.slice(0, 3).toLowerCase()}-${plate.slice(3).toLowerCase()}`;
      const response = await request(app).post('/vehicles').set('Authorization', owner)
        .send({ plate: formatted, model: ' Carro novo ', color: ' Azul ', unitId: otherUnitId }).expect(201);
      assert.equal(response.body.plate, plate);
      assert.equal(response.body.model, 'Carro novo');
      assert.equal(response.body.color, 'Azul');
      assert.equal(response.body.unitId, unitId);
      // Outro morador da mesma unidade também pode gerenciar o veículo.
      await request(app).delete(`/vehicles/${response.body.id}`).set('Authorization', peer).expect(200);
      assert.equal(await vehicleRepository.findById(response.body.id), null);
    }
  });
  await t.test('recusa placa duplicada mesmo em outra unidade', async () => {
    await request(app).post('/vehicles').set('Authorization', other)
      .send({ plate: oldPlate, model: 'Duplicado' }).expect(400)
      .expect(({ body }) => assert.match(body.error, /Já existe/));
    assert.equal(await vehicleRepository.countByUnit(otherUnitId), 1);
  });
  await t.test('unidade sem vaga e unidade lotada não recebem veículos novos', async () => {
    await request(app).post('/vehicles').set('Authorization', bearer(zeroId))
      .send({ plate: await uniquePlate(), model: 'Sem vaga' }).expect(400)
      .expect(({ body }) => assert.match(body.error, /não possui vagas/));
    const first = await vehicleService.create(limitedId, { plate: await uniquePlate(), model: 'Única vaga', color: ' ' });
    assert.equal(first.color, null);
    await request(app).post('/vehicles').set('Authorization', bearer(limitedId))
      .send({ plate: await uniquePlate(), model: 'Excedente' }).expect(400)
      .expect(({ body }) => assert.match(body.error, /ocupadas/));
    assert.equal(await vehicleRepository.countByUnit(limitedUnitId), 1);
  });
  await t.test('admin remove veículo de outra unidade', async () => {
    const vehicle = await vehicleService.create(otherId, { plate: await uniquePlate(), model: 'Removível' });
    await request(app).delete(`/vehicles/${vehicle.id}`).set('Authorization', admin).expect(200);
    assert.equal(await vehicleRepository.findById(vehicle.id), null);
  });
  await t.test('HTTP rejeita placa e modelo inválidos; remoção inexistente falha', async () => {
    for (const data of [{ plate: 'ABC12', model: 'Carro' }, { plate: mercosulPlate, model: ' ' }]) {
      await request(app).post('/vehicles').set('Authorization', owner).send(data).expect(400);
    }
    await request(app).delete(`/vehicles/${randomUUID()}`).set('Authorization', owner).expect(400)
      .expect(({ body }) => assert.match(body.error, /Veículo não encontrado/));
  });
});
