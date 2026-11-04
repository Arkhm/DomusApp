import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { petService } from '../src/services/petService';
import { petRepository } from '../src/repositories/petRepository';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
const bearer = (id: string, role = 'MORADOR') =>
  `Bearer ${createAuthTokens({ id, role, isSyndic: false, tokenVersion: 0 }).token}`;
const input = { name: ' Bolinha ', species: 'cachorro', size: 'pequeno' };

test('pets: validações do serviço', async t => {
  for (const [name, data, message] of [
    ['nome vazio', { ...input, name: ' ' }, /obrigatórios/],
    ['espécie ausente', { name: 'Bolinha', size: 'MEDIO' }, /obrigatórios/],
    ['porte ausente', { name: 'Bolinha', species: 'GATO' }, /obrigatórios/],
    ['espécie inválida', { ...input, species: 'DINOSSAURO' }, /Espécie inválida/],
    ['porte inválido', { ...input, size: 'GIGANTE' }, /Porte inválido/],
  ] as const) {
    await t.test(`recusa ${name} antes de persistir`, async t => {
      const persist = t.mock.method(petRepository, 'create', async () => {
        assert.fail('Pet inválido não pode chegar ao repositório.');
      });
      await assert.rejects(() => petService.create(randomUUID(), data), message);
      assert.equal(persist.mock.callCount(), 0);
    });
  }
});

test('pets: HTTP, propriedade e repositório com MySQL isolado', { skip: !enabled }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração só pode usar banco terminado em _test.');
  const suffix = randomUUID();
  const unitId = randomUUID();
  const otherUnitId = randomUUID();
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const ids = [ownerId, otherId, adminId, employeeId];
  t.after(async () => {
    try {
      await prisma.pet.deleteMany({ where: { ownerId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.unit.deleteMany({ where: { id: { in: [unitId, otherUnitId] } } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.unit.createMany({ data: [
    { id: unitId, number: `pets-${suffix}` },
    { id: otherUnitId, number: `pets-outra-${suffix}` },
  ] });
  await prisma.user.createMany({ data: ids.map((id, index) => ({
    id, name: 'Pessoa dos pets', email: `${index}-pets-${suffix}@example.com`,
    cpf: `${index}-${suffix}`, password: 'hash-apenas-para-teste',
    role: index === 2 ? 'ADMIN' : index === 3 ? 'FUNCIONARIO' : 'MORADOR',
    unitId: index === 1 ? otherUnitId : unitId,
  })) });
  const owner = bearer(ownerId);
  const other = bearer(otherId);
  const admin = bearer(adminId, 'ADMIN');
  const employee = bearer(employeeId, 'FUNCIONARIO');
  const ownPet = await petService.create(ownerId, input);
  const foreignPet = await petService.create(otherId, { name: 'Mimi', species: 'gato', size: 'medio' });

  await t.test('sem token retorna 401 em todas as operações', async () => {
    await request(app).get('/pets').expect(401);
    await request(app).get('/pets/me').expect(401);
    await request(app).post('/pets').send(input).expect(401);
    await request(app).delete(`/pets/${ownPet.id}`).expect(401);
  });
  await t.test('listagem administrativa recusa morador e permite equipe', async () => {
    await request(app).get('/pets').set('Authorization', owner).expect(403);
    for (const auth of [admin, employee]) {
      const response = await request(app).get('/pets').set('Authorization', auth).expect(200);
      const stored = response.body.find((pet: { id: string }) => pet.id === foreignPet.id);
      assert.equal(stored.owner.id, otherId);
      assert.equal(stored.owner.unit.id, otherUnitId);
      assert.ok(!('password' in stored.owner));
    }
    await request(app).post('/pets').set('Authorization', employee).send(input).expect(403);
    await request(app).delete(`/pets/${ownPet.id}`).set('Authorization', employee).expect(403);
  });
  await t.test('morador lista somente seus pets mesmo forçando proprietário ou unidade na query', async () => {
    const response = await request(app).get('/pets/me').query({ ownerId: otherId, unitId: otherUnitId })
      .set('Authorization', owner).expect(200);
    assert.deepEqual(response.body.map((pet: { id: string }) => pet.id), [ownPet.id]);
    const otherResponse = await request(app).get('/pets/me').set('Authorization', other).expect(200);
    assert.deepEqual(otherResponse.body.map((pet: { id: string }) => pet.id), [foreignPet.id]);
    await request(app).get(`/pets/${foreignPet.id}`).set('Authorization', owner).expect(404);
  });
  await t.test('IDOR: não remove pet de outra unidade e preserva o registro', async () => {
    await request(app).delete(`/pets/${foreignPet.id}`).set('Authorization', owner).expect(400)
      .expect(({ body }) => assert.match(body.error, /permissão/));
    assert.equal((await petRepository.findById(foreignPet.id))?.ownerId, otherId);
  });
  await t.test('criação normaliza campos e ignora proprietário enviado no corpo', async () => {
    const response = await request(app).post('/pets').set('Authorization', owner)
      .send({ ...input, ownerId: otherId, unitId: otherUnitId }).expect(201);
    assert.equal(response.body.ownerId, ownerId);
    assert.equal(response.body.name, 'Bolinha');
    assert.equal(response.body.species, 'CACHORRO');
    assert.equal(response.body.size, 'PEQUENO');
    await request(app).delete(`/pets/${response.body.id}`).set('Authorization', owner).expect(200);
    assert.equal(await petRepository.findById(response.body.id), null);
  });
  await t.test('admin pode remover pet de outra unidade', async () => {
    const pet = await petService.create(otherId, { name: 'Piu', species: 'passaro', size: 'pequeno' });
    await request(app).delete(`/pets/${pet.id}`).set('Authorization', admin).expect(200);
    assert.equal(await petRepository.findById(pet.id), null);
  });
  await t.test('HTTP rejeita dados inválidos e remoção de pet inexistente', async () => {
    for (const data of [{ ...input, name: ' ' }, { ...input, species: 'COELHO' }, { ...input, size: 'GIGANTE' }]) {
      await request(app).post('/pets').set('Authorization', owner).send(data).expect(400);
    }
    await request(app).delete(`/pets/${randomUUID()}`).set('Authorization', owner).expect(400)
      .expect(({ body }) => assert.match(body.error, /Pet não encontrado/));
  });
});
