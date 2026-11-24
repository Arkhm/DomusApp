import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { petService as service } from '../src/services/petService';
import { petRepository as repo } from '../src/repositories/petRepository';
import { userRepository } from '../src/repositories/userRepository';
import { createPetSchema, createManagedPetSchema, petQuerySchema } from '../src/schemas/petSchema';

const ownerId = randomUUID();
const unitId = randomUUID();
const pet = { id: randomUUID(), ownerId, name: 'Bolinha', species: 'CACHORRO', size: 'PEQUENO' };
const input = { name: ' Bolinha ', species: 'cachorro', size: 'pequeno' };
const status = (code: number) => (error: any) => error.statusCode === code;
const bearer = (actor: { id: string; role: string; isSyndic?: boolean }) =>
  `Bearer ${createAuthTokens({ ...actor, isSyndic: actor.isSyndic ?? false, tokenVersion: 0 }).token}`;

test('pets: schemas validam filtros e preservam a entrada mobile', async t => {
  assert.deepEqual(createPetSchema.parse({ ...input, ownerId: 'descartado' }), {
    name: 'Bolinha', species: 'CACHORRO', size: 'PEQUENO',
  });
  assert.equal(createManagedPetSchema.parse({ ...input, ownerId }).ownerId, ownerId);
  assert.deepEqual(petQuerySchema.parse({ species: 'gato', size: 'medio', block: ' A ', search: ' Luna ', unitId }), {
    species: 'GATO', size: 'MEDIO', block: 'A', search: 'Luna', unitId,
  });
  for (const filters of [{ species: 'COELHO' }, { size: 'GIGANTE' }, { unitId: 'x' }, { block: {} },
    { block: ' ' }, { search: ['Luna'] }, { search: 'x'.repeat(192) }, { species: { contains: '' } }]) {
    assert.equal(petQuerySchema.safeParse(filters).success, false);
  }
  const create = t.mock.method(repo, 'create', async () => pet as any);
  for (const data of [{ ...input, name: ' ' }, { ...input, name: 'x'.repeat(192) }, { species: 'GATO' },
    { ...input, species: 'COELHO' }, { ...input, size: 'GIGANTE' }, { ...input, ownerId: {} }]) {
    await assert.rejects(service.create(ownerId, data));
  }
  assert.equal(create.mock.callCount(), 0);
});

test('pets: filtros combinam espécie, porte, unidade, bloco e busca parcial', async t => {
  const find = t.mock.method(repo, 'findAll', async () => []);
  await service.listAll({ species: 'gato', size: 'medio', unitId, block: ' A ', search: ' Luna ' });
  assert.deepEqual(find.mock.calls[0].arguments[0], {
    species: 'GATO', size: 'MEDIO', owner: { unitId, unit: { block: 'A' } },
    OR: [{ name: { contains: 'Luna' } }, { owner: { name: { contains: 'Luna' } } }],
  });
  await service.listAll();
  assert.deepEqual(find.mock.calls[1].arguments[0], {});
});

test('pets: repositório limita dados pessoais e ordena por bloco, unidade e nome', async t => {
  const original = prisma.pet.findMany;
  const find = t.mock.fn(async (_args: Parameters<typeof prisma.pet.findMany>[0]) => []);
  prisma.pet.findMany = find as typeof original;
  t.after(() => { prisma.pet.findMany = original; });
  await repo.findAll({ species: 'GATO' });
  const args = find.mock.calls[0].arguments[0]!;
  assert.deepEqual(args.where, { species: 'GATO' });
  assert.deepEqual(args.include, { owner: { select: {
    id: true, name: true, phone: true,
    unit: { select: { id: true, type: true, block: true, number: true } },
  } } });
  assert.deepEqual(args.orderBy, [{ owner: { unit: { block: 'asc' } } }, { owner: { unit: { number: 'asc' } } }, { name: 'asc' }, { id: 'asc' }]);
});

test('pets: cadastro admin exige dono morador ativo; morador ignora ownerId', async t => {
  const lookup = t.mock.method(repo, 'findOwner', async () => ({ id: ownerId, role: 'MORADOR', status: 'ACTIVE' }));
  const create = t.mock.method(repo, 'create', async (data: Parameters<typeof repo.create>[0]) => ({ ...pet, ...data }) as any);
  const adminId = randomUUID();
  assert.equal((await service.create(adminId, { ...input, ownerId }, 'ADMIN')).ownerId, ownerId);
  assert.deepEqual(create.mock.calls[0].arguments[0], { name: 'Bolinha', species: 'CACHORRO', size: 'PEQUENO', ownerId });
  await assert.rejects(service.create(adminId, input, 'ADMIN'), status(400));
  for (const owner of [null, { id: ownerId, role: 'MORADOR', status: 'INACTIVE' },
    { id: ownerId, role: 'ADMIN', status: 'ACTIVE' }, { id: ownerId, role: 'FUNCIONARIO', status: 'ACTIVE' }]) {
    lookup.mock.mockImplementation(async () => owner as any);
    await assert.rejects(service.create(adminId, { ...input, ownerId }, 'ADMIN'), status(400));
  }
  assert.equal(create.mock.callCount(), 1);
  const before = lookup.mock.callCount();
  const own = await service.create(adminId, { ...input, ownerId });
  assert.equal(own.ownerId, adminId);
  assert.equal(lookup.mock.callCount(), before);
  await assert.rejects(service.create(adminId, input, 'FUNCIONARIO'), status(403));
});

test('pets: edição e remoção verificam propriedade e não alteram dono', async t => {
  const find = t.mock.method(repo, 'findById', async () => pet as any);
  const update = t.mock.method(repo, 'update', async (_id: string, data: Parameters<typeof repo.update>[1]) => ({ ...pet, ...data }) as any);
  const remove = t.mock.method(repo, 'delete', async () => pet as any);
  const owner = { id: ownerId, role: 'MORADOR' };
  const foreign = { id: randomUUID(), role: 'MORADOR' };
  await service.update(pet.id, { name: 'Luna', ownerId: foreign.id }, owner);
  assert.deepEqual(update.mock.calls[0].arguments[1], { name: 'Luna' });
  await assert.rejects(service.update(pet.id, { ownerId: foreign.id }, owner));
  await assert.rejects(service.update(pet.id, { name: 'Luna' }, foreign), status(403));
  await assert.rejects(service.delete(pet.id, foreign.id, foreign.role), status(403));
  await assert.rejects(service.delete(pet.id, owner.id, 'FUNCIONARIO'), status(403));
  assert.equal(remove.mock.callCount(), 0);
  await service.delete(pet.id, foreign.id, 'ADMIN');
  await service.delete(pet.id, owner.id, owner.role);
  assert.equal(remove.mock.callCount(), 2);
  find.mock.mockImplementation(async () => null);
  await assert.rejects(service.delete(pet.id, owner.id, owner.role), status(404));
  await assert.rejects(service.update(pet.id, { name: 'Luna' }, owner), status(404));
});

test('pets: HTTP valida filtros, permissões e cadastro sem banco', async t => {
  const actors = [
    { id: randomUUID(), role: 'ADMIN' }, { id: randomUUID(), role: 'FUNCIONARIO' },
    { id: ownerId, role: 'MORADOR' }, { id: randomUUID(), role: 'MORADOR', isSyndic: true },
  ];
  t.mock.method(userRepository, 'findAuthState', async (id: string) => ({ ...actors.find(actor => actor.id === id),
    id, tokenVersion: 0, status: 'ACTIVE' }) as any);
  const find = t.mock.method(repo, 'findAll', async () => []);
  const mine = t.mock.method(repo, 'findByOwner', async () => [pet] as any);
  const lookup = t.mock.method(repo, 'findOwner', async () => ({ id: ownerId, role: 'MORADOR', status: 'ACTIVE' }));
  const create = t.mock.method(repo, 'create', async (data: Parameters<typeof repo.create>[0]) => ({ ...pet, ...data }) as any);
  t.mock.method(repo, 'findById', async () => pet as any);
  const update = t.mock.method(repo, 'update', async (_id: string, data: Parameters<typeof repo.update>[1]) => ({ ...pet, ...data }) as any);
  t.mock.method(repo, 'delete', async () => pet as any);
  for (const [method, path] of [['get', '/pets'], ['get', '/pets/me'], ['post', '/pets'],
    ['put', `/pets/${pet.id}`], ['delete', `/pets/${pet.id}`]] as const) {
    await request(app)[method](path).send(input).expect(401);
  }
  for (const actor of actors) {
    const auth = bearer(actor);
    await request(app).get('/pets').set('Authorization', auth).expect(actor.role === 'MORADOR' ? 403 : 200);
    await request(app).get('/pets/me').set('Authorization', auth).expect(actor.role === 'MORADOR' ? 200 : 403);
    await request(app).post('/pets').set('Authorization', auth).send({ ...input, ownerId })
      .expect(actor.role === 'FUNCIONARIO' ? 403 : 201);
    const canEdit = actor.role === 'ADMIN' || actor.id === ownerId;
    await request(app).put(`/pets/${pet.id}`).set('Authorization', auth).send({ name: 'Luna', ownerId: randomUUID() }).expect(canEdit ? 200 : 403);
    await request(app).delete(`/pets/${pet.id}`).set('Authorization', auth).expect(canEdit ? 200 : 403);
  }
  assert.equal(create.mock.calls.at(-1)!.arguments[0].ownerId, actors[3]!.id);
  assert.ok(update.mock.calls.every(call => !('ownerId' in call.arguments[1])));
  const admin = bearer(actors[0]!);
  await request(app).post('/pets').set('Authorization', admin).send(input).expect(400);
  await request(app).post('/pets').set('Authorization', admin).send({ ...input, ownerId: 'invalid' }).expect(400);
  lookup.mock.mockImplementation(async () => null as any);
  await request(app).post('/pets').set('Authorization', admin).send({ ...input, ownerId }).expect(400);
  for (const query of [{ species: 'OTHER' }, { size: 'GIGANTE' }, { unitId: 'x' }, { search: ['a', 'b'] }]) {
    await request(app).get('/pets').query(query).set('Authorization', admin).expect(400);
  }
  await request(app).get('/pets').query({ species: 'gato', size: 'medio', unitId, block: ' A ', search: ' Lu ' }).set('Authorization', admin).expect(200);
  assert.deepEqual(find.mock.calls.at(-1)!.arguments[0], {
    species: 'GATO', size: 'MEDIO', owner: { unitId, unit: { block: 'A' } },
    OR: [{ name: { contains: 'Lu' } }, { owner: { name: { contains: 'Lu' } } }],
  });
  await request(app).get('/pets/me').query({ ownerId: randomUUID(), unitId: randomUUID() }).set('Authorization', bearer(actors[2]!)).expect(200);
  assert.deepEqual(mine.mock.calls.at(-1)!.arguments, [ownerId]);
  await request(app).put('/pets/invalid').set('Authorization', admin).send({ name: 'Luna' }).expect(400);
  await request(app).delete('/pets/invalid').set('Authorization', admin).expect(400);
});
