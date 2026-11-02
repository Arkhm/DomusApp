import test from 'node:test';
import app from '../src/app';
import assert from 'node:assert/strict';
import { randomUUID, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createAuthTokens } from '../src/lib/authTokens';
import { prisma } from '../src/lib/prisma';
import { userService } from '../src/services/userService';
import { userRepository } from '../src/repositories/userRepository';

function novoCpf() {
  const digits = Array.from({ length: 9 }, () => randomInt(10));
  for (const length of [9, 10]) {
    const rest = digits.reduce((sum, digit, index) => sum + digit * (length + 1 - index), 0) % 11;
    digits.push(rest < 2 ? 0 : 11 - rest);
  }
  return digits.join('');
}

const usuario = { id: randomUUID(), name: 'Morador de teste', email: 'morador@example.test',
  cpf: '52998224725', password: 'hash-privado', role: 'MORADOR', unitId: randomUUID(),
  isSyndic: false, isCouncilMember: false, resetToken: 'token-privado', resetTokenExpiry: new Date() };

function semSegredos(value: unknown) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!['password', 'resetToken', 'resetTokenExpiry'].includes(key), `Campo privado na resposta: ${key}`);
    semSegredos(child);
  }
}

test('usuários: autenticação e RBAC protegem todas as operações administrativas', async () => {
  const token = createAuthTokens({ id: randomUUID(), role: 'MORADOR', isSyndic: false, tokenVersion: 0 }).token;
  for (const [method, path] of [['get', '/users'], ['get', `/users/${usuario.id}`], ['post', '/users'],
    ['put', `/users/${usuario.id}`], ['delete', `/users/${usuario.id}`]] as const) {
    assert.equal((await request(app)[method](path).send({})).status, 401, `${method} sem token`);
    assert.equal((await request(app)[method](path).set('Authorization', `Bearer ${token}`).send({})).status,
      403, `${method} como morador`);
  }
});

test('usuários: cadastro valida obrigatórios, duplicidade, cargo e unidade antes de gravar', async t => {
  const cases = [
    { data: {}, error: /obrigatórios/ },
    { data: { ...usuario }, email: usuario, error: /E-mail já cadastrado/ },
    { data: { ...usuario }, cpf: usuario, error: /CPF já cadastrado/ },
    { data: { ...usuario, role: 'GERENTE' }, error: /Cargo inválido/ },
    { data: { ...usuario, role: undefined, unitId: undefined }, error: /unitId/ },
  ];
  for (const scenario of cases) {
    await t.test(scenario.error.source, async s => {
      s.mock.method(userRepository, 'findByEmail', async () => (scenario.email ?? null) as any);
      s.mock.method(userRepository, 'findByCpf', async () => (scenario.cpf ?? null) as any);
      const create = s.mock.method(userRepository, 'create', async () => { throw new Error('Gravação indevida.'); });
      await assert.rejects(userService.create(scenario.data), scenario.error);
      assert.equal(create.mock.callCount(), 0);
    });
  }
});

test('usuários: operações de consulta, edição e exclusão rejeitam usuário inexistente', async t => {
  t.mock.method(userRepository, 'findById', async () => null);
  await assert.rejects(userService.getById(usuario.id), /não encontrado/);
  await assert.rejects(userService.update(usuario.id, { name: 'Outro nome' }), /não encontrado/);
  await assert.rejects(userService.delete(usuario.id), /não encontrado/);
});

test('usuários: edição rejeita conflitos, CPF inválido, cargo inválido e remoção explícita de unidade', async t => {
  const cases = [
    { data: { email: 'ocupado@example.test' }, email: usuario, error: /E-mail já cadastrado por outro/ },
    { data: { cpf: '11111111111' }, error: /CPF inválido/ },
    { data: { cpf: '11144477735' }, cpf: usuario, error: /CPF já cadastrado por outro/ },
    { data: { role: 'GERENTE' }, error: /Cargo inválido/ },
    { data: { role: 'morador', unitId: null }, error: /sem unidade/ },
  ];
  for (const scenario of cases) {
    await t.test(scenario.error.source, async s => {
      s.mock.method(userRepository, 'findById', async () => usuario as any);
      s.mock.method(userRepository, 'findByEmail', async () => (scenario.email ?? null) as any);
      s.mock.method(userRepository, 'findByCpf', async () => (scenario.cpf ?? null) as any);
      const update = s.mock.method(userRepository, 'update', async () => { throw new Error('Gravação indevida.'); });
      await assert.rejects(userService.update(usuario.id, { ...scenario.data }), scenario.error);
      assert.equal(update.mock.callCount(), 0);
    });
  }
});

test('usuários: editar outro campo aceita CPF legado inalterado e preserva senha vazia', async t => {
  t.mock.method(userRepository, 'findById', async () => ({ ...usuario, cpf: '12345678901' }) as any);
  const update = t.mock.method(userRepository, 'update', async (_id: string, data: any) => ({ ...usuario, ...data }) as any);
  const result = await userService.update(usuario.id, { name: 'Nome atualizado', cpf: '12345678901', password: '' });
  assert.equal(result.name, 'Nome atualizado');
  assert.equal('password' in update.mock.calls[0]!.arguments[1], false);
  semSegredos(result);
});

test('usuários: HTTP e repository com MySQL isolado', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/);
  const prefix = randomUUID();
  const domain = `@${prefix}.test`;
  const unitId = randomUUID();
  const adminId = randomUUID();
  t.after(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: { endsWith: domain } } });
      await prisma.unit.deleteMany({ where: { id: unitId } });
    } finally { await prisma.$disconnect(); }
  });
  await prisma.unit.create({ data: { id: unitId, block: prefix, number: '1' } });
  const admin = await prisma.user.create({ data: { id: adminId, name: 'Administrador de teste', role: 'ADMIN',
    email: `admin${domain}`, cpf: novoCpf(), password: 'hash-privado', resetToken: randomUUID(),
    resetTokenExpiry: new Date(Date.now() + 60000) } });
  const authorization = `Bearer ${createAuthTokens(admin).token}`;
  const cadastro = () => ({ name: `Morador ${prefix}`, email: `${randomUUID()}${domain}`, cpf: novoCpf(),
    password: 'Senha-teste-123!', role: 'MORADOR', unitId });
  let createdId: string;

  await t.test('RNE-003: morador sem unidade retorna 400 mencionando unitId', async () => {
    const body = { ...cadastro(), unitId: undefined };
    const result = await request(app).post('/users').set('Authorization', authorization).send(body);
    assert.equal(result.status, 400);
    assert.match(result.body.error, /unitId/);
    assert.equal(await userRepository.findByEmail(body.email), null);
  });

  await t.test('cadastro persiste hash, responde sem segredos e rejeita e-mail e CPF repetidos', async () => {
    const body = cadastro();
    const result = await request(app).post('/users').set('Authorization', authorization).send(body);
    assert.equal(result.status, 201);
    createdId = result.body.id;
    semSegredos(result.body);
    const stored = await userRepository.findById(createdId);
    assert.ok(stored);
    assert.equal(stored.unitId, unitId);
    assert.notEqual(stored.password, body.password);
    assert.ok(await bcrypt.compare(body.password, stored.password));
    for (const duplicate of [{ ...cadastro(), email: body.email }, { ...cadastro(), cpf: body.cpf }]) {
      const response = await request(app).post('/users').set('Authorization', authorization).send(duplicate);
      assert.equal(response.status, 400);
      assert.match(response.body.error, /já cadastrado/);
    }
  });

  await t.test('listagem, busca por nome, e-mail e CPF, detalhe e perfil nunca retornam segredos', async () => {
    await userRepository.update(createdId, { resetToken: randomUUID(), resetTokenExpiry: new Date(Date.now() + 60000) });
    const stored = await userRepository.findById(createdId);
    assert.ok(stored);
    const list = await request(app).get('/users').set('Authorization', authorization);
    assert.equal(list.status, 200);
    assert.ok(list.body.some((user: any) => user.id === createdId));
    semSegredos(list.body);
    for (const search of [prefix, stored.email, stored.cpf]) {
      const result = await request(app).get('/users').query({ search }).set('Authorization', authorization);
      assert.equal(result.status, 200);
      assert.ok(result.body.some((user: any) => user.id === createdId));
      semSegredos(result.body);
    }
    for (const path of [`/users/${createdId}`, '/users/me']) {
      const result = await request(app).get(path).set('Authorization', authorization);
      assert.equal(result.status, 200);
      semSegredos(result.body);
    }
  });

  await t.test('edição troca CPF, e-mail e senha e limpa atributos de morador ao promover funcionário', async () => {
    const password = 'Nova-senha-123!';
    const email = `editado${domain}`;
    const cpf = novoCpf();
    const result = await request(app).put(`/users/${createdId}`).set('Authorization', authorization)
      .send({ email, cpf, password, role: 'funcionario', unitId, isSyndic: true, isCouncilMember: true });
    assert.equal(result.status, 200);
    assert.equal(result.body.role, 'FUNCIONARIO');
    assert.equal(result.body.unitId, null);
    assert.equal(result.body.isSyndic, false);
    assert.equal(result.body.isCouncilMember, false);
    semSegredos(result.body);
    const stored = await userRepository.findById(createdId);
    assert.ok(stored);
    assert.equal(stored.cpf, cpf);
    assert.equal(stored.email, email);
    assert.ok(await bcrypt.compare(password, stored.password));
  });

  await t.test('cadastro de administrador limpa unidade e cargos de morador', async () => {
    const result = await request(app).post('/users').set('Authorization', authorization)
      .send({ ...cadastro(), role: 'admin', isSyndic: true, isCouncilMember: true });
    assert.equal(result.status, 201);
    assert.equal(result.body.unitId, null);
    assert.equal(result.body.isSyndic, false);
    assert.equal(result.body.isCouncilMember, false);
    semSegredos(result.body);
  });

  await t.test('repository consome token válido uma vez, rejeita expirado e revoga sessões', async () => {
    const resetToken = randomUUID();
    await userRepository.update(createdId, { resetToken, resetTokenExpiry: new Date(Date.now() + 60000) });
    assert.equal((await userRepository.findByResetTokenHash(resetToken))?.id, createdId);
    assert.equal((await userRepository.findByCpf((await userRepository.findById(createdId))!.cpf))?.id, createdId);
    assert.equal(await userRepository.consumeResetToken(createdId, 'incorreto', 'nova-senha-hash'), false);
    assert.equal(await userRepository.consumeResetToken(createdId, resetToken, 'nova-senha-hash'), true);
    assert.equal(await userRepository.consumeResetToken(createdId, resetToken, 'outra-senha-hash'), false);
    const consumed = await userRepository.findById(createdId);
    assert.equal(consumed?.resetToken, null);
    assert.equal(consumed?.resetTokenExpiry, null);
    assert.equal(consumed?.password, 'nova-senha-hash');
    assert.equal(consumed?.tokenVersion, 1);
    await userRepository.revokeTokens(createdId);
    assert.equal((await userRepository.findById(createdId))?.tokenVersion, 2);
    const expired = randomUUID();
    await userRepository.update(createdId, { resetToken: expired, resetTokenExpiry: new Date(Date.now() - 60000) });
    assert.equal(await userRepository.consumeResetToken(createdId, expired, 'senha-indevida'), false);
    assert.equal((await userRepository.findById(createdId))?.password, 'nova-senha-hash');
  });

  await t.test('RNE-003: edição sem role também deve impedir remoção de unidade de morador',
    { todo: 'userService.update só verifica unitId null quando role MORADOR vem no body.' }, async () => {
      const resident = await prisma.user.create({ data: cadastro() });
      const result = await request(app).put(`/users/${resident.id}`).set('Authorization', authorization).send({ unitId: null });
      assert.equal(result.status, 400);
      assert.equal((await userRepository.findById(resident.id))?.unitId, unitId);
    });

  await t.test('exclusão remove somente o usuário solicitado e detalhe ausente retorna 404', async () => {
    const result = await request(app).delete(`/users/${createdId}`).set('Authorization', authorization);
    assert.equal(result.status, 200);
    assert.match(result.body.message, /removido com sucesso/);
    assert.equal(await userRepository.findById(createdId), null);
    assert.ok(await userRepository.findById(adminId));
    assert.equal((await request(app).get(`/users/${createdId}`).set('Authorization', authorization)).status, 404);
  });
});
