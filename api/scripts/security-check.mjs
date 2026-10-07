/**
 * Verificação end-to-end das correções de segurança do Mês 1.
 *
 * Bate numa API **rodando de verdade** e confere, na resposta real:
 *   1. JWT em cookie httpOnly (e nunca no corpo da resposta)
 *   2. Rate limiting no /auth/login
 *   3. Headers de segurança do Helmet
 *   4. CORS restritivo
 *
 * Uso:
 *   docker compose up -d
 *   npm run check:security
 *
 * Variáveis: API_URL, ALLOWED_ORIGIN, TEST_EMAIL, TEST_PASSWORD.
 *
 * O bloco de rate limiting roda por último de propósito: ele estoura a cota de
 * login do IP por 15 minutos. Para rodar de novo antes disso, reinicie a API
 * (`docker compose restart api`) — o contador vive em memória.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3333';
const ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const EVIL_ORIGIN = 'http://evil.example.com';
const EMAIL = process.env.TEST_EMAIL ?? 'admin@domusapp.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'admin123';

const results = [];
let currentSection = '';

const section = (name) => {
  currentSection = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
};

const check = (name, passed, detail = '') => {
  results.push({ section: currentSection, name, passed });
  const mark = passed ? '\x1b[32m  PASS\x1b[0m' : '\x1b[31m  FAIL\x1b[0m';
  console.log(`${mark}  ${name}${detail ? `\n          ${detail}` : ''}`);
};

// Parser mínimo de Set-Cookie: nome, valor e o mapa de atributos em minúsculas.
const parseCookie = (raw) => {
  const [pair, ...attrs] = raw.split(';').map((part) => part.trim());
  const eq = pair.indexOf('=');
  const flags = {};
  for (const attr of attrs) {
    const idx = attr.indexOf('=');
    if (idx === -1) flags[attr.toLowerCase()] = true;
    else flags[attr.slice(0, idx).toLowerCase()] = attr.slice(idx + 1);
  }
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), flags, raw };
};

const getCookie = (res, name) =>
  res.headers
    .getSetCookie()
    .map(parseCookie)
    .find((cookie) => cookie.name === name);

const login = (email = EMAIL, password = PASSWORD, origin = ORIGIN) =>
  fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ email, password }),
  });

async function main() {
  console.log(`\x1b[1mDomusApp — verificação de segurança (Mês 1)\x1b[0m`);
  console.log(`API: ${API_URL}  ·  Origem permitida: ${ORIGIN}`);

  // Falha cedo e com mensagem clara se a API não estiver de pé.
  try {
    await fetch(`${API_URL}/api/status`);
  } catch {
    console.error(`\n\x1b[31mAPI inacessível em ${API_URL}. Suba com "docker compose up -d".\x1b[0m`);
    process.exit(1);
  }

  // ── 3. Headers de segurança (Helmet) ───────────────────────────────────────
  // Roda antes do login para não gastar cota do rate limiter.
  section('3. Headers de segurança (Helmet)');
  const statusRes = await fetch(`${API_URL}/api/status`);
  const header = (name) => statusRes.headers.get(name);

  check(
    'X-Content-Type-Options: nosniff (bloqueia MIME sniffing)',
    header('x-content-type-options') === 'nosniff',
    `recebido: ${header('x-content-type-options') ?? '(ausente)'}`
  );
  check(
    'X-Frame-Options: SAMEORIGIN (bloqueia clickjacking)',
    header('x-frame-options') === 'SAMEORIGIN',
    `recebido: ${header('x-frame-options') ?? '(ausente)'}`
  );
  check(
    'Strict-Transport-Security presente (força HTTPS)',
    !!header('strict-transport-security'),
    `recebido: ${header('strict-transport-security') ?? '(ausente)'}`
  );
  check(
    'Content-Security-Policy presente',
    !!header('content-security-policy'),
    `recebido: ${header('content-security-policy') ? '(definido)' : '(ausente)'}`
  );
  check(
    'X-Powered-By removido (não entrega o stack)',
    header('x-powered-by') === null,
    `recebido: ${header('x-powered-by') ?? '(ausente)'}`
  );

  // ── 4. CORS restritivo ─────────────────────────────────────────────────────
  section('4. CORS restritivo');
  const corsAllowed = await fetch(`${API_URL}/api/status`, { headers: { Origin: ORIGIN } });
  check(
    'Origem permitida recebe Access-Control-Allow-Origin',
    corsAllowed.headers.get('access-control-allow-origin') === ORIGIN,
    `recebido: ${corsAllowed.headers.get('access-control-allow-origin') ?? '(ausente)'}`
  );
  check(
    'Access-Control-Allow-Credentials: true (necessário para o cookie)',
    corsAllowed.headers.get('access-control-allow-credentials') === 'true',
    `recebido: ${corsAllowed.headers.get('access-control-allow-credentials') ?? '(ausente)'}`
  );

  const corsBlocked = await fetch(`${API_URL}/api/status`, { headers: { Origin: EVIL_ORIGIN } });
  check(
    'Origem desconhecida é recusada (403, sem header de CORS)',
    corsBlocked.status === 403 && corsBlocked.headers.get('access-control-allow-origin') === null,
    `status: ${corsBlocked.status} · ACAO: ${corsBlocked.headers.get('access-control-allow-origin') ?? '(ausente)'}`
  );

  const preflightBlocked = await fetch(`${API_URL}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: EVIL_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  check(
    'Preflight de origem desconhecida não libera a rota',
    preflightBlocked.headers.get('access-control-allow-origin') === null,
    `status: ${preflightBlocked.status} · ACAO: ${preflightBlocked.headers.get('access-control-allow-origin') ?? '(ausente)'}`
  );

  // ── 1. JWT em cookie httpOnly ──────────────────────────────────────────────
  section('1. JWT em cookie httpOnly (fora do localStorage)');
  const loginRes = await login();
  const loginBody = await loginRes.json();

  check('Login com credenciais válidas retorna 200', loginRes.status === 200, `status: ${loginRes.status}`);

  const cookie = getCookie(loginRes, 'domusapp_token');
  check('Login emite o cookie domusapp_token', !!cookie, cookie ? cookie.raw.split(';')[0].slice(0, 40) + '…' : '(nenhum Set-Cookie)');
  check('Cookie marcado HttpOnly (JS da página não lê)', !!cookie?.flags.httponly);
  check('Cookie marcado SameSite=Strict (proteção CSRF)', cookie?.flags.samesite?.toLowerCase() === 'strict', `recebido: ${cookie?.flags.samesite ?? '(ausente)'}`);
  check('Cookie tem Max-Age definido (expira sozinho)', !!cookie?.flags['max-age'], `recebido: ${cookie?.flags['max-age'] ?? '(ausente)'}`);

  const bodyKeys = Object.keys(loginBody ?? {});
  check(
    'Resposta NÃO devolve token no corpo (nada para o front guardar)',
    !('token' in (loginBody ?? {})) && !('accessToken' in (loginBody ?? {})),
    `chaves do corpo: ${bodyKeys.join(', ') || '(vazio)'}`
  );
  check('Resposta devolve o perfil do usuário', !!loginBody?.user?.email, `usuário: ${loginBody?.user?.email ?? '(ausente)'}`);
  check('Perfil retornado não expõe o hash da senha', loginBody?.user && !('password' in loginBody.user));

  const jwtLooking = cookie?.value?.split('.').length === 3;
  check('Valor do cookie é o JWT (3 segmentos)', jwtLooking);

  section('1b. Sessão via cookie nas rotas protegidas');
  const sessionHeader = { Cookie: `domusapp_token=${cookie?.value ?? ''}`, Origin: ORIGIN };

  const meWithCookie = await fetch(`${API_URL}/auth/me`, { headers: sessionHeader });
  const meBody = await meWithCookie.json().catch(() => null);
  check('GET /auth/me autentica só com o cookie', meWithCookie.status === 200, `status: ${meWithCookie.status}`);
  check('GET /auth/me devolve o usuário logado', meBody?.user?.email === EMAIL, `usuário: ${meBody?.user?.email ?? '(ausente)'}`);

  const meNoAuth = await fetch(`${API_URL}/auth/me`, { headers: { Origin: ORIGIN } });
  check('GET /auth/me sem cookie é recusado (401)', meNoAuth.status === 401, `status: ${meNoAuth.status}`);

  const meBadCookie = await fetch(`${API_URL}/auth/me`, {
    headers: { Cookie: 'domusapp_token=token.falso.aqui', Origin: ORIGIN },
  });
  check('GET /auth/me com token forjado é recusado (401)', meBadCookie.status === 401, `status: ${meBadCookie.status}`);

  const protectedRes = await fetch(`${API_URL}/users`, { headers: sessionHeader });
  check('Rota de negócio (/users) aceita a sessão do cookie', protectedRes.status === 200, `status: ${protectedRes.status}`);

  const logoutRes = await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: sessionHeader });
  const clearedCookie = getCookie(logoutRes, 'domusapp_token');
  check('POST /auth/logout responde 200', logoutRes.status === 200, `status: ${logoutRes.status}`);
  check(
    'Logout apaga o cookie (só a API consegue, é httpOnly)',
    !!clearedCookie && clearedCookie.value === '',
    clearedCookie ? clearedCookie.raw.split(';').slice(0, 2).join(';') : '(nenhum Set-Cookie)'
  );

  // ── 2. Rate limiting ───────────────────────────────────────────────────────
  // Por último: estoura a cota de login deste IP pelos próximos 15 minutos.
  section('2. Rate limiting no login (força bruta)');
  const statuses = [];
  for (let attempt = 1; attempt <= 12; attempt++) {
    const res = await login(EMAIL, 'senha-errada-de-proposito');
    statuses.push(res.status);
    if (res.status === 429) {
      const body = await res.json().catch(() => null);
      check(
        `Bloqueou na tentativa ${attempt} com 429 (limite: 10/15min)`,
        attempt <= 11,
        `mensagem: ${body?.error ?? '(sem corpo)'}`
      );
      break;
    }
  }

  const firstTen = statuses.slice(0, 10);
  check(
    'As 10 primeiras tentativas passam pelo limiter (chegam como 401)',
    firstTen.length === 10 && firstTen.every((status) => status === 401),
    `status das 10 primeiras: ${firstTen.join(', ')}`
  );
  check('Alguma tentativa foi barrada com 429', statuses.includes(429), `sequência: ${statuses.join(', ')}`);
  check(
    'Header RateLimit-* exposto (cliente sabe a cota)',
    !!(await login(EMAIL, 'x')).headers.get('ratelimit-policy'),
  );

  // ── Resumo ─────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`\x1b[1mResultado:\x1b[0m ${results.length - failed.length}/${results.length} verificações passaram`);

  if (failed.length) {
    console.log(`\n\x1b[31mFalhas:\x1b[0m`);
    for (const item of failed) console.log(`  · [${item.section}] ${item.name}`);
    process.exit(1);
  }

  console.log(`\x1b[32mTodas as 4 correções de segurança do Mês 1 estão ativas.\x1b[0m`);
  console.log(`\n\x1b[2mNota: a cota de login deste IP foi consumida. Para rodar de novo agora,`);
  console.log(`use "docker compose restart api" (o contador do limiter vive em memória).\x1b[0m`);
}

main().catch((error) => {
  console.error('\n\x1b[31mErro inesperado durante a verificação:\x1b[0m', error);
  process.exit(1);
});
