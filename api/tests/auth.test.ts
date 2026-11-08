import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import type { Request, Response } from 'express';
import { userRepository } from '../src/repositories/userRepository';
import { prisma } from '../src/lib/prisma';
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from '../src/lib/resetToken';
import { sanitizeUser } from '../src/lib/sanitizeUser';
import { authCookieOptions, refreshCookieOptions } from '../src/lib/authCookie';

process.env.JWT_SECRET = 'unit-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';
let authService: typeof import('../src/services/authService')['authService'];
let authController: typeof import('../src/controllers/authController')['authController'];
let tokens: typeof import('../src/lib/authTokens');
before(async () => {
  ({ authService } = await import('../src/services/authService.js'));
  ({ authController } = await import('../src/controllers/authController.js'));
  tokens = await import('../src/lib/authTokens.js');
});
const baseUser = { id: 'e4776e30-e812-4d63-aa2d-07c0dccf5551', role: 'MORADOR', isSyndic: false,
  tokenVersion: 7, status: 'ACTIVE', name: 'Morador', email: 'unit@example.com', password: 'hash',
  resetToken: null as string | null, resetTokenExpiry: null as Date | null };
function response() {
  return { statusCode: 200, body: undefined as any, cookies: new Map<string, any>(),
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    cookie(name: string, token: string, options: unknown) { this.cookies.set(name, { token, options }); return this; },
    clearCookie(name: string) { this.cookies.delete(name); return this; },
  };
}

test('tokens têm expiração de 15min/7dias, segredos separados e rotação de JWT', async t => {
  t.mock.method(userRepository, 'findById', async () => baseUser as any);
  const pair = tokens.createAuthTokens(baseUser);
  const access = jwt.verify(pair.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
  const refresh = jwt.verify(pair.refreshToken, process.env.JWT_REFRESH_SECRET!) as jwt.JwtPayload;
  assert.equal(access.exp! - access.iat!, 15 * 60); assert.equal(refresh.exp! - refresh.iat!, 7 * 86400);
  assert.equal(refresh.sub, baseUser.id); assert.equal(refresh.tokenVersion, 7);
  assert.throws(() => tokens.verifyRefreshToken(pair.token));
  const renewed = await authService.refresh(pair.refreshToken);
  assert.notEqual(renewed.token, pair.token); assert.notEqual(renewed.refreshToken, pair.refreshToken);
  assert.equal(tokens.verifyAccessToken(renewed.token).id, baseUser.id);
  // The accepted stateless design permits reuse until expiration/version revocation.
  await authService.refresh(pair.refreshToken);
});

test('refresh rejeita expiração, adulteração, versão revogada e usuário inativo/ausente', async t => {
  const pair = tokens.createAuthTokens(baseUser);
  const expired = jwt.sign({ tokenVersion: 7 }, process.env.JWT_REFRESH_SECRET!, {
    subject: baseUser.id, issuer: 'domusapp', audience: 'domusapp:refresh', expiresIn: -1,
  });
  const lookup = t.mock.method(userRepository, 'findById', async () => ({ ...baseUser, tokenVersion: 8 }) as any);
  await assert.rejects(authService.refresh(expired));
  await assert.rejects(authService.refresh(pair.refreshToken + 'x'));
  assert.equal(lookup.mock.callCount(), 0);
  await assert.rejects(authService.refresh(pair.refreshToken), /revogado/);
  lookup.mock.mockImplementation(async () => ({ ...baseUser, status: 'INACTIVE' }) as any);
  await assert.rejects(authService.refresh(pair.refreshToken));
  lookup.mock.mockImplementation(async () => null);
  await assert.rejects(authService.refresh(pair.refreshToken));
});

test('logout incrementa tokenVersion e revoga refresh de todas as sessões', async t => {
  const user = { ...baseUser };
  t.mock.method(userRepository, 'findById', async () => user as any);
  const original = prisma.user.updateMany;
  t.after(() => { prisma.user.updateMany = original; });
  const update = t.mock.fn(async ({ where, data }: any) => {
    assert.equal(where.id, user.id); assert.deepEqual(data.tokenVersion, { increment: 1 });
    if (where.tokenVersion !== user.tokenVersion) return { count: 0 };
    user.tokenVersion++; return { count: 1 };
  });
  prisma.user.updateMany = update as any;
  const web = tokens.createAuthTokens(user); const mobile = tokens.createAuthTokens(user);
  await authService.logout(web.token);
  assert.equal(update.mock.callCount(), 1);
  await assert.rejects(authService.refresh(web.refreshToken));
  await assert.rejects(authService.refresh(mobile.refreshToken));
  await authService.logout('invalid'); assert.equal(update.mock.callCount(), 1);
});

test('logout revoga access expirado assinado, mas rejeita adulteração, issuer e audience inválidos', async t => {
  const user = { ...baseUser };
  const original = prisma.user.updateMany;
  t.after(() => { prisma.user.updateMany = original; });
  const update = t.mock.fn(async ({ where, data }: any) => {
    assert.equal(where.id, user.id); assert.deepEqual(data.tokenVersion, { increment: 1 });
    if (where.tokenVersion !== user.tokenVersion) return { count: 0 };
    user.tokenVersion++; return { count: 1 };
  });
  prisma.user.updateMany = update as any;
  const claims = { id: user.id, role: user.role, isSyndic: user.isSyndic, tokenVersion: user.tokenVersion };
  const options = { issuer: 'domusapp', audience: 'domusapp:access', expiresIn: -1 };
  const expired = jwt.sign(claims, process.env.JWT_SECRET!, options);
  assert.throws(() => tokens.verifyAccessToken(expired), /expired/);
  const parts = expired.split('.');
  parts[2] = (parts[2]![0] === 'a' ? 'b' : 'a') + parts[2]!.slice(1);
  const invalidTokens = [parts.join('.'),
    jwt.sign(claims, process.env.JWT_SECRET!, { ...options, issuer: 'other' }),
    jwt.sign(claims, process.env.JWT_SECRET!, { ...options, audience: 'other' })];
  for (const token of [expired, ...invalidTokens]) {
    const res = response();
    res.cookies.set('domusapp_token', {}); res.cookies.set('domusapp_refresh', {});
    await authController.logout({ headers: { authorization: `Bearer ${token}` } } as Request, res as unknown as Response);
    assert.equal(res.statusCode, 200); assert.equal(res.cookies.size, 0);
    assert.equal(update.mock.callCount(), 1); assert.equal(user.tokenVersion, baseUser.tokenVersion + 1);
  }
});

test('forgot salva só hash com validade de 1h e não envia e-mail inexistente', async t => {
  process.env.SMTP_HOST = 'unit.invalid';
  const user = { ...baseUser }; let sent = ''; let updates = 0;
  t.mock.method(nodemailer, 'createTransport', (() => ({ sendMail: async (mail: any) => { sent = mail.text; return {}; } })) as any);
  t.mock.method(nodemailer, 'getTestMessageUrl', () => false);
  const lookup = t.mock.method(userRepository, 'findByEmail', async () => user as any);
  t.mock.method(userRepository, 'update', async (_id: string, data: any) => { Object.assign(user, data); updates++; return user as any; });
  const before = Date.now(); await authService.forgotPassword(user.email); const after = Date.now();
  assert.equal(RESET_TOKEN_TTL_MS, 3600000);
  assert.ok(user.resetTokenExpiry!.getTime() >= before + RESET_TOKEN_TTL_MS);
  assert.ok(user.resetTokenExpiry!.getTime() <= after + RESET_TOKEN_TTL_MS);
  const raw = sent.match(/token=([a-f0-9-]+)/)![1]!;
  assert.notEqual(raw, user.resetToken); assert.equal(hashResetToken(raw), user.resetToken);
  lookup.mock.mockImplementation(async () => null);
  await authService.forgotPassword('missing@example.com'); assert.equal(updates, 1);
});

test('forgot responde igual sem aguardar DB/SMTP e sem expor falhas', { timeout: 1000 }, async t => {
  const work = t.mock.method(authService, 'forgotPassword', () => new Promise<void>(() => {}));
  const first = response();
  await authController.forgotPassword({ body: { email: baseUser.email } } as Request, first as unknown as Response);
  work.mock.mockImplementation(async () => undefined);
  const missing = response();
  await authController.forgotPassword({ body: { email: 'missing@example.com' } } as Request, missing as unknown as Response);
  assert.equal(first.statusCode, 200); assert.equal(missing.statusCode, 200); assert.deepEqual(first.body, missing.body);
});

test('reset rejeita token expirado inclusive no instante exato da expiração', async t => {
  const { token, tokenHash } = generateResetToken();
  const lookup = t.mock.method(userRepository, 'findByResetTokenHash', async () => ({ ...baseUser,
    resetToken: tokenHash, resetTokenExpiry: new Date(Date.now() - 1) }) as any);
  const consume = t.mock.method(userRepository, 'consumeResetToken', async () => { assert.fail('não deve gravar'); });
  await assert.rejects(authService.resetPassword(token, 'nova senha'), /expirado/);
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  lookup.mock.mockImplementation(async () => ({ ...baseUser, resetToken: tokenHash, resetTokenExpiry: new Date(now) }) as any);
  await assert.rejects(authService.resetPassword(token, 'nova senha'), /expirado/);
  assert.equal(consume.mock.callCount(), 0);
});

test('reset consome token uma vez mesmo sob concorrência e revoga refresh', async t => {
  const { token, tokenHash } = generateResetToken();
  const user = { ...baseUser, resetToken: tokenHash as string | null, resetTokenExpiry: new Date(Date.now() + 60000) as Date | null };
  const oldSession = tokens.createAuthTokens(user);
  t.mock.method(userRepository, 'findByResetTokenHash', async (hash: string) => hash === user.resetToken ? { ...user } as any : null);
  t.mock.method(userRepository, 'findById', async () => user as any);
  const original = prisma.user.updateMany;
  t.after(() => { prisma.user.updateMany = original; });
  prisma.user.updateMany = t.mock.fn(async ({ where, data }: any) => {
    assert.equal(where.id, user.id); assert.equal(where.resetToken, tokenHash);
    assert.ok(where.resetTokenExpiry.gt instanceof Date);
    if (user.resetToken !== where.resetToken || !user.resetTokenExpiry || user.resetTokenExpiry <= where.resetTokenExpiry.gt) return { count: 0 };
    assert.deepEqual(data.tokenVersion, { increment: 1 });
    Object.assign(user, data, { tokenVersion: user.tokenVersion + 1 }); return { count: 1 };
  }) as any;
  const result = await Promise.allSettled([authService.resetPassword(token, 'nova senha segura'), authService.resetPassword(token, 'outra senha segura')]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(user.resetToken, null); assert.equal(user.resetTokenExpiry, null); assert.equal(user.tokenVersion, 8);
  assert.ok(await bcrypt.compare(result[0]!.status === 'fulfilled' ? 'nova senha segura' : 'outra senha segura', user.password));
  await assert.rejects(authService.resetPassword(token, 'nova senha segura'));
  await assert.rejects(authService.refresh(oldSession.refreshToken));
});

test('login web não expõe tokens no JSON; mobile recebe par e perfis são sanitizados', async t => {
  const user = { ...baseUser, password: await bcrypt.hash(' senha válida ', 4), resetToken: 'hash-secreto', resetTokenExpiry: new Date() };
  t.mock.method(userRepository, 'findByEmail', async () => user as any);
  const web = response(); const mobile = response();
  for (const [client, res] of [[undefined, web], ['mobile', mobile]] as const) {
    await authController.login({ body: { client, email: user.email, password: ' senha válida ' } } as Request, res as unknown as Response);
    assert.equal(res.statusCode, 200);
    for (const key of ['password', 'resetToken', 'resetTokenExpiry']) assert.equal(key in res.body.user, false);
  }
  assert.equal('token' in web.body, false); assert.equal('refreshToken' in web.body, false);
  assert.equal(typeof mobile.body.token, 'string'); assert.equal(typeof mobile.body.refreshToken, 'string');
  assert.ok(web.cookies.has('domusapp_token')); assert.ok(web.cookies.has('domusapp_refresh'));
  assert.equal('resetToken' in sanitizeUser(user), false);
});

test('login com client=panel recusa morador sem síndica antes de gravar cookies', async t => {
  const password = await bcrypt.hash('senha válida', 4);
  const resident = { ...baseUser, role: 'MORADOR', isSyndic: false, password };
  const syndic = { ...resident, isSyndic: true };
  let current: typeof resident = resident;
  t.mock.method(userRepository, 'findByEmail', async () => current as any);
  const denied = response();
  await authController.login({ body: { client: 'panel', email: resident.email, password: 'senha válida' } } as Request, denied as unknown as Response);
  assert.equal(denied.statusCode, 403); assert.equal(denied.cookies.size, 0);
  current = syndic;
  const allowed = response();
  await authController.login({ body: { client: 'panel', email: syndic.email, password: 'senha válida' } } as Request, allowed as unknown as Response);
  assert.equal(allowed.statusCode, 200); assert.ok(allowed.cookies.has('domusapp_token'));
  assert.equal('token' in allowed.body, false);
});

test('cookies usam HttpOnly e mesmas flags, com paths e prazos distintos', () => {
  const access = authCookieOptions(); const refresh = refreshCookieOptions();
  assert.equal(access.httpOnly, true); assert.equal(refresh.httpOnly, true);
  assert.equal(access.path, '/'); assert.equal(refresh.path, '/auth/refresh');
  assert.equal(access.maxAge, 900000); assert.equal(refresh.maxAge, 604800000);
  assert.equal(refresh.secure, access.secure); assert.equal(refresh.sameSite, access.sameSite);
});

test('configuração exige segredos independentes antes de emitir tokens', t => {
  const original = process.env.JWT_REFRESH_SECRET;
  t.after(() => { process.env.JWT_REFRESH_SECRET = original; });
  delete process.env.JWT_REFRESH_SECRET;
  assert.throws(() => tokens.validateAuthSecrets());
  process.env.JWT_REFRESH_SECRET = process.env.JWT_SECRET;
  assert.throws(() => tokens.validateAuthSecrets());
});

test('refresh aceita cookie web e body mobile com respostas adequadas a cada cliente', async t => {
  t.mock.method(userRepository, 'findById', async () => baseUser as any);
  const pair = tokens.createAuthTokens(baseUser);
  const web = response(); const mobile = response();
  await authController.refresh({ cookies: { domusapp_refresh: pair.refreshToken }, body: {} } as unknown as Request, web as unknown as Response);
  await authController.refresh({ body: { client: 'mobile', refreshToken: pair.refreshToken } } as Request, mobile as unknown as Response);
  assert.equal(web.statusCode, 200); assert.equal(mobile.statusCode, 200);
  assert.equal('token' in web.body, false); assert.equal('refreshToken' in web.body, false);
  assert.equal(typeof mobile.body.token, 'string'); assert.equal(typeof mobile.body.refreshToken, 'string');
  assert.ok(web.cookies.has('domusapp_refresh'));
  const invalid = response();
  await authController.refresh({ body: {} } as Request, invalid as unknown as Response);
  assert.equal(invalid.statusCode, 401);
});

test('middleware mantém autenticação por cookie e Bearer, rejeitando refresh como access', async t => {
  t.mock.method(userRepository, 'findAuthState', async () => baseUser);
  const { authMiddleware } = await import('../src/middlewares/authMiddleware.js');
  const pair = tokens.createAuthTokens(baseUser);
  for (const request of [{ cookies: { domusapp_token: pair.token }, headers: {} },
    { headers: { authorization: `Bearer ${pair.token}` } }]) {
    const req = request as any; let next = 0;
    await authMiddleware(req, response() as unknown as Response, () => { next++; });
    assert.equal(next, 1); assert.equal(req.user.id, baseUser.id);
  }
  const res = response(); let next = 0;
  await authMiddleware({ headers: { authorization: `Bearer ${pair.refreshToken}` } } as any, res as unknown as Response, () => { next++; });
  assert.equal(next, 0); assert.equal(res.statusCode, 401);
});


test('/auth/me retorna cadastro atual de qualquer perfil ativo, sem segredos', async t => {
  for (const actor of [{ role: 'ADMIN', isSyndic: false }, { role: 'FUNCIONARIO', isSyndic: false },
    { role: 'MORADOR', isSyndic: false }, { role: 'MORADOR', isSyndic: true }]) {
    await t.test(JSON.stringify(actor), async t => {
      const profile = { ...baseUser, ...actor, unit: { id: 'unidade-atual' }, name: 'Nome atualizado' };
      t.mock.method(userRepository, 'findById', async (id: string) => { assert.equal(id, baseUser.id); return profile as any; });
      const res = response();
      await authController.me({ user: { id: baseUser.id } } as any, res as any);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.user.name, profile.name);
      assert.deepEqual(res.body.user.unit, profile.unit);
      assert.equal(res.body.user.role, actor.role);
      for (const key of ['password', 'resetToken', 'resetTokenExpiry']) assert.equal(key in res.body.user, false);
    });
  }
});
test('/auth/me rejeita cadastro inativo ou excluído', async t => {
  for (const profile of [null, { ...baseUser, role: 'ADMIN', status: 'INACTIVE' }]) {
    await t.test(profile ? 'inativo' : 'excluído', async t => {
      t.mock.method(userRepository, 'findById', async () => profile as any);
      const res = response();
      await authController.me({ user: { id: baseUser.id } } as any, res as any);
      assert.equal(res.statusCode, 401);
    });
  }
});
