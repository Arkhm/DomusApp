import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { votingService } from '../src/services/votingService';
import { votingRepository } from '../src/repositories/votingRepository';
import { userRepository } from '../src/repositories/userRepository';
import { Prisma } from '@prisma/client';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
const input = () => ({
  title: ' Nova portaria ', description: ' Escolha uma opção ',
  startDate: new Date(Date.now() + 86_400_000).toISOString(),
  endDate: new Date(Date.now() + 172_800_000).toISOString(),
  options: [' Sim ', ' Não '], authorId: randomUUID(),
});
const bearer = (id: string, role = 'MORADOR', isSyndic = false) =>
  `Bearer ${createAuthTokens({ id, role, isSyndic, tokenVersion: 0 }).token}`;

test('votações: validações do serviço', async t => {
  const cases = [
    ['título vazio', { title: ' ' }, /Título é obrigatório/],
    ['descrição vazia', { description: ' ' }, /Descrição é obrigatória/],
    ['início ausente', { startDate: '' }, /obrigatórias/],
    ['término ausente', { endDate: '' }, /obrigatórias/],
    ['início inválido', { startDate: 'inválida' }, /Data de início inválida/],
    ['término inválido', { endDate: 'inválida' }, /Data de término inválida/],
    ['término antes do início', { endDate: new Date().toISOString() }, /anterior/],
    ['datas iguais', { startDate: '2030-01-01', endDate: '2030-01-01' }, /anterior/],
    ['menos de duas opções', { options: ['Sim'] }, /pelo menos duas/],
    ['opções sem array', { options: null }, /pelo menos duas/],
    ['opção em branco', { options: ['Sim', ' '] }, /conter texto/],
    ['opção não textual', { options: ['Sim', 1] }, /conter texto/],
  ] as const;
  for (const [name, patch, message] of cases) {
    await t.test(`recusa ${name} sem persistir`, async t => {
      const persist = t.mock.method(votingRepository, 'create', async () => {
        assert.fail('Votação inválida não pode chegar ao repositório.');
      });
      await assert.rejects(() => votingService.create({ ...input(), ...patch } as Parameters<typeof votingService.create>[0]), message);
      assert.equal(persist.mock.callCount(), 0);
    });
  }
  await t.test('recusa criar votação com período já encerrado', async t => {
    t.mock.method(votingRepository, 'create', async (data: Parameters<typeof votingRepository.create>[0]) => data as any);
    await assert.rejects(() => votingService.create({
      ...input(), startDate: '2000-01-01', endDate: '2000-01-02',
    }));
  });
});

test('votações: status conforme as datas e limites inclusivos', async () => {
  // O status é derivado no cliente; a API persiste apenas a janela de tempo.
  const { getVotingStatus } = await import('../../web/src/types/voting.js');
  const voting = { startDate: '2030-01-01T10:00:00.000Z', endDate: '2030-01-01T11:00:00.000Z' };
  for (const [now, expected] of [
    ['2030-01-01T09:59:59.999Z', 'SCHEDULED'],
    ['2030-01-01T10:00:00.000Z', 'ACTIVE'],
    ['2030-01-01T10:30:00.000Z', 'ACTIVE'],
    ['2030-01-01T11:00:00.000Z', 'ACTIVE'],
    ['2030-01-01T11:00:00.001Z', 'CLOSED'],
  ]) {
    assert.equal(getVotingStatus(voting as Parameters<typeof getVotingStatus>[0], new Date(now!)), expected);
  }
});
test('votações: regras do voto no serviço', async t => {
  const optionId = randomUUID();
  const resident = { id: randomUUID(), role: 'MORADOR', unitId: randomUUID() };
  const votingAt = (start: number, end: number) => ({
    id: randomUUID(), startDate: new Date(Date.now() + start), endDate: new Date(Date.now() + end),
    options: [{ id: optionId }],
  });
  const arrange = (t: any, voting: unknown, user: unknown = resident) => {
    t.mock.method(userRepository, 'findById', async () => user);
    t.mock.method(votingRepository, 'findById', async () => voting);
    return t.mock.method(votingRepository, 'castVote', async () => ({}));
  };

  await t.test('registra o voto da unidade dentro do período', async t => {
    const cast = arrange(t, votingAt(-60_000, 60_000));
    assert.match((await votingService.vote(randomUUID(), optionId, resident.id)).message, /registrado/);
    assert.equal(cast.mock.calls[0]!.arguments[0].unitId, resident.unitId);
  });
  for (const [name, voting, message] of [
    ['antes do início', votingAt(60_000, 120_000), /ainda não começou/],
    ['após o encerramento', votingAt(-120_000, -60_000), /já foi encerrada/],
  ] as const) {
    await t.test(`recusa voto ${name}`, async t => {
      const cast = arrange(t, voting);
      await assert.rejects(() => votingService.vote(voting.id, optionId, resident.id),
        (error: any) => error.statusCode === 409 && message.test(error.message));
      assert.equal(cast.mock.callCount(), 0);
    });
  }
  await t.test('recusa opção de outra votação', async t => {
    arrange(t, votingAt(-60_000, 60_000));
    await assert.rejects(() => votingService.vote(randomUUID(), randomUUID(), resident.id), /Opção inválida/);
  });
  for (const [name, user] of [
    ['usuário inexistente', null], ['funcionário', { ...resident, role: 'FUNCIONARIO' }],
    ['morador sem unidade', { ...resident, unitId: null }],
  ] as const) {
    await t.test(`recusa ${name} com 403`, async t => {
      arrange(t, votingAt(-60_000, 60_000), user);
      await assert.rejects(() => votingService.vote(randomUUID(), optionId, resident.id),
        (error: any) => error.statusCode === 403);
    });
  }
  await t.test('votação inexistente retorna 404', async t => {
    arrange(t, null);
    await assert.rejects(() => votingService.vote(randomUUID(), optionId, resident.id),
      (error: any) => error.statusCode === 404);
  });
  await t.test('recusa voto duplicado da mesma unidade com 409', async t => {
    const cast = arrange(t, votingAt(-60_000, 60_000));
    cast.mock.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('duplicado', { code: 'P2002', clientVersion: 'teste' });
    });
    await assert.rejects(() => votingService.vote(randomUUID(), optionId, resident.id),
      (error: any) => error.statusCode === 409 && /já votou/.test(error.message));
  });
});

test('votações: listagem protege resultados e retorna o voto da unidade', async t => {
  const resident = { id: randomUUID(), role: 'MORADOR', unitId: randomUUID() };
  const votedAt = new Date('2026-01-01T12:00:00.000Z');
  const fixture = (endDate = new Date(Date.now() + 60_000)) => ({
    id: randomUUID(), title: 'Portaria', description: 'Escolha',
    startDate: new Date(Date.now() - 60_000), endDate,
    author: { name: 'Administração', role: 'ADMIN' },
    options: [{ id: 'sim', text: 'Sim', votes: 7 }, { id: 'nao', text: 'Não', votes: 3 }],
    ballots: [{ optionId: 'sim', createdAt: votedAt, user: { name: 'Outro morador da unidade' } }],
  });
  const arrange = (t: any, item: unknown, user: unknown = resident) => {
    t.mock.method(userRepository, 'findById', async () => user);
    return t.mock.method(votingRepository, 'findAll', async () => [item]);
  };
  await t.test('myVote inclui quem votou pela unidade e não expõe ballots nem contagens parciais', async t => {
    const find = arrange(t, fixture());
    const [item] = await votingService.list(resident);
    assert.equal(find.mock.calls[0]!.arguments[0], resident.unitId);
    assert.deepEqual(item!.myVote, { optionId: 'sim', votedAt, votedBy: 'Outro morador da unidade' });
    assert.ok(!('ballots' in item!));
    assert.ok(item!.options.every(option => !('votes' in option)));
  });
  await t.test('morador de unidade sem voto recebe null', async t => {
    arrange(t, { ...fixture(), ballots: [] });
    assert.equal((await votingService.list(resident))[0]!.myVote, null);
  });
  await t.test('perfil sem unidade não consulta votos de outras unidades', async t => {
    const find = arrange(t, { ...fixture(), ballots: [] }, { ...resident, unitId: null });
    assert.equal((await votingService.list(resident))[0]!.myVote, null);
    assert.equal(find.mock.calls[0]!.arguments[0], null);
  });
  await t.test('autor removido preserva o voto com votedBy null', async t => {
    arrange(t, { ...fixture(), ballots: [{ optionId: 'sim', createdAt: votedAt, user: null }] });
    assert.deepEqual((await votingService.list(resident))[0]!.myVote, { optionId: 'sim', votedAt, votedBy: null });
  });
  await t.test('votação agendada também omite votes', async t => {
    arrange(t, { ...fixture(), startDate: new Date(Date.now() + 30_000) });
    assert.ok((await votingService.list(resident))[0]!.options.every(option => !('votes' in option)));
  });
  await t.test('após o encerramento o morador vê as contagens', async t => {
    arrange(t, fixture(new Date(Date.now() - 1_000)));
    assert.deepEqual((await votingService.list(resident))[0]!.options.map(option => 'votes' in option ? option.votes : undefined), [7, 3]);
  });
  for (const actor of [
    { ...resident, role: 'ADMIN' }, { ...resident, role: 'FUNCIONARIO' }, { ...resident, isSyndic: true },
  ]) {
    await t.test(`painel ${actor.role}${'isSyndic' in actor ? ' síndica' : ''} mantém contagens antes do fim`, async t => {
      arrange(t, fixture());
      assert.deepEqual((await votingService.list(actor))[0]!.options.map(option => 'votes' in option ? option.votes : undefined), [7, 3]);
    });
  }
  await t.test('repositório filtra pela unidade e seleciona apenas o nome do autor', async t => {
    const original = prisma.voting.findMany;
    const find = t.mock.fn(async (_args: Prisma.VotingFindManyArgs) => [] as any);
    prisma.voting.findMany = find as typeof original;
    t.after(() => { prisma.voting.findMany = original; });
    await votingRepository.findAll(resident.unitId);
    const args = find.mock.calls[0]!.arguments[0]!;
    assert.deepEqual(args.include!.ballots, {
      where: { unitId: resident.unitId }, take: 1,
      select: { optionId: true, createdAt: true, user: { select: { name: true } } },
    });
    await votingRepository.findAll(null);
    assert.deepEqual(find.mock.calls[1]!.arguments[0]!.include!.ballots, {
      where: { unitId: '' }, take: 1,
      select: { optionId: true, createdAt: true, user: { select: { name: true } } },
    });
  });
  await t.test('HTTP ignora unitId do cliente e usa a unidade da sessão', async t => {
    t.mock.method(userRepository, 'findAuthState', async () => ({
      ...resident, status: 'ACTIVE', tokenVersion: 0, isSyndic: false,
    }) as any);
    const find = arrange(t, fixture());
    const response = await request(app).get(`/votings?unitId=${randomUUID()}`)
      .set('Authorization', bearer(resident.id)).expect(200);
    assert.equal(find.mock.calls[0]!.arguments[0], resident.unitId);
    assert.equal(response.body[0].myVote.votedAt, votedAt.toISOString());
    assert.equal(response.body[0].myVote.votedBy, 'Outro morador da unidade');
    assert.ok(!('votes' in response.body[0].options[0]));
    assert.ok(!('ballots' in response.body[0]));
  });
});

test('votações: HTTP e repositório com MySQL isolado', { skip: !enabled }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/, 'Integração só pode usar banco terminado em _test.');
  const suffix = randomUUID();
  const adminId = randomUUID();
  const residentId = randomUUID();
  const syndicId = randomUUID();
  const employeeId = randomUUID();
  const neighborId = randomUUID();
  const unitId = randomUUID();
  const ids = [adminId, residentId, syndicId, employeeId, neighborId];
  t.after(async () => {
    try {
      await prisma.voting.deleteMany({ where: { authorId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.unit.deleteMany({ where: { id: unitId } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.unit.create({ data: { id: unitId, block: `votacoes-${suffix}`, number: '1' } });
  // residentId e neighborId moram na mesma unidade; a síndica fica sem unidade.
  await prisma.user.createMany({ data: ids.map((id, index) => ({
    id, name: 'Pessoa das votações', email: `${index}-votacoes-${suffix}@example.com`,
    cpf: `${index}-${suffix}`, password: 'hash-apenas-para-teste',
    role: index === 0 ? 'ADMIN' : index === 3 ? 'FUNCIONARIO' : 'MORADOR', isSyndic: index === 2,
    unitId: id === residentId || id === neighborId ? unitId : null,
  })) });
  const admin = bearer(adminId, 'ADMIN');
  const resident = bearer(residentId);
  const syndic = bearer(syndicId, 'MORADOR', true);
  const employee = bearer(employeeId, 'FUNCIONARIO');
  const neighbor = bearer(neighborId);

  await t.test('sem token retorna 401; morador comum lista, mas recebe 403 ao criar ou remover', async () => {
    for (const auth of [undefined, resident]) {
      const status = auth ? 403 : 401;
      const calls = [
        request(app).post('/votings').send(input()),
        request(app).delete(`/votings/${randomUUID()}`),
      ];
      for (const call of calls) {
        if (auth) call.set('Authorization', auth);
        await call.expect(status);
      }
    }
    await request(app).get('/votings').expect(401);
    await request(app).get('/votings').set('Authorization', resident).expect(200);
    await request(app).post(`/votings/${randomUUID()}/votes`).send({ optionId: randomUUID() }).expect(401);
  });
  await t.test('morador vota uma vez por unidade e o total da opção sobe', async () => {
    const created = await votingRepository.create({
      title: 'Votação aberta', description: 'Em andamento', authorId: adminId, options: ['Sim', 'Não'],
      startDate: new Date(Date.now() - 60_000), endDate: new Date(Date.now() + 60_000),
    });
    const [yes, no] = created.options;
    const path = `/votings/${created.id}/votes`;
    await request(app).post(path).set('Authorization', resident).send({ optionId: 'x' }).expect(400);
    await request(app).post(path).set('Authorization', employee).send({ optionId: yes!.id }).expect(403);
    await request(app).post(path).set('Authorization', syndic).send({ optionId: yes!.id }).expect(403);
    await request(app).post(path).set('Authorization', resident).send({ optionId: yes!.id }).expect(201);
    const duplicate = await request(app).post(path).set('Authorization', neighbor).send({ optionId: no!.id }).expect(409);
    assert.match(duplicate.body.error, /já votou/);
    const stored = await votingRepository.findById(created.id);
    assert.deepEqual(stored?.options.map(option => option.votes), [1, 0]);
    assert.equal(await prisma.votingVote.count({ where: { votingId: created.id, unitId } }), 1);
    await request(app).post(`/votings/${randomUUID()}/votes`).set('Authorization', resident)
      .send({ optionId: yes!.id }).expect(404);
  });
  await t.test('HTTP rejeita datas inválidas, invertidas e opções insuficientes', async () => {
    for (const patch of [
      { startDate: 'inválida' }, { endDate: 'inválida' },
      { endDate: new Date().toISOString() }, { options: ['Sim'] }, { options: ['Sim', ' '] },
    ]) {
      await request(app).post('/votings').set('Authorization', admin).send({ ...input(), ...patch }).expect(400);
    }
  });
  await t.test('admin cria votação com opções normalizadas e relações persistidas', async () => {
    const data = input();
    const response = await request(app).post('/votings').set('Authorization', admin)
      .send({ ...data, authorId: residentId }).expect(201);
    assert.equal(response.body.authorId, adminId);
    assert.equal(response.body.title, data.title.trim());
    assert.equal(response.body.description, data.description.trim());
    assert.deepEqual(response.body.options.map((option: { text: string }) => option.text).sort(), ['Não', 'Sim']);
    assert.ok(response.body.options.every((option: { votes: number }) => option.votes === 0));
    const stored = await votingRepository.findById(response.body.id);
    assert.equal(stored?.startDate.toISOString(), data.startDate);
    assert.equal(stored?.endDate.toISOString(), data.endDate);
    assert.equal(stored?.author.name, 'Pessoa das votações');
    const listing = await request(app).get('/votings').set('Authorization', employee).expect(200);
    assert.ok(listing.body.some((voting: { id: string }) => voting.id === response.body.id));
    const optionIds = response.body.options.map((option: { id: string }) => option.id);
    await request(app).delete(`/votings/${response.body.id}`).set('Authorization', admin).expect(200);
    assert.equal(await votingRepository.findById(response.body.id), null);
    assert.equal(await prisma.votingOption.count({ where: { id: { in: optionIds } } }), 0);
  });
  await t.test('síndica cria, lista e remove votação; funcionário não cria nem remove', async () => {
    const response = await request(app).post('/votings').set('Authorization', syndic).send(input()).expect(201);
    await request(app).get('/votings').set('Authorization', syndic).expect(200)
      .expect(({ body }) => assert.ok(body.some((voting: { id: string }) => voting.id === response.body.id)));
    await request(app).post('/votings').set('Authorization', employee).send(input()).expect(403);
    await request(app).delete(`/votings/${response.body.id}`).set('Authorization', employee).expect(403);
    await request(app).delete(`/votings/${response.body.id}`).set('Authorization', syndic).expect(200);
  });
  await t.test('remoção de votação inexistente falha explicitamente', async () => {
    await assert.rejects(() => votingService.delete(randomUUID()), /Votação não encontrada/);
  });
});
