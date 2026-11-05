import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createAuthTokens } from '../src/lib/authTokens';
import { noticeService } from '../src/services/noticeService';
import { eventService } from '../src/services/eventService';
import { petService } from '../src/services/petService';
import { vehicleService } from '../src/services/vehicleService';
import { noticeRepository } from '../src/repositories/noticeRepository';
import { eventRepository } from '../src/repositories/eventRepository';
import { petRepository } from '../src/repositories/petRepository';
import { vehicleRepository } from '../src/repositories/vehicleRepository';
import { updateNoticeSchema, updateEventSchema, updateVotingSchema, updateVehicleSchema, updatePetSchema } from '../src/schemas/updateSchemas';
const admin = { id: randomUUID(), role: 'ADMIN', isSyndic: false, tokenVersion: 0 };
const syndic = { ...admin, id: randomUUID(), role: 'MORADOR', isSyndic: true };
const resident = { ...syndic, id: randomUUID(), isSyndic: false };
const bearer = (actor: typeof admin) => `Bearer ${createAuthTokens(actor).token}`;
const status = (code: number) => (error: any) => error.statusCode === code;

test('PUTs: autenticação, RBAC, campos imutáveis e corpo vazio', async () => {
  for (const path of ['notices', 'events', 'votings', 'vehicles', 'pets']) {
    const url = `/${path}/${randomUUID()}`;
    await request(app).put(url).send({}).expect(401);
    await request(app).put(url).set('Authorization', bearer({ ...admin, role: 'FUNCIONARIO' })).send({}).expect(403);
    await request(app).put(url).set('Authorization', bearer(admin)).send({ authorId: resident.id, ownerId: resident.id, unitId: resident.id, votes: 99 }).expect(400);
  }
  for (const schema of [updateNoticeSchema, updateEventSchema, updateVotingSchema, updateVehicleSchema, updatePetSchema]) {
    assert.equal(schema.safeParse({}).success, false);
  }
  assert.equal(updateNoticeSchema.safeParse({ title: 'x'.repeat(192) }).success, false);
  assert.equal(updateEventSchema.safeParse({ capacity: 1.5 }).success, false);
  assert.equal(updateVotingSchema.safeParse({ options: ['Sim'] }).success, false);
  assert.equal(updatePetSchema.safeParse({ species: 'PEIXE' }).success, false);
  assert.equal(updateVehicleSchema.parse({ plate: 'abc-1234' }).plate, 'ABC1234');
});

test('serviços de edição conferem autoria/propriedade e destinatário final', async t => {
  for (const [service, repository] of [[noticeService, noticeRepository], [eventService, eventRepository]] as const) {
    await t.test('síndica só edita registros próprios; ADMIN pode editar qualquer autor', async t => {
      t.mock.method(repository, 'findById', async () => ({ authorId: syndic.id, targetType: 'ALL', targetUnitId: null }) as any);
      const update = t.mock.method(repository, 'update', async (_id: string, data: any) => data as any);
      assert.equal((await service.update(randomUUID(), { title: ' Novo ' }, syndic)).title, 'Novo');
      await assert.rejects(service.update(randomUUID(), { title: 'Outro' }, { ...syndic, id: randomUUID() }), status(403));
      await service.update(randomUUID(), { title: 'Admin' }, admin);
      await assert.rejects(service.update(randomUUID(), { targetType: 'UNIT' }, admin), status(400));
      assert.equal(update.mock.callCount(), 2);
    });
  }
  await t.test('pet: proprietário ou admin; outro morador e funcionário são negados', async t => {
    t.mock.method(petRepository, 'findById', async () => ({ ownerId: resident.id }) as any);
    t.mock.method(petRepository, 'update', async (_id: string, data: any) => data as any);
    await petService.update(randomUUID(), { name: 'Luna' }, resident);
    await petService.update(randomUUID(), { name: 'Luna' }, admin);
    await assert.rejects(petService.update(randomUUID(), { name: 'Luna' }, syndic), status(403));
    await assert.rejects(petService.update(randomUUID(), { name: 'Luna' }, { ...resident, role: 'FUNCIONARIO' }), status(403));
  });
  await t.test('veículo: somente admin e registro deve existir', async t => {
    await assert.rejects(vehicleService.update(randomUUID(), { model: 'Carro' }, resident), status(403));
    t.mock.method(vehicleRepository, 'findById', async () => null);
    await assert.rejects(vehicleService.update(randomUUID(), { model: 'Carro' }, admin), status(404));
  });
});

test('edições: persistência, leituras e concorrência em MySQL isolado', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/);
  const unit = await prisma.unit.create({ data: { number: randomUUID() } });
  const users = await Promise.all([admin, syndic, resident].map((actor, i) => prisma.user.create({ data: {
    id: actor.id, name: actor.role, email: `${randomUUID()}@test.example`, cpf: `${randomUUID()}`, password: 'hash',
    role: actor.role, isSyndic: actor.isSyndic, unitId: unit.id,
  } })));
  const notice = await prisma.notice.create({ data: { title: 'Original', content: 'Conteúdo', authorId: syndic.id } });
  const event = await prisma.event.create({ data: { title: 'Evento', content: 'Conteúdo', authorId: syndic.id, eventDate: new Date() } });
  const pet = await prisma.pet.create({ data: { name: 'Luna', species: 'GATO', size: 'PEQUENO', ownerId: resident.id } });
  const vehicle = await prisma.vehicle.create({ data: { plate: 'ABC1234', model: 'Modelo', unitId: unit.id } });
  const other = await prisma.vehicle.create({ data: { plate: 'DEF5678', model: 'Outro', unitId: unit.id } });
  const votingIds: string[] = [];
  const voting = async (start: number) => {
    const result = await prisma.voting.create({ data: { title: 'Votação', description: 'Escolha', authorId: admin.id,
      startDate: new Date(Date.now() + start), endDate: new Date(Date.now() + 3600000),
      options: { create: [{ text: 'Sim' }, { text: 'Não' }] },
    }, include: { options: true } });
    votingIds.push(result.id); return result;
  };
  t.after(async () => {
    await prisma.voting.deleteMany({ where: { id: { in: votingIds } } });
    await prisma.notice.delete({ where: { id: notice.id } });
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.pet.delete({ where: { id: pet.id } });
    await prisma.vehicle.deleteMany({ where: { unitId: unit.id } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.unit.delete({ where: { id: unit.id } });
    await prisma.$disconnect();
  });
  const put = (path: string, actor: typeof admin, body: object) => request(app).put(path).set('Authorization', bearer(actor)).send(body);
  await t.test('avisos: mudanças relevantes apagam leituras; status/prioridade preservam', async () => {
    await prisma.noticeRead.create({ data: { noticeId: notice.id, userId: resident.id } });
    await put(`/notices/${notice.id}`, syndic, { priority: 'URGENT', status: 'DRAFT' }).expect(200);
    assert.equal(await prisma.noticeRead.count({ where: { noticeId: notice.id } }), 1);
    await put(`/notices/${notice.id}`, syndic, { content: 'Mudou', status: 'PUBLISHED', authorId: admin.id }).expect(200);
    assert.equal(await prisma.noticeRead.count({ where: { noticeId: notice.id } }), 0);
    assert.equal((await prisma.notice.findUniqueOrThrow({ where: { id: notice.id } })).authorId, syndic.id);
    await put(`/notices/${notice.id}`, { ...syndic, id: resident.id }, { title: 'Negado' }).expect(403);
    await put(`/notices/${notice.id}`, admin, { targetType: 'UNIT', targetUnitId: unit.id }).expect(200);
    await put(`/notices/${notice.id}`, admin, { targetType: 'ALL' }).expect(200).expect(r => assert.equal(r.body.targetUnitId, null));
  });
  await t.test('eventos: cancelamento, limpeza de opcionais e autoria', async () => {
    await put(`/events/${event.id}`, syndic, { status: 'CANCELLED', location: null, capacity: null }).expect(200);
    await put(`/events/${event.id}`, { ...syndic, id: resident.id }, { title: 'Negado' }).expect(403);
    await put(`/events/${event.id}`, admin, { status: 'PUBLISHED' }).expect(200);
  });
  await t.test('veículos: unicidade, unidade imutável; pets: propriedade imutável', async () => {
    await put(`/vehicles/${vehicle.id}`, admin, { plate: other.plate }).expect(409);
    await put(`/vehicles/${vehicle.id}`, admin, { color: null, model: 'Novo', unitId: randomUUID() }).expect(200)
      .expect(r => assert.equal(r.body.unitId, unit.id));
    await put(`/pets/${pet.id}`, resident, { size: 'grande', ownerId: admin.id }).expect(200)
      .expect(r => assert.equal(r.body.ownerId, resident.id));
    await put(`/pets/${pet.id}`, syndic, { name: 'Negado' }).expect(403);
  });
  await t.test('votações: apenas agendadas sem votos; opções inalteradas preservam IDs', async () => {
    const scheduled = await voting(600000);
    await put(`/votings/${scheduled.id}`, syndic, { title: 'Novo' }).expect(200)
      .expect(r => assert.deepEqual(new Set(r.body.options.map((o: any) => o.id)), new Set(scheduled.options.map(o => o.id))));
    const current = await prisma.votingOption.findMany({ where: { votingId: scheduled.id }, orderBy: { createdAt: 'asc' } });
    await put(`/votings/${scheduled.id}`, admin, { options: current.map(option => option.text) }).expect(200)
      .expect(r => assert.deepEqual(r.body.options.map((option: any) => option.id), current.map(option => option.id)));
    await put(`/votings/${scheduled.id}`, admin, { options: ['A', 'B', 'C'] }).expect(200);
    await put(`/votings/${scheduled.id}`, admin, { startDate: new Date(0).toISOString() }).expect(400);
    const open = await voting(-1000);
    await put(`/votings/${open.id}`, admin, { title: 'Negado' }).expect(409);
    const voted = await voting(600000);
    await prisma.votingVote.create({ data: { votingId: voted.id, optionId: voted.options[0]!.id, unitId: unit.id, userId: resident.id } });
    await put(`/votings/${voted.id}`, admin, { title: 'Negado' }).expect(409);
  });
  await t.test('edição e voto concorrentes não invalidam votos ou período', async () => {
    const open = await voting(-1000);
    const results = await Promise.all([
      put(`/votings/${open.id}`, admin, { options: ['X', 'Y'] }),
      request(app).post(`/votings/${open.id}/votes`).set('Authorization', bearer(resident)).send({ optionId: open.options[0]!.id }),
    ]);
    assert.equal(results[0]!.status, 409); assert.equal(results[1]!.status, 201);
    assert.equal(await prisma.votingVote.count({ where: { votingId: open.id } }), 1);
  });
  await t.test('registro inexistente retorna 404', async () => {
    for (const resource of ['notices', 'events', 'votings', 'vehicles', 'pets']) {
      await put(`/${resource}/${randomUUID()}`, admin, { ...({ notices: { title: 'X' }, events: { title: 'X' }, votings: { title: 'X' }, vehicles: { model: 'X' }, pets: { name: 'X' } }[resource]) }).expect(404);
    }
  });
});
