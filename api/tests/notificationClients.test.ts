import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

// Executa serviços, hooks e telas reais sem depender do runtime nativo.
function loadMobile(file: string, mocks: Record<string, any>) {
  const source = readFileSync(resolve('../mobile/src', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', code)((name: string) => {
    assert.ok(name in mocks, `Import não simulado: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports;
}

function hooks() {
  const state: any[] = [];
  let cursor = 0;
  let effect: () => (() => void) | void = () => {};
  const react = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next: any) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useRef(initial: any) { const index = cursor++; return state[index] ??= { current: initial }; },
    useCallback: (callback: any) => callback,
    useMemo: (callback: () => any) => callback(),
  };
  return { react, navigation: { useFocusEffect: (callback: typeof effect) => { effect = callback; } },
    render<T>(callback: () => T) { cursor = 0; return callback(); }, focus: () => effect() };
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const item = { id: 'NOTICE:source', type: 'NOTICE', sourceId: 'source', isRead: false };
const notice = { id: 'source', title: 'Aviso', content: 'Conteúdo completo', status: 'PUBLISHED', targetType: 'ALL' };
const event = { ...notice, category: 'OUTRO', eventDate: '2035-01-01T12:00:00Z', status: 'CANCELLED' };

test('mobile: notificação resolve o item exato e não registra leitura ao carregar', async () => {
  let writes = 0;
  let notices: any[] = [{ ...notice, id: 'outro' }, notice];
  let events: any[] = [event];
  const service = loadMobile('services/notificationService.ts', {
    './api': { api: { post: async () => { writes++; } } },
    './noticeService': { listNotices: async () => notices },
    './eventService': { listEvents: async () => events },
  });
  assert.deepEqual(await service.resolveNotificationTarget(item, 'unidade'), { type: 'NOTICE', notice });
  assert.deepEqual(await service.resolveNotificationTarget({ ...item, type: 'EVENT' }, null), { type: 'EVENT', event });
  for (const record of [
    { ...notice, status: 'DRAFT' }, { ...notice, id: 'removido' },
    { ...notice, targetType: 'UNIT', targetUnitId: 'outra-unidade' },
  ]) {
    notices = [record];
    events = [{ ...event, ...record }];
    for (const type of ['NOTICE', 'EVENT']) {
      await assert.rejects(service.resolveNotificationTarget({ ...item, type }, 'unidade'), /não está mais disponível/);
    }
  }
  notices = [{ ...notice, targetType: 'UNIT', targetUnitId: 'unidade' }];
  await assert.rejects(service.resolveNotificationTarget(item, null));
  assert.equal((await service.resolveNotificationTarget(item, 'unidade')).notice.id, item.sourceId);
  assert.equal(writes, 0);
});

test('mobile: carregamento não antecipa leitura, bloqueia duplo toque e ignora resposta após sair da tela', async () => {
  const app = hooks();
  let finish!: (value: any) => void;
  let calls = 0;
  const module = loadMobile('hooks/useNotifications.ts', {
    react: app.react, '@react-navigation/native': app.navigation,
    '../contexts/AuthContext': { useAuth: () => ({ user: { id: 'me', unitId: 'unidade' } }) },
    '../services/api': { toApiFailure: (_error: unknown, message: string) => ({ message }) },
    '../services/notificationService': {
      listNotifications: async () => [item],
      resolveNotificationTarget: async () => { calls++; return new Promise(resolve => { finish = resolve; }); },
    },
  });
  const render = () => app.render(() => module.useNotifications());
  render(); const leave = app.focus(); await flush();
  const opening = render().loadTarget(item);
  assert.equal(render().openingId, item.id);
  assert.equal(await render().loadTarget(item), null);
  assert.equal(calls, 1);
  assert.equal(render().unreadCount, 1);
  finish({ type: 'NOTICE', notice });
  assert.deepEqual(await opening, { type: 'NOTICE', notice });
  assert.equal(render().unreadCount, 1);
  const late = render().loadTarget(item);
  leave?.(); finish({ type: 'NOTICE', notice });
  assert.equal(await late, null);
});

test('mobile: falha ao carregar mantém notificação não lida e permite nova tentativa', async () => {
  const app = hooks(); let fail = true;
  const module = loadMobile('hooks/useNotifications.ts', {
    react: app.react, '@react-navigation/native': app.navigation,
    '../contexts/AuthContext': { useAuth: () => ({ user: { id: 'me', unitId: null } }) },
    '../services/api': { toApiFailure: (_error: unknown, message: string) => ({ message }) },
    '../services/notificationService': { listNotifications: async () => [item],
      resolveNotificationTarget: async () => { if (fail) throw new Error('offline'); return { type: 'NOTICE', notice }; } },
  });
  const render = () => app.render(() => module.useNotifications());
  render(); app.focus(); await flush();
  assert.equal(await render().loadTarget(item), null);
  assert.ok(render().failure);
  assert.equal(render().openingId, null);
  assert.equal(render().unreadCount, 1);
  fail = false;
  assert.deepEqual(await render().loadTarget(item), { type: 'NOTICE', notice });
  assert.equal(render().failure, null);
});

test('mobile: troca de usuário ou unidade oculta a caixa anterior e invalida abertura pendente', async () => {
  for (const next of [{ id: 'outro', unitId: 'unidade' }, { id: 'me', unitId: 'outra-unidade' }]) {
    const app = hooks(); let user = { id: 'me', unitId: 'unidade' };
    let finish!: (value: any) => void;
    const module = loadMobile('hooks/useNotifications.ts', {
      react: app.react, '@react-navigation/native': app.navigation,
      '../contexts/AuthContext': { useAuth: () => ({ user }) },
      '../services/api': { toApiFailure: () => ({ message: 'Falha' }) },
      '../services/notificationService': { listNotifications: async () => [item],
        resolveNotificationTarget: async () => new Promise(resolve => { finish = resolve; }) },
    });
    const render = () => app.render(() => module.useNotifications());
    render(); const leave = app.focus(); await flush();
    assert.equal(render().items.length, 1);
    const pending = render().loadTarget(item);
    user = next;
    assert.deepEqual(render().items, []);
    leave?.(); app.focus();
    finish({ type: 'NOTICE', notice });
    assert.equal(await pending, null);
  }
});

function screenMocks(app: ReturnType<typeof hooks>) {
  const jsx = (type: any, props: any) => ({ type, props });
  return {
    react: app.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: (value: any) => value } },
    'react-native-safe-area-context': {}, '@expo/vector-icons': {},
    '@react-navigation/native': app.navigation,
    '../theme': { colors: {}, spacing: { xs: 4 }, radius: {}, layout: {},
      typography: { subtitle: { lineHeight: 24 } }, elevation: {} },
    '../components': { StatusBanner: 'StatusBanner' },
  };
}

function find(tree: any, predicate: (node: any) => boolean): any {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : Object.values(tree)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

test('mobile: tocar notificação abre o detalhe correspondente, incluindo itens já lidos', async () => {
  for (const target of [{ type: 'NOTICE', notice }, { type: 'EVENT', event }]) {
    const app = hooks(); const navigations: any[] = [];
    const module = loadMobile('screens/NotificationsScreen.tsx', {
      ...screenMocks(app),
      '@react-navigation/native': { useNavigation: () => ({ navigate: (...args: any[]) => navigations.push(args) }) },
      '../hooks/useNotifications': { useNotifications: () => ({ items: [], unreadCount: 0,
        loadTarget: async () => target }) },
    });
    const tree = module.NotificationsScreen();
    const list = find(tree, node => typeof node.props?.renderItem === 'function');
    const row = list.props.renderItem({ item: { ...item, isRead: true, createdAt: '2035-01-01' } });
    await row.props.onPress(); await flush();
    assert.deepEqual(navigations, [target.type === 'NOTICE' ? ['Comunicado', { notice }] : ['Evento', { event }]]);
  }
});

test('mobile: detalhe registra leitura após renderizar o conteúdo e oferece nova tentativa na falha', async () => {
  for (const type of ['NOTICE', 'EVENT']) {
    const app = hooks(); let writes = 0;
    const write = async () => { writes++; if (writes === 1) throw new Error('offline'); };
    const module = loadMobile(type === 'NOTICE' ? 'screens/NoticesScreen.tsx' : 'screens/EventsScreen.tsx', {
      ...screenMocks(app),
      '../hooks/useNotices': {}, '../hooks/useEvents': {},
      '../services/noticeService': { markNoticeAsRead: write },
      '../services/eventService': { formatEventDateTime: () => '', splitEvents: () => ({}) },
      '../services/notificationService': { markNotificationRead: write },
      '../services/api': { toApiFailure: () => ({ message: 'Falha de leitura' }) },
    });
    const render = () => app.render(() => type === 'NOTICE'
      ? module.NoticeDetailScreen({ route: { params: { notice } }, navigation: {} })
      : module.EventDetailScreen({ route: { params: { event } }, navigation: {} }));
    const tree = render();
    assert.ok(find(tree, node => node.props?.children === notice.content));
    assert.equal(writes, 0);
    app.focus(); await flush();
    const banner = find(render(), node => node.type === 'StatusBanner' && node.props.title === 'Leitura não registrada');
    assert.equal(banner.props.message, 'Falha de leitura');
    banner.props.onAction(); render(); app.focus(); await flush();
    assert.equal(writes, 2);
    assert.equal(find(render(), node => node.type === 'StatusBanner' && node.props.title === 'Leitura não registrada'), undefined);
  }
});
