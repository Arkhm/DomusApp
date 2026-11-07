import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createAuthTokens, verifyAccessToken } from '../src/lib/authTokens';
import { authMiddleware } from '../src/middlewares/authMiddleware';
import { userRepository } from '../src/repositories/userRepository';
import { userService } from '../src/services/userService';
import { authService } from '../src/services/authService';
import { authController } from '../src/controllers/authController';
import { prisma } from '../src/lib/prisma';
const actor = { id: randomUUID(), role: 'ADMIN', isSyndic: false, status: 'ACTIVE', tokenVersion: 4 };
function response() {
  return { statusCode: 200, cleared: 0, status(code: number) { this.statusCode = code; return this; },
    json(_body: unknown) { return this; }, clearCookie() { this.cleared++; return this; } };
}
async function authenticate(token: string) {
  const req = { headers: { authorization: `Bearer ${token}` } } as any;
  const res = response(); let next = 0;
  await authMiddleware(req, res as any, () => { next++; });
  return { req, res, next };
}
test('access: valida versão, estado e privilégios atuais em cada requisição', async t => {
  const token = createAuthTokens(actor).token;
  assert.equal(verifyAccessToken(token).tokenVersion, actor.tokenVersion);
  for (const state of [null, { ...actor, status: 'INACTIVE' }, { ...actor, tokenVersion: 5 }]) {
    await t.test(JSON.stringify(state), async t => {
      t.mock.method(userRepository, 'findAuthState', async () => state as any);
      const { res, next } = await authenticate(token);
      assert.equal(res.statusCode, 401); assert.equal(next, 0);
    });
  }
  await t.test('não usa cargo antigo contido no JWT', async t => {
    t.mock.method(userRepository, 'findAuthState', async () => ({ ...actor, role: 'MORADOR', isSyndic: true }));
    const { req, next } = await authenticate(token);
    assert.equal(next, 1); assert.deepEqual(req.user, { id: actor.id, role: 'MORADOR', isSyndic: true });
  });
  await t.test('falha de banco retorna 503 sem apagar cookies', async t => {
    t.mock.method(userRepository, 'findAuthState', async () => { throw new Error('DB offline'); });
    const { res, next } = await authenticate(token);
    assert.equal(res.statusCode, 503); assert.equal(next, 0); assert.equal(res.cleared, 0);
  });
});
test('access rejeita token legado, versão fracionária, negativa ou textual', async () => {
  for (const version of [undefined, -1, 0.5, '4']) {
    const token = jwt.sign({ id: actor.id, role: actor.role, tokenVersion: version }, process.env.JWT_SECRET!,
      { issuer: 'domusapp', audience: 'domusapp:access', expiresIn: '15m' });
    const { res, next } = await authenticate(token);
    assert.equal(res.statusCode, 401); assert.equal(next, 0);
  }
});
test('logout compara versão atomicamente e repetição não encerra sessões novas', async t => {
  let version = actor.tokenVersion;
  const original = prisma.user.updateMany;
  t.after(() => { prisma.user.updateMany = original; });
  prisma.user.updateMany = (async ({ where }: any) => {
    if (where.tokenVersion !== version) return { count: 0 };
    version++; return { count: 1 };
  }) as any;
  const old = createAuthTokens(actor);
  await authService.logout(old.token); assert.equal(version, 5);
  const fresh = createAuthTokens({ ...actor, tokenVersion: version });
  await authService.logout(old.token); assert.equal(version, 5);
  t.mock.method(userRepository, 'findAuthState', async () => ({ ...actor, tokenVersion: version }));
  assert.equal((await authenticate(old.token)).res.statusCode, 401);
  assert.equal((await authenticate(fresh.token)).next, 1);
});
test('logout com access legado recente revoga sem conferir versão; legado antigo ou adulterado não revoga', async t => {
  const revoke = t.mock.method(userRepository, 'revokeTokens', async () => ({ count: 1 }));
  const legacy = (iat: number, secret = process.env.JWT_SECRET!) => jwt.sign({ id: actor.id, role: actor.role, iat }, secret,
    { issuer: 'domusapp', audience: 'domusapp:access' });
  const now = Math.floor(Date.now() / 1000);
  await authService.logout(legacy(now - 60));
  assert.equal(revoke.mock.callCount(), 1);
  assert.deepEqual(revoke.mock.calls[0]!.arguments, [actor.id, undefined]);
  await authService.logout(legacy(now - 8 * 24 * 60 * 60));
  await authService.logout(legacy(now - 60, 'outro-segredo-qualquer'));
  assert.equal(revoke.mock.callCount(), 1);
});
test('edições sensíveis incrementam versão na mesma escrita; campos comuns e inalterados preservam', async t => {
  const user = { ...actor, name: 'Teste', email: 'teste@example.test', unitId: randomUUID(), password: 'hash' };
  for (const [data, revokes] of [[{ name: 'Novo' }, false], [{ role: 'admin', isSyndic: false, status: 'ACTIVE' }, false],
    [{ status: 'INACTIVE' }, true], [{ role: 'FUNCIONARIO' }, true], [{ role: 'MORADOR', unitId: user.unitId, isSyndic: true }, true],
    [{ password: 'NovaSenha123' }, true]] as const) {
    await t.test(JSON.stringify(data), async t => {
      t.mock.method(userRepository, 'findById', async () => user as any);
      t.mock.method(userRepository, 'update', async (_id: string, patch: any) => {
        assert.deepEqual(patch.tokenVersion, revokes ? { increment: 1 } : undefined); return user as any;
      });
      await userService.update(user.id, { ...data });
    });
  }
});
test('consulta de perfil e refresh retornam 503 em falha de banco sem limpar cookies', async t => {
  t.mock.method(userRepository, 'findById', async () => { throw new Error('DB offline'); });
  const pair = createAuthTokens(actor);
  const res = response(); await authController.refresh({ body: { refreshToken: pair.refreshToken } } as any, res as any);
  assert.equal(res.statusCode, 503); assert.equal(res.cleared, 0);
  const me = response(); await authController.me({ user: actor } as any, me as any);
  assert.equal(me.statusCode, 503); assert.equal(me.cleared, 0);
});

test('revogação completa com MySQL isolado', { skip: process.env.RUN_DB_INTEGRATION !== 'true' }, async t => {
  assert.match(process.env.DATABASE_NAME ?? '', /_test$/);
  const user = await prisma.user.create({ data: { name: 'Sessão de teste', email: `${randomUUID()}@test.example`,
    cpf: randomUUID(), password: 'hash', role: 'ADMIN' } });
  t.after(async () => { await prisma.user.deleteMany({ where: { id: user.id } }); await prisma.$disconnect(); });
  const initial = createAuthTokens(user);
  assert.equal((await authenticate(initial.token)).next, 1);
  await authService.logout(initial.token);
  assert.equal((await authenticate(initial.token)).res.statusCode, 401);
  await assert.rejects(authService.refresh(initial.refreshToken));
  const fresh = createAuthTokens(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
  await authService.logout(initial.token);
  assert.equal((await authenticate(fresh.token)).next, 1);
  await userService.update(user.id, { name: 'Nome corrigido' });
  assert.equal((await authenticate(fresh.token)).next, 1);
  await userService.update(user.id, { password: 'SenhaNova123' });
  assert.equal((await authenticate(fresh.token)).res.statusCode, 401);
  await assert.rejects(authService.refresh(fresh.refreshToken));
  const updated = createAuthTokens(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
  await userService.update(user.id, { status: 'INACTIVE' });
  assert.equal((await authenticate(updated.token)).res.statusCode, 401);
  await prisma.user.delete({ where: { id: user.id } });
  assert.equal((await authenticate(updated.token)).res.statusCode, 401);
});
