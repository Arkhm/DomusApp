import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';

const bearer = (actor: { id: string; role: string }) =>
  `Bearer ${createAuthTokens({ ...actor, isSyndic: false, tokenVersion: 0 }).token}`;
const input = { name: ' Bolinha ', species: 'cachorro', size: 'pequeno' };

test('pets: filtros, gestão e propriedade com MySQL isolado', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração exige banco terminado em _test.');
  const prefix = randomUUID().slice(0, 8);
  const unitIds = [randomUUID(), randomUUID(), randomUUID()];
  const userIds = Array.from({ length: 5 }, () => randomUUID());
  t.after(async () => {
    try {
      await prisma.pet.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.unit.createMany({ data: unitIds.map((id, n) => ({ id, number: n === 1 ? '101' : '102', block: `${prefix}-${n < 2 ? 'A' : 'B'}` })) });
  const users = [];
  for (const [n, role] of ['ADMIN', 'FUNCIONARIO', 'MORADOR', 'MORADOR', 'MORADOR'].entries()) {
    users.push(await prisma.user.create({ data: {
      id: userIds[n], name: `${n === 2 ? 'DonoPrincipal' : 'Pessoa'}-${prefix}-${n}`, role,
      status: n === 4 ? 'INACTIVE' : 'ACTIVE', phone: '11999990000',
      unitId: n === 2 ? unitIds[0] : n === 3 ? unitIds[1] : unitIds[2],
      email: `${randomUUID()}@example.test`, cpf: randomUUID(), password: 'hash-teste',
    } }));
  }
  const [adminUser, employeeUser, owner, other, inactive] = users;
  const admin = bearer(adminUser!);
  const employee = bearer(employeeUser!);
  const resident = bearer(owner!);
  const foreign = bearer(other!);
  const create = async (name: string, ownerId: string, species = 'GATO', size = 'MEDIO') =>
    (await request(app).post('/pets').set('Authorization', admin).send({ name, ownerId, species, size }).expect(201)).body;
  const zulu = await create('Zulu', owner!.id);
  const alfa = await create('Alfa', owner!.id, 'CACHORRO', 'PEQUENO');
  const otherPet = await create('Mimi', other!.id);

  await t.test('admin exige dono existente, ativo e morador', async () => {
    await request(app).post('/pets').set('Authorization', admin).send(input).expect(400);
    for (const id of [randomUUID(), inactive!.id, adminUser!.id, employeeUser!.id]) {
      await request(app).post('/pets').set('Authorization', admin).send({ ...input, ownerId: id }).expect(400);
      assert.equal(await prisma.pet.count({ where: { ownerId: id } }), 0);
    }
    assert.equal((await prisma.pet.findUniqueOrThrow({ where: { id: zulu.id } })).ownerId, owner!.id);
  });
  await t.test('busca parcial por pet ou dono e todos os filtros combinados', async () => {
    const list = async (query: object) => (await request(app).get('/pets').query(query).set('Authorization', employee).expect(200)).body;
    assert.deepEqual((await list({ block: `${prefix}-A` })).map((p: any) => p.id), [otherPet.id, alfa.id, zulu.id]);
    assert.deepEqual((await list({ block: `${prefix}-A`, unitId: owner!.unitId, species: 'gato', size: 'medio', search: 'ul' })).map((p: any) => p.id), [zulu.id]);
    assert.deepEqual((await list({ search: `DonoPrincipal-${prefix}` })).map((p: any) => p.id), [alfa.id, zulu.id]);
    assert.deepEqual(await list({ block: `${prefix}-B`, unitId: owner!.unitId }), []);
    assert.deepEqual((await list({ block: `${prefix}-A`, size: 'PEQUENO' })).map((p: any) => p.id), [alfa.id]);
    const result = (await list({ unitId: owner!.unitId }))[0];
    assert.deepEqual(Object.keys(result.owner).sort(), ['id', 'name', 'phone', 'unit']);
    assert.deepEqual(Object.keys(result.owner.unit).sort(), ['block', 'id', 'number', 'type']);
    assert.equal(result.owner.phone, owner!.phone);
    assert.equal(result.owner.unit.id, owner!.unitId);
    for (const query of [{ species: 'DINOSSAURO' }, { size: 'GIGANTE' }, { unitId: 'x' }, { search: ['a', 'b'] }]) {
      await request(app).get('/pets').query(query).set('Authorization', admin).expect(400);
    }
  });
  await t.test('mobile normaliza cadastro e ignora tentativa de atribuir outro dono', async () => {
    const created = await request(app).post('/pets').set('Authorization', resident).send({ ...input, ownerId: other!.id }).expect(201);
    assert.equal(created.body.ownerId, owner!.id);
    assert.equal(created.body.name, 'Bolinha');
    assert.equal(created.body.species, 'CACHORRO');
    assert.equal(created.body.size, 'PEQUENO');
    const mine = await request(app).get('/pets/me').query({ ownerId: other!.id, unitId: other!.unitId }).set('Authorization', resident).expect(200);
    assert.ok(mine.body.every((p: any) => p.ownerId === owner!.id));
    assert.ok(!mine.body.some((p: any) => p.id === otherPet.id));
    await request(app).put(`/pets/${created.body.id}`).set('Authorization', resident).send({ name: 'Luna' }).expect(200);
    await request(app).delete(`/pets/${created.body.id}`).set('Authorization', resident).expect(200);
  });
  await t.test('funcionário apenas consulta, morador somente seus pets, admin gerencia', async () => {
    await request(app).get('/pets').set('Authorization', resident).expect(403);
    await request(app).get('/pets/me').set('Authorization', admin).expect(403);
    await request(app).post('/pets').set('Authorization', employee).send({ ...input, ownerId: owner!.id }).expect(403);
    for (const auth of [employee, foreign]) {
      await request(app).put(`/pets/${zulu.id}`).set('Authorization', auth).send({ name: 'Outro' }).expect(403);
      await request(app).delete(`/pets/${zulu.id}`).set('Authorization', auth).expect(403);
    }
    await request(app).put(`/pets/${zulu.id}`).set('Authorization', admin).send({ name: 'Zoe', ownerId: other!.id }).expect(200);
    assert.equal((await prisma.pet.findUniqueOrThrow({ where: { id: zulu.id } })).ownerId, owner!.id);
    await request(app).delete(`/pets/${zulu.id}`).set('Authorization', admin).expect(200);
    assert.equal(await prisma.pet.findUnique({ where: { id: zulu.id } }), null);
    await request(app).delete(`/pets/${randomUUID()}`).set('Authorization', admin).expect(404);
    for (const [method, path] of [['get', '/pets'], ['get', '/pets/me'], ['post', '/pets'],
      ['put', `/pets/${alfa.id}`], ['delete', `/pets/${alfa.id}`]] as const) {
      await request(app)[method](path).send(input).expect(401);
    }
  });
});
