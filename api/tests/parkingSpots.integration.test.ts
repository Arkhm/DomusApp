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
import { vehicleService } from '../src/services/vehicleService';

// Arquivo próprio: roda em outro processo, sem herdar mocks dos testes unitários de vagas.
const bearer = (actor: { id: string; role: string; isSyndic?: boolean }) =>
  `Bearer ${createAuthTokens({ ...actor, isSyndic: actor.isSyndic ?? false, tokenVersion: 0 }).token}`;

test('vagas: HTTP e concorrência em MySQL isolado', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/);
  const prefix = randomUUID().slice(0, 8);
  const units = await Promise.all([0, 1].map(n => prisma.unit.create({ data: { number: `${prefix}-${n}`, block: prefix } })));
  const unitIds = units.map(unit => unit.id);
  const users: Awaited<ReturnType<typeof prisma.user.create>>[] = [];
  t.after(async () => {
    try {
      await prisma.parkingSpot.deleteMany({ where: { OR: [{ unitId: { in: unitIds } }, { number: { startsWith: prefix.toUpperCase() } }] } });
      await prisma.vehicle.deleteMany({ where: { unitId: { in: unitIds } } });
      await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
      await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
    } finally { await prisma.$disconnect(); }
  });
  for (const [role, linkedUnit] of [['ADMIN', null], ['FUNCIONARIO', null], ['MORADOR', unitIds[0]], ['MORADOR', unitIds[1]]] as const) {
    users.push(await prisma.user.create({ data: { role, unitId: linkedUnit, name: 'Pessoa teste vagas',
      email: `${randomUUID()}@example.test`, cpf: randomUUID(), password: 'hash-teste' } }));
  }
  const admin = bearer(users[0]!);
  const employee = bearer(users[1]!);
  const resident = bearer(users[2]!);
  const newSpot = async (n: string, type: 'RESIDENT' | 'VISITOR' | 'DISABLED' = 'RESIDENT') => {
    const result = await request(app).post('/parking-spots').set('Authorization', employee)
      .send({ number: `${prefix}-${n}`, type }).expect(201);
    return result.body as { id: string; number: string; type: string; unitId: string | null };
  };
  const a = await newSpot('01');
  const b = await newSpot('02', 'DISABLED');
  const visitor = await newSpot('03', 'VISITOR');
  const assign = (id: string, target: string | null) => request(app).put(`/parking-spots/${id}/assign`)
    .set('Authorization', employee).send({ unitId: target });
  const count = async (id: string) => (await prisma.unit.findUniqueOrThrow({ where: { id } })).parkingSpots;

  await t.test('atribui tipos elegíveis, filtra e isola a unidade no endpoint me', async () => {
    await assign(a.id, unitIds[0]!).expect(200);
    await assign(b.id, unitIds[1]!).expect(200);
    assert.equal(await count(unitIds[0]!), 1);
    assert.equal(await count(unitIds[1]!), 1);
    await assign(visitor.id, unitIds[0]!).expect(400);
    const mine = await request(app).get('/parking-spots/me').query({ unitId: unitIds[1] }).set('Authorization', resident).expect(200);
    assert.deepEqual(mine.body.map((item: any) => item.id), [a.id]);
    const free = await request(app).get('/parking-spots').query({ free: 'true', type: 'VISITOR' }).set('Authorization', employee).expect(200);
    assert.ok(free.body.some((item: any) => item.id === visitor.id));
    const filtered = await request(app).get('/parking-spots').query({ unitId: unitIds[1], block: prefix, type: 'DISABLED', free: 'false' })
      .set('Authorization', admin).expect(200);
    assert.deepEqual(filtered.body.map((item: any) => item.id), [b.id]);
    await request(app).get('/parking-spots').set('Authorization', resident).expect(403);
    const listedUnits = await request(app).get('/units').set('Authorization', employee).expect(200);
    assert.equal(listedUnits.body.find((unit: any) => unit.id === unitIds[0]).parkingSpotRecords[0].number, a.number);
  });
  await t.test('unicidade normalizada e edição de tipo não permitem visitante com unidade', async () => {
    await request(app).post('/parking-spots').set('Authorization', admin)
      .send({ number: ` ${prefix.toLowerCase()} - 01 `, type: 'RESIDENT' }).expect(409);
    await request(app).put(`/parking-spots/${b.id}`).set('Authorization', employee).send({ number: a.number }).expect(409);
    await request(app).put(`/parking-spots/${a.id}`).set('Authorization', employee).send({ type: 'VISITOR' }).expect(409);
    await request(app).put(`/parking-spots/${a.id}`).set('Authorization', employee).send({ type: 'DISABLED' }).expect(200);
    await assign(a.id, randomUUID()).expect(404);
    await request(app).put(`/units/${unitIds[0]}`).set('Authorization', admin).send({ parkingSpots: 20 }).expect(400);
    await request(app).post('/units').set('Authorization', admin).send({ number: 'X', parkingSpots: 1 }).expect(400);
  });
  await t.test('redução ocupada reverte atribuição, transferência, remoção e contadores', async () => {
    const plate = randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase();
    const vehicle = await prisma.vehicle.create({ data: { unitId: unitIds[0]!, plate, model: 'Teste' } });
    await assign(a.id, null).expect(409);
    await assign(a.id, unitIds[1]!).expect(409);
    await request(app).delete(`/parking-spots/${a.id}`).set('Authorization', employee).expect(409);
    assert.equal((await prisma.parkingSpot.findUniqueOrThrow({ where: { id: a.id } })).unitId, unitIds[0]);
    assert.equal(await count(unitIds[0]!), 1); assert.equal(await count(unitIds[1]!), 1);
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
    await assign(a.id, unitIds[1]!).expect(200);
    assert.equal(await count(unitIds[0]!), 0); assert.equal(await count(unitIds[1]!), 2);
    await assign(a.id, null).expect(200);
    assert.equal(await count(unitIds[1]!), 1);
    await request(app).delete(`/parking-spots/${a.id}`).set('Authorization', employee).expect(200);
    await request(app).delete(`/parking-spots/${a.id}`).set('Authorization', employee).expect(404);
  });
  await t.test('atribuições concorrentes da mesma vaga mantêm um único vínculo e contadores exatos', async () => {
    const c = await newSpot('04');
    const results = await Promise.all(unitIds.map(id => assign(c.id, id)));
    assert.deepEqual(results.map(result => result.status), [200, 200]);
    for (const id of unitIds) {
      assert.equal(await count(id), await prisma.parkingSpot.count({ where: { unitId: id } }));
    }
    await assign(c.id, null).expect(200);
  });
  await t.test('duas desatribuições concorrentes não deixam veículos sem capacidade', async () => {
    const c = await newSpot('05');
    await assign(c.id, unitIds[1]!).expect(200);
    const vehicle = await prisma.vehicle.create({ data: { unitId: unitIds[1]!, plate: randomUUID().slice(0, 7), model: 'Teste' } });
    const responses = await Promise.all([assign(b.id, null), assign(c.id, null)]);
    assert.deepEqual(responses.map(result => result.status).sort(), [200, 409]);
    assert.equal(await count(unitIds[1]!), 1);
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
    await assign(b.id, null).expect(200);
    await assign(c.id, null).expect(200);
  });
  await t.test('cadastros de veículo concorrentes e retirada da última vaga usam o mesmo lock', async () => {
    const c = await newSpot('06');
    await assign(c.id, unitIds[0]!).expect(200);
    const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const plate = () => `${letter()}${letter()}${letter()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const results = await Promise.allSettled([0, 1].map(() => vehicleService.create(users[2]!.id, { plate: plate(), model: 'Concorrente' })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    await assign(c.id, null).expect(409);
    await prisma.vehicle.deleteMany({ where: { unitId: unitIds[0] } });
    const race = await Promise.allSettled([
      service.assign(c.id, { unitId: null }),
      vehicleService.create(users[2]!.id, { plate: plate(), model: 'Corrida' }),
    ]);
    assert.ok(race.some(result => result.status === 'fulfilled'));
    assert.ok(await prisma.vehicle.count({ where: { unitId: unitIds[0] } }) <= await count(unitIds[0]!));
    await prisma.vehicle.deleteMany({ where: { unitId: unitIds[0] } });
    await assign(c.id, null).expect(200);
  });
  await t.test('migration preserva quantidades legadas com numeração provisória', async () => {
    const sql = readFileSync('prisma/migrations/20261107190000_add_numbered_parking_spots/migration.sql', 'utf8');
    // Tabela comum isolada: MySQL não permite referenciar duas vezes uma tabela temporária no CTE.
    const tableName = `RF016UnitTest_${prefix.replaceAll('-', '')}`;
    const unitTable = Prisma.raw(`\`${tableName}\``);
    const insert = sql.slice(sql.indexOf('INSERT INTO')).replaceAll('`ParkingSpot`', '`RF016SpotTest`')
      .replaceAll('`Unit`', `\`${tableName}\``);
    await prisma.$executeRaw`CREATE TABLE ${unitTable} (id VARCHAR(191), parkingSpots INT)`;
    try {
      await prisma.$executeRaw`INSERT INTO ${unitTable} VALUES ('legacy-zero', 0), ('legacy-two', 2), ('legacy-twenty', 20)`;
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`CREATE TEMPORARY TABLE RF016SpotTest LIKE ParkingSpot`;
        try {
          // SQL fixo da migration e identificadores gerados no teste, sem dados de requisição.
          await tx.$executeRawUnsafe(insert);
          const rows = await tx.$queryRaw<{ unitId: string; total: bigint }[]>`SELECT unitId, COUNT(*) AS total FROM RF016SpotTest GROUP BY unitId ORDER BY unitId`;
          assert.deepEqual(rows.map(row => [row.unitId, Number(row.total)]), [['legacy-twenty', 20], ['legacy-two', 2]]);
          const invalid = await tx.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM RF016SpotTest WHERE number NOT LIKE 'PROV-%' OR type <> 'RESIDENT'`;
          assert.equal(Number(invalid[0]!.total), 0);
        } finally { await tx.$executeRaw`DROP TEMPORARY TABLE RF016SpotTest`; }
      });
    } finally { await prisma.$executeRaw`DROP TABLE ${unitTable}`; }
  });
});
