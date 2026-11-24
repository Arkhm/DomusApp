import { userRepository } from '../src/repositories/userRepository';
import test from 'node:test';
import app from '../src/app';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { unitService } from '../src/services/unitService';
import { unitRepository } from '../src/repositories/unitRepository';


const unit = { id: randomUUID(), type: 'APARTMENT', block: 'A', number: '1', parkingSpots: 2, residents: [] };
function authorization(role: string) {
  return `Bearer ${createAuthTokens({ id: randomUUID(), role, isSyndic: false, tokenVersion: 0 }).token}`;
}

test('unidades: sem token retorna 401 e morador recebe 403 em todas as rotas', async t => {
  t.mock.method(userRepository, 'findAuthState', async (id: string) => ({ id, status: 'ACTIVE', role: 'MORADOR', isSyndic: false, tokenVersion: 0 }));
  for (const [method, path] of [['get', '/units'], ['post', '/units'], ['put', `/units/${unit.id}`],
    ['delete', `/units/${unit.id}`]] as const) {
    assert.equal((await request(app)[method](path).send({})).status, 401);
    assert.equal((await request(app)[method](path).set('Authorization', authorization('MORADOR')).send({})).status, 403);
  }
});

test('unidades: cadastro valida número, tipo, duplicidade e limites de vagas', async t => {
  const cases = [
    { data: { number: '' }, error: /número.*obrigatório/ },
    { data: { number: '1', type: 'GARAGEM' }, error: /Tipo.*inválido/ },
    { data: { number: '1' }, duplicate: unit, error: /apartamento.*bloco/ },
    { data: { number: '1', type: 'HOUSE' }, duplicate: unit, error: /casa.*bloco/ },
    ...[-1, 0, 1, 21, 1.5, NaN].map(parkingSpots => ({ data: { number: '1', parkingSpots }, error: /Gerencie as vagas/ })),
  ];
  for (const scenario of cases) {
    await t.test(JSON.stringify(scenario.data), async s => {
      s.mock.method(unitRepository, 'findByBlockAndNumber', async () => ('duplicate' in scenario ? scenario.duplicate : null) as any);
      const create = s.mock.method(unitRepository, 'create', async () => { throw new Error('Gravação indevida.'); });
      await assert.rejects(unitService.create(scenario.data), scenario.error);
      assert.equal(create.mock.callCount(), 0);
    });
  }
});

test('unidades: edição e exclusão validam existência, tipo, duplicidade e moradores', async t => {
  await t.test('unidade inexistente', async s => {
    s.mock.method(unitRepository, 'findById', async () => null);
    await assert.rejects(unitService.update(unit.id, {}), /não encontrada/);
    await assert.rejects(unitService.delete(unit.id), /não encontrada/);
  });
  await t.test('tipo inválido e unidade ocupada por moradores', async s => {
    s.mock.method(unitRepository, 'findById', async () => ({ ...unit, residents: [{ id: randomUUID() }] }) as any);
    const remove = s.mock.method(unitRepository, 'delete', async () => { throw new Error('Exclusão indevida.'); });
    await assert.rejects(unitService.update(unit.id, { type: 'GARAGEM' }), /Tipo.*inválido/);
    await assert.rejects(unitService.delete(unit.id), /moradores vinculados/);
    assert.equal(remove.mock.callCount(), 0);
  });
  for (const type of ['HOUSE', 'APARTMENT']) {
    await t.test(`conflito de ${type}`, async s => {
      s.mock.method(unitRepository, 'findById', async () => unit as any);
      s.mock.method(unitRepository, 'findByBlockAndNumber', async () => ({ ...unit, id: randomUUID() }) as any);
      const update = s.mock.method(unitRepository, 'update', async () => { throw new Error('Gravação indevida.'); });
      await assert.rejects(unitService.update(unit.id, { type, number: '2' }), /Já existe/);
      assert.equal(update.mock.callCount(), 0);
    });
  }
});

test('unidades: contador só pode ser alterado pelo módulo de vagas', async t => {
  t.mock.method(unitRepository, 'findByBlockAndNumber', async () => null);
  t.mock.method(unitRepository, 'findById', async () => unit as any);
  const update = t.mock.method(unitRepository, 'update', async (_id: string, data: any) => ({ ...unit, ...data }) as any);
  for (const parkingSpots of [0, 1, 2, 20]) {
    await assert.rejects(unitService.update(unit.id, { parkingSpots }), /Gerencie as vagas/);
  }
  assert.equal(update.mock.callCount(), 0);
  const result = await unitService.update(unit.id, { number: '2' });
  assert.equal(result.parkingSpots, 2);
  assert.equal(result.number, '2');
  assert.equal('parkingSpots' in update.mock.calls[0].arguments[1], false);
});

test('unidades: HTTP e repository com MySQL isolado', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/);
  const prefix = randomUUID();
  const ids: string[] = [];
  const residentId = randomUUID();
  const staffIds: string[] = [];
  t.after(async () => {
    try {
      await prisma.user.deleteMany({ where: { id: { in: [residentId, ...staffIds] } } });
      await prisma.unit.deleteMany({ where: { OR: [{ id: { in: ids } }, { block: prefix }] } });
    } finally { await prisma.$disconnect(); }
  });
  const authorizePersisted = async (role: string) => {
    const user = await prisma.user.create({ data: { name: role, role, cpf: randomUUID(), email: `${randomUUID()}@example.test`, password: 'hash' } });
    staffIds.push(user.id);
    return `Bearer ${createAuthTokens(user).token}`;
  };
  const admin = await authorizePersisted('ADMIN');
  let createdId: string;

  await t.test('cria apartamento e casa com normalização e contador inicialmente zerado', async () => {
    for (const type of ['apartment', 'house'] as const) {
      const result = await request(app).post('/units').set('Authorization', admin)
        .send({ type, block: prefix, number: '1' });
      assert.equal(result.status, 201);
      createdId = result.body.id;
      ids.push(createdId);
      assert.equal(result.body.type, type.toUpperCase());
      assert.equal(result.body.parkingSpots, 0);
      assert.equal((await unitRepository.findById(createdId))?.number, '1');
    }
    const emptyBlock = await unitService.create({ type: 'house', number: prefix.slice(0, 20) });
    ids.push(emptyBlock.id);
    assert.equal(emptyBlock.block, null);
    assert.equal((await unitRepository.findByBlockAndNumber(null, prefix.slice(0, 20)))?.id, emptyBlock.id);
  });

  await t.test('funcionário pode listar, mas não criar, editar ou excluir', async () => {
    const employee = await authorizePersisted('FUNCIONARIO');
    const list = await request(app).get('/units').set('Authorization', employee);
    assert.equal(list.status, 200);
    assert.ok(list.body.some((item: any) => item.id === createdId));
    for (const [method, path] of [['post', '/units'], ['put', `/units/${createdId}`], ['delete', `/units/${createdId}`]] as const) {
      assert.equal((await request(app)[method](path).set('Authorization', employee).send({ number: '2' })).status, 403);
    }
  });

  await t.test('duplicidade e vagas inválidas retornam 400 sem alterar a unidade', async () => {
    const duplicate = await request(app).post('/units').set('Authorization', admin)
      .send({ type: 'HOUSE', block: prefix, number: '1' });
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body.error, /Já existe/);
    for (const parkingSpots of [-1, 21, 1.5]) {
      assert.equal((await request(app).put(`/units/${createdId}`).set('Authorization', admin).send({ parkingSpots })).status, 400);
    }
    assert.equal((await unitRepository.findById(createdId))?.parkingSpots, 0);
  });

  await t.test('edição atualiza identidade, limpa bloco e preserva vagas omitidas', async () => {
    const result = await request(app).put(`/units/${createdId}`).set('Authorization', admin)
      .send({ type: 'apartment', block: '', number: prefix.slice(0, 20) });
    assert.equal(result.status, 200);
    assert.equal(result.body.type, 'APARTMENT');
    assert.equal(result.body.block, null);
    assert.equal(result.body.parkingSpots, 0);
    assert.equal((await unitRepository.findById(createdId))?.number, prefix.slice(0, 20));
  });

  await t.test('unidade com morador não pode ser excluída; sem vínculo pode', async () => {
    await prisma.user.create({ data: { id: residentId, name: 'Morador da unidade', email: `${prefix}@example.test`,
      cpf: prefix, password: 'hash-teste', unitId: createdId } });
    const blocked = await request(app).delete(`/units/${createdId}`).set('Authorization', admin);
    assert.equal(blocked.status, 400);
    assert.match(blocked.body.error, /moradores vinculados/);
    assert.ok(await unitRepository.findById(createdId));
    await prisma.user.delete({ where: { id: residentId } });
    const removed = await request(app).delete(`/units/${createdId}`).set('Authorization', admin);
    assert.equal(removed.status, 200);
    assert.match(removed.body.message, /removida com sucesso/);
    assert.equal(await unitRepository.findById(createdId), null);
  });
});
