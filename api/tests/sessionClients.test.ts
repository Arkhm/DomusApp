import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

// Execute os providers reais com hooks e I/O controlados, sem navegador ou runtime nativo.
function provider(platform: 'web' | 'mobile', fresh: any, failure?: string) {
  const state: any[] = []; const effects: Array<() => unknown> = []; let cursor = 0;
  let latest: any; let calls = 0;
  const saved = new Map<string, string>([['user', JSON.stringify({ id: 'me', role: 'ADMIN', name: 'Antigo' })]]);
  const context = { Provider: 'Provider' };
  const react = { createContext: () => context, useContext: () => latest,
    useState: (initial: any) => { const index = cursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value: any) => { state[index] = value; }]; },
    useRef: (value: any) => { const index = cursor++; return state[index] ??= { current: value }; },
    useEffect: (callback: () => unknown) => { effects.push(callback); },
    useCallback: (callback: any) => callback, useMemo: (callback: () => any) => callback(),
  };
  const me = async () => { if (failure) throw { kind: failure }; return fresh; };
  const auth = { me, fetchSessionProfile: me,
    login: async () => ({ user: fresh, token: 'access', refreshToken: 'refresh' }),
    logout: async () => { calls++; }, clearCachedUser: () => saved.delete('user'),
    cacheUser: (user: any) => saved.set('user', JSON.stringify(user)),
  };
  const source = readFileSync(resolve('..', platform, 'src/contexts/AuthContext.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any };
  const load = (name: string): any => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (_type: any, props: any) => { latest = props.value; return null; } };
    if (name === './authStore') return { AuthContext: context };
    if (name === '../lib/access') return { hasPanelAccess: (u: any) => u && (u.role === 'ADMIN' || u.role === 'FUNCIONARIO' || u.role === 'MORADOR' && u.isSyndic) };
    if (name === '../services/authService') return { ...auth, authService: auth };
    if (name === '../services/api') return { toApiFailure: (e: any) => e, onUnauthorized: () => () => {} };
    if (name === '../services/secureStorage') return { STORAGE_KEYS: { token: 'access', refreshToken: 'refresh', user: 'user' },
      secureStorage: { get: async (key: string) => saved.get(key) ?? null,
        set: async (key: string, value: string) => { saved.set(key, value); }, remove: async (key: string) => { saved.delete(key); } } };
    throw new Error(name);
  };
  new Function('require', 'module', 'exports', compiled)(load, module, module.exports);
  const render = () => { cursor = 0; module.exports.AuthProvider({ children: null }); return latest; };
  return { render, saved, effects, logoutCalls: () => calls,
    async settle() { for (const effect of effects.splice(0)) effect(); await new Promise(resolve => setTimeout(resolve, 10)); return render(); } };
}

test('web restaura perfis autorizados e rejeita morador sem logout global', async () => {
  for (const profile of [{ role: 'ADMIN' }, { role: 'FUNCIONARIO' }, { role: 'MORADOR', isSyndic: true }, { role: 'MORADOR', isSyndic: false }]) {
    const app = provider('web', profile); assert.equal(app.render().isLoading, true);
    const restored = await app.settle();
    assert.equal(restored.isAuthenticated, profile.role !== 'MORADOR' || profile.isSyndic);
    assert.equal(app.logoutCalls(), 0);
    if (!restored.isAuthenticated) {
      await assert.rejects(restored.login({ email: 'morador', password: 'senha' }), /aplicativo do morador/);
      assert.equal(app.render().user, null); assert.equal(app.saved.has('user'), false);
    }
  }
});
test('mobile restaura perfil atualizado e preserva cache somente offline', async () => {
  for (const failure of [undefined, 'network', 'server', 'credentials']) {
    const fresh = { id: 'me', role: 'MORADOR', name: 'Atual', unit: { number: '101' } };
    const app = provider('mobile', fresh, failure); app.saved.set('access', 'token'); app.render();
    const restored = await app.settle();
    if (!failure) { assert.deepEqual(restored.user, fresh); assert.deepEqual(JSON.parse(app.saved.get('user')!), fresh); }
    else if (failure === 'credentials') { assert.equal(restored.user, null); assert.equal(app.saved.has('access'), false); }
    else assert.equal(restored.user.name, 'Antigo');
  }
});

test('mobile: login usa perfil atual; falha transitória preserva login; sessão inválida limpa tokens', async () => {
  for (const failure of [undefined, 'network', 'server', 'credentials']) {
    const fresh = { id: 'me', name: 'Morador', role: 'MORADOR', unit: { number: '101' } };
    const app = provider('mobile', fresh, failure); const context = app.render();
    const result = await context.signIn('morador@example.test', 'senha');
    if (failure === 'credentials') {
      assert.equal(result.kind, failure); assert.equal(app.render().user, null); assert.equal(app.saved.has('access'), false);
    } else {
      assert.equal(result, null); assert.deepEqual(app.render().user, fresh);
      assert.equal(app.saved.get('access'), 'access'); assert.deepEqual(JSON.parse(app.saved.get('user')!), fresh);
    }
  }
});
