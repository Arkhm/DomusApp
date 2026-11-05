import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Run the actual interceptors with Axios adapters; native storage and browser globals stay local to each test.
function client(platform: 'web' | 'mobile') {
  const requireClient = createRequire(resolve('..', platform, 'package.json'));
  const axios = requireClient('axios');
  const saved = new Map<string, string>([['access', 'old-access'], ['refresh', 'old-refresh'], ['@domusapp:user', '{}']]);
  const keys = { token: 'access', refreshToken: 'refresh' };
  const storage = { get: async (key: string) => saved.get(key) ?? null,
    set: async (key: string, value: string) => { saved.set(key, value); },
    remove: async (key: string) => { saved.delete(key); } };
  const browser = { location: { pathname: '/dashboard', href: '/dashboard' } };
  const source = readFileSync(resolve('..', platform, 'src/services/api.ts'), 'utf8')
    .replace('import.meta.env.VITE_API_URL', "'http://unit.test'");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as any };
  const mockedRequire = (name: string) => {
    if (name === 'axios') return axios;
    if (name === 'expo-constants') return { expoConfig: { extra: { apiUrl: 'http://unit.test' } } };
    if (name === './secureStorage') return { secureStorage: storage, STORAGE_KEYS: keys };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function('require', 'module', 'exports', 'localStorage', 'window', code)(
    mockedRequire, module, module.exports, { removeItem: (key: string) => saved.delete(key) }, browser,
  );
  return { api: platform === 'web' ? module.exports.default : module.exports.api,
    onUnauthorized: module.exports.onUnauthorized, saved, browser, axios };
}

for (const platform of ['web', 'mobile'] as const) {
  for (const scenario of ['success', 'refresh failure', 'retry unauthorized'] as const) {
    test(`${platform}: ${scenario}, uma renovação compartilhada e nenhuma repetição infinita`, async () => {
      const app = client(platform); let refreshCalls = 0; let logoutCalls = 0; let notified = 0;
      let requestCalls = 0; let renewed = false;
      if (app.onUnauthorized) app.onUnauthorized(() => { notified++; });
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      app.api.defaults.adapter = async (config: any) => {
        const respond = (status: number, data: any) => {
          const response = { status, data, statusText: String(status), headers: {}, config };
          if (status === 401) throw new app.axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response);
          return response;
        };
        if (config.url === '/auth/logout') { logoutCalls++; return respond(200, {}); }
        if (config.url === '/auth/refresh') {
          refreshCalls++; await gate;
          if (platform === 'mobile') {
            const body = JSON.parse(config.data);
            assert.equal(body.client, 'mobile'); assert.equal(body.refreshToken, 'old-refresh');
          }
          if (scenario === 'refresh failure') return respond(401, {});
          renewed = true; return respond(200, { token: 'new-access', refreshToken: 'new-refresh' });
        }
        requestCalls++;
        if (requestCalls === 2) release();
        if (!renewed || scenario === 'retry unauthorized') return respond(401, {});
        if (platform === 'mobile') assert.equal(config.headers.Authorization, 'Bearer new-access');
        return respond(200, { ok: true });
      };
      const results = await Promise.allSettled([app.api.get('/auth/me'), app.api.get('/two')]);
      assert.equal(refreshCalls, 1);
      if (scenario === 'success') {
        assert.ok(results.every(result => result.status === 'fulfilled'));
        assert.equal(requestCalls, 4); assert.equal(logoutCalls, 0); assert.equal(notified, 0);
        if (platform === 'mobile') { assert.equal(app.saved.get('access'), 'new-access'); assert.equal(app.saved.get('refresh'), 'new-refresh'); }
      } else {
        assert.ok(results.every(result => result.status === 'rejected'));
        assert.equal(requestCalls, scenario === 'refresh failure' ? 2 : 4);
        if (platform === 'mobile') {
          assert.equal(app.saved.has('access'), false); assert.equal(app.saved.has('refresh'), false); assert.ok(notified > 0);
        } else {
          assert.equal(app.saved.has('@domusapp:user'), false); assert.equal(app.browser.location.href, '/login'); assert.equal(logoutCalls, 1);
        }
      }
    });
  }
  test(`${platform}: 401 de login não dispara refresh`, async () => {
    const app = client(platform); let calls = 0;
    app.api.defaults.adapter = async (config: any) => {
      calls++; throw new app.axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401 });
    };
    await assert.rejects(app.api.post('/auth/login', { email: 'a@b.com', password: 'wrong' }));
    assert.equal(calls, 1);
  });
}

for (const platform of ['web', 'mobile'] as const) {
  test(`${platform}: logout aguarda refresh em andamento antes de revogar sessão`, async () => {
    const app = client(platform); const order: string[] = [];
    let ready!: () => void; let release!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    app.api.defaults.adapter = async (config: any) => {
      if (config.url === '/auth/refresh') {
        ready(); await gate; order.push('refresh');
        return { status: 200, data: { token: 'new-access', refreshToken: 'new-refresh' }, headers: {}, config };
      }
      if (config.url === '/auth/logout') {
        order.push('logout');
        if (platform === 'mobile') assert.equal(config.headers.Authorization, 'Bearer new-access');
      } else if (!config._retry) {
        throw new app.axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401 });
      }
      return { status: 200, data: {}, headers: {}, config };
    };
    const request = app.api.get('/one'); await started;
    const logout = app.api.post('/auth/logout'); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(order, []); release();
    await Promise.all([request, logout]); assert.deepEqual(order, ['refresh', 'logout']);
  });
}

test('mobile: indisponibilidade no refresh preserva tokens e não encerra a sessão', async () => {
  for (const status of [undefined, 503]) {
    const app = client('mobile'); let notified = 0;
    app.onUnauthorized(() => { notified++; });
    app.api.defaults.adapter = async (config: any) => {
      if (config.url === '/auth/refresh') {
        throw new app.axios.AxiosError('Indisponível', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, undefined,
          status ? { status, data: {}, headers: {}, config } : undefined);
      }
      throw new app.axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401 });
    };
    await assert.rejects(app.api.get('/auth/me'));
    assert.equal(app.saved.get('access'), 'old-access');
    assert.equal(app.saved.get('refresh'), 'old-refresh');
    assert.equal(notified, 0);
  }
});
