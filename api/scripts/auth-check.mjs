/**
 * Verificação end-to-end das entregas das Semanas 3 e 4 do plano de adequação.
 *
 * Bate numa API **rodando de verdade** e confere, na resposta real:
 *   3.  Validação de entrada com Zod (incluindo mass assignment e :id malformado)
 *   4a. RF-007 — recuperação de senha (forgot → email → reset → login)
 *   4b. Refresh token (reemissão, isolamento de segredo, invalidação por reset)
 *
 * Uso:
 *   docker compose up -d
 *   npm run check:auth
 *
 * Variáveis: API_URL, ALLOWED_ORIGIN, TEST_EMAIL, TEST_PASSWORD, API_CONTAINER.
 *
 * ATENÇÃO: o bloco do RF-007 consome ~8 das 20 chamadas que o
 * `passwordResetLimiter` permite por IP a cada 15 minutos. Duas execuções
 * seguidas cabem; a terceira começa a receber 429. O contador vive em memória,
 * então para zerar basta `docker compose restart api`.
 *
 * O fluxo do RF-007 cria um usuário FUNCIONARIO temporário, troca a senha dele
 * e o remove no final — o admin e os dados de seed ficam intactos. O token de
 * recuperação é lido do log da API (sem SMTP o nodemailer imprime o link em vez
 * de enviar); se o container não estiver acessível, esses testes são pulados em
 * vez de falharem.
 */

import { execSync } from 'node:child_process';

const API_URL = process.env.API_URL ?? 'http://localhost:3333';
const ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'admin@domusapp.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'admin123';
const CONTAINER = process.env.API_CONTAINER ?? 'domusapp_api';

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

const skip = (name, why) => {
  results.push({ section: currentSection, name, skipped: true });
  console.log(`\x1b[33m  SKIP\x1b[0m  ${name}\n          ${why}`);
};

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
  res.headers.getSetCookie().map(parseCookie).find((cookie) => cookie.name === name);

const call = (path, { method = 'POST', body, cookies, origin = ORIGIN } = {}) =>
  fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(cookies ? { Cookie: cookies } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const json = async (res) => await res.json().catch(() => null);

const login = (email = EMAIL, password = PASSWORD) =>
  call('/auth/login', { body: { email, password } });

async function main() {
  console.log(`\x1b[1mDomusApp — verificação de Auth e Validação (Semanas 3 e 4)\x1b[0m`);
  console.log(`API: ${API_URL}`);

  try {
    await fetch(`${API_URL}/api/status`);
  } catch {
    console.error(`\n\x1b[31mAPI inacessível em ${API_URL}. Suba com "docker compose up -d".\x1b[0m`);
    process.exit(1);
  }

  // ── Sessão de admin, usada nos testes de validação das rotas protegidas ────
  const adminRes = await login();
  const adminAccess = getCookie(adminRes, 'domusapp_token');
  const adminRefresh = getCookie(adminRes, 'domusapp_refresh');
  if (adminRes.status !== 200 || !adminAccess) {
    console.error(`\n\x1b[31mNão foi possível logar como ${EMAIL}. Rode o seed antes.\x1b[0m`);
    process.exit(1);
  }
  const adminCookies = `domusapp_token=${adminAccess.value}`;

  // ── 3. Validação com Zod ──────────────────────────────────────────────────
  section('3. Validação de entrada com Zod');

  const emptyLogin = await call('/auth/login', { body: {} });
  const emptyLoginBody = await json(emptyLogin);
  check(
    'Login sem corpo é recusado com 400 (não chega ao service)',
    emptyLogin.status === 400,
    `status: ${emptyLogin.status}`
  );
  check(
    'Erro de validação mantém o contrato { error: string } do front',
    typeof emptyLoginBody?.error === 'string' && emptyLoginBody.error.length > 0,
    `error: ${emptyLoginBody?.error ?? '(ausente)'}`
  );
  check(
    'Erro de validação traz `details` com o mapa por campo',
    !!emptyLoginBody?.details?.email && !!emptyLoginBody?.details?.password,
    `campos: ${Object.keys(emptyLoginBody?.details ?? {}).join(', ') || '(nenhum)'}`
  );

  const badFields = await call('/users', {
    body: { name: 'Teste', email: 'nao-e-email', cpf: '123', password: 'curta', role: 'ADMIN' },
    cookies: adminCookies,
  });
  const badFieldsBody = await json(badFields);
  check(
    'POST /users com email, CPF e senha inválidos é recusado',
    badFields.status === 400,
    `status: ${badFields.status}`
  );
  check(
    'Os três campos inválidos são apontados individualmente',
    !!badFieldsBody?.details?.email && !!badFieldsBody?.details?.cpf && !!badFieldsBody?.details?.password,
    `campos: ${Object.keys(badFieldsBody?.details ?? {}).join(', ') || '(nenhum)'}`
  );

  // Caso de teste 3 da documentação (RNE-003).
  const moradorSemUnidade = await call('/users', {
    body: {
      name: 'Teste',
      email: `morador.sem.unidade.${Date.now()}@t.com`,
      cpf: String(Date.now()).slice(-11),
      password: 'senha12345',
      role: 'MORADOR',
    },
    cookies: adminCookies,
  });
  const moradorBody = await json(moradorSemUnidade);
  check(
    'RNE-003: MORADOR sem unitId é recusado com 400',
    moradorSemUnidade.status === 400,
    `status: ${moradorSemUnidade.status}`
  );
  check(
    'A mensagem do erro cita `unitId`',
    JSON.stringify(moradorBody ?? {}).includes('unitId'),
    `error: ${moradorBody?.error ?? '(ausente)'}`
  );

  const badParam = await call('/users/nao-e-uuid', { method: 'GET', cookies: adminCookies });
  check(
    ':id malformado é barrado com 400 antes de virar consulta no banco',
    badParam.status === 400,
    `status: ${badParam.status}`
  );

  // Mass assignment: campos fora do schema devem ser descartados no parse.
  const massAssign = await call('/units', {
    body: {
      number: `MA-${Date.now()}`,
      type: 'HOUSE',
      id: 'id-forjado',
      createdAt: '1999-01-01T00:00:00.000Z',
    },
    cookies: adminCookies,
  });
  const unitBody = await json(massAssign);
  check('POST /units com payload válido continua funcionando', massAssign.status === 201, `status: ${massAssign.status}`);
  check(
    'Campos fora do schema (`id`, `createdAt`) são descartados no parse',
    massAssign.status === 201 &&
      unitBody?.id !== 'id-forjado' &&
      !String(unitBody?.createdAt ?? '').startsWith('1999'),
    `id: ${unitBody?.id ?? '(ausente)'} · createdAt: ${unitBody?.createdAt ?? '(ausente)'}`
  );
  if (unitBody?.id) {
    await call(`/units/${unitBody.id}`, { method: 'DELETE', cookies: adminCookies });
  }

  const badVoting = await call('/votings', {
    body: {
      title: 'Votação inválida',
      description: 'Datas invertidas de propósito',
      startDate: '2026-12-31T12:00:00.000Z',
      endDate: '2026-01-01T12:00:00.000Z',
      options: ['Sim', 'Sim'],
    },
    cookies: adminCookies,
  });
  const votingBody = await json(badVoting);
  check(
    'Votação com datas invertidas e opções repetidas é recusada',
    badVoting.status === 400,
    `status: ${badVoting.status}`
  );
  check(
    'O erro aponta `endDate` e `options`',
    !!votingBody?.details?.endDate && !!votingBody?.details?.options,
    `campos: ${Object.keys(votingBody?.details ?? {}).join(', ') || '(nenhum)'}`
  );

  // ── 4b. Refresh token ─────────────────────────────────────────────────────
  section('4b. Refresh token');

  check('Login emite o cookie domusapp_refresh', !!adminRefresh, adminRefresh ? '(presente)' : '(ausente)');
  check('Refresh token é HttpOnly', !!adminRefresh?.flags.httponly);
  check(
    'Refresh token tem Path=/auth (não circula nas demais rotas)',
    adminRefresh?.flags.path === '/auth',
    `recebido: ${adminRefresh?.flags.path ?? '(ausente)'}`
  );
  check(
    'Access token dura ~15 min',
    Number(adminAccess.flags['max-age']) === 900,
    `max-age: ${adminAccess.flags['max-age'] ?? '(ausente)'}`
  );
  check(
    'Refresh token dura ~7 dias',
    Number(adminRefresh?.flags['max-age']) === 604800,
    `max-age: ${adminRefresh?.flags['max-age'] ?? '(ausente)'}`
  );

  const refreshRes = await call('/auth/refresh', { cookies: `domusapp_refresh=${adminRefresh.value}` });
  const refreshBody = await json(refreshRes);
  const rotatedAccess = getCookie(refreshRes, 'domusapp_token');
  const rotatedRefresh = getCookie(refreshRes, 'domusapp_refresh');
  check('POST /auth/refresh com refresh válido responde 200', refreshRes.status === 200, `status: ${refreshRes.status}`);
  // Não comparamos o valor com o do login anterior de propósito. Um JWT é
  // determinístico: mesmo payload + mesmo segredo + mesmo `iat` (resolução de
  // 1s) produz a mesma string. E, mais importante, reemitir um JWT sem estado
  // não revoga o anterior — o que se verifica aqui é que a renovação devolve
  // credenciais utilizáveis, não uma rotação com revogação (que exigiria
  // guardar sessões no banco).
  check(
    'Refresh reemite o cookie de access com os atributos corretos',
    !!rotatedAccess?.value && !!rotatedAccess.flags.httponly && Number(rotatedAccess.flags['max-age']) === 900,
    `httpOnly: ${!!rotatedAccess?.flags.httponly} · max-age: ${rotatedAccess?.flags['max-age'] ?? '(ausente)'}`
  );
  check(
    'Refresh reemite também o cookie de refresh (Path=/auth)',
    !!rotatedRefresh?.value && rotatedRefresh.flags.path === '/auth',
    `path: ${rotatedRefresh?.flags.path ?? '(ausente)'}`
  );
  check(
    'Refresh não devolve token no corpo (nada para o front guardar)',
    !!refreshBody && !('accessToken' in refreshBody) && !('token' in refreshBody),
    `chaves do corpo: ${Object.keys(refreshBody ?? {}).join(', ') || '(vazio)'}`
  );

  const noRefresh = await call('/auth/refresh');
  check('POST /auth/refresh sem cookie é recusado (401)', noRefresh.status === 401, `status: ${noRefresh.status}`);

  // Segredos distintos: um access token não vale como refresh.
  const accessAsRefresh = await call('/auth/refresh', { cookies: `domusapp_refresh=${adminAccess.value}` });
  check(
    'Access token apresentado como refresh é recusado (segredos distintos)',
    accessAsRefresh.status === 401,
    `status: ${accessAsRefresh.status}`
  );

  const newAccessOk = await call('/auth/me', { method: 'GET', cookies: `domusapp_token=${rotatedAccess.value}` });
  check('O access token renovado autentica em /auth/me', newAccessOk.status === 200, `status: ${newAccessOk.status}`);

  const logoutRes = await call('/auth/logout', { cookies: `domusapp_refresh=${rotatedRefresh.value}` });
  const clearedAccess = getCookie(logoutRes, 'domusapp_token');
  const clearedRefresh = getCookie(logoutRes, 'domusapp_refresh');
  check(
    'Logout apaga os DOIS cookies (deixar o refresh vivo manteria a sessão)',
    clearedAccess?.value === '' && clearedRefresh?.value === '',
    `token: ${clearedAccess?.value === '' ? 'limpo' : '?'} · refresh: ${clearedRefresh?.value === '' ? 'limpo' : '?'}`
  );

  // ── 4a. RF-007 — recuperação de senha ─────────────────────────────────────
  section('4a. RF-007 — recuperação de senha');

  const unknown = await call('/auth/forgot-password', {
    body: { email: `nao.existe.${Date.now()}@dominio.com` },
  });
  const unknownBody = await json(unknown);
  const known = await call('/auth/forgot-password', { body: { email: EMAIL } });
  const knownBody = await json(known);

  check('forgot-password com email desconhecido responde 200', unknown.status === 200, `status: ${unknown.status}`);
  check('forgot-password com email real responde 200', known.status === 200, `status: ${known.status}`);
  check(
    'As duas respostas são idênticas (não revela quem tem cadastro)',
    unknown.status === known.status && unknownBody?.message === knownBody?.message,
    `mensagem: ${knownBody?.message ?? '(ausente)'}`
  );

  const malformedToken = await call('/auth/reset-password', {
    body: { token: 'abc', password: 'senha12345' },
  });
  check(
    'reset-password com token malformado é barrado pelo Zod (400)',
    malformedToken.status === 400,
    `status: ${malformedToken.status}`
  );

  const wrongToken = await call('/auth/reset-password', {
    body: { token: 'f'.repeat(64), password: 'senha12345' },
  });
  const wrongBody = await json(wrongToken);
  check('reset-password com token inexistente é recusado (400)', wrongToken.status === 400, `status: ${wrongToken.status}`);
  check(
    'A mensagem não distingue token inexistente de expirado',
    /inválido ou expirado/i.test(wrongBody?.error ?? ''),
    `error: ${wrongBody?.error ?? '(ausente)'}`
  );

  const shortPassword = await call('/auth/reset-password', {
    body: { token: 'a'.repeat(64), password: '123' },
  });
  check(
    'reset-password recusa senha com menos de 8 caracteres',
    shortPassword.status === 400,
    `status: ${shortPassword.status}`
  );

  // ── Fluxo completo do RF-007, com usuário descartável ─────────────────────
  section('4a. RF-007 — fluxo completo (forgot → email → reset → login)');

  const readLogs = () => {
    try {
      return execSync(`docker logs ${CONTAINER} --tail 400`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      return null;
    }
  };

  if (readLogs() === null) {
    skip(
      'Fluxo completo de recuperação de senha',
      `Não foi possível ler o log do container "${CONTAINER}" (é dele que sai o link, já que não há SMTP em dev).`
    );
  } else {
    const stamp = Date.now();
    const tempEmail = `reset.teste.${stamp}@domusapp.local`;
    const OLD_PASSWORD = 'SenhaAntiga123';
    const NEW_PASSWORD = 'SenhaNova456';

    const created = await call('/users', {
      body: {
        name: 'Usuário Temporário de Teste',
        email: tempEmail,
        cpf: String(stamp).slice(-11),
        password: OLD_PASSWORD,
        role: 'FUNCIONARIO',
      },
      cookies: adminCookies,
    });
    const tempUser = await json(created);

    if (created.status !== 201 || !tempUser?.id) {
      check(
        'Criação do usuário temporário de teste',
        false,
        `status: ${created.status} · ${tempUser?.error ?? ''}`
      );
    } else {
      // Sessão ANTES do reset — precisamos dela para provar a invalidação.
      const beforeLogin = await login(tempEmail, OLD_PASSWORD);
      const oldRefresh = getCookie(beforeLogin, 'domusapp_refresh');
      check(
        'Usuário temporário consegue logar com a senha original',
        beforeLogin.status === 200,
        `status: ${beforeLogin.status}`
      );

      // O `iat` do JWT tem resolução de 1 segundo, então login e reset dentro
      // do mesmo segundo são indistinguíveis para a checagem de
      // `passwordChangedAt`. A pausa garante que o teste exercite o caso real
      // (sessão antiga) em vez de esbarrar na granularidade do relógio.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await call('/auth/forgot-password', { body: { email: tempEmail } });

      // Sem SMTP o nodemailer imprime o link no log em vez de enviar.
      const logs = readLogs() ?? '';
      const match = [...logs.matchAll(/redefinir-senha\?token=([a-f0-9]{64})/g)].pop();
      const rawToken = match?.[1];

      check(
        'O link de recuperação foi gerado e registrado',
        !!rawToken,
        rawToken ? `token: ${rawToken.slice(0, 12)}…` : '(não encontrado no log)'
      );

      if (rawToken) {
        const reset = await call('/auth/reset-password', {
          body: { token: rawToken, password: NEW_PASSWORD },
        });
        const resetBody = await json(reset);
        check(
          'reset-password com o token do email responde 200',
          reset.status === 200,
          `status: ${reset.status} · ${resetBody?.error ?? resetBody?.message ?? ''}`
        );

        const withNew = await login(tempEmail, NEW_PASSWORD);
        check('Login com a NOVA senha funciona', withNew.status === 200, `status: ${withNew.status}`);

        const withOld = await login(tempEmail, OLD_PASSWORD);
        check('Login com a senha ANTIGA é recusado (401)', withOld.status === 401, `status: ${withOld.status}`);

        const reuse = await call('/auth/reset-password', {
          body: { token: rawToken, password: 'OutraSenha789' },
        });
        check('O token de recuperação é de uso único', reuse.status === 400, `status: ${reuse.status}`);

        const oldSession = await call('/auth/refresh', {
          cookies: `domusapp_refresh=${oldRefresh?.value ?? ''}`,
        });
        check(
          'Refresh token emitido ANTES do reset deixa de valer',
          oldSession.status === 401,
          `status: ${oldSession.status} (sem isso a sessão roubada sobreviveria 7 dias ao reset)`
        );
      }

      const removed = await call(`/users/${tempUser.id}`, { method: 'DELETE', cookies: adminCookies });
      check('Usuário temporário removido ao final', removed.status === 200, `status: ${removed.status}`);
    }
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.passed && !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  const passed = results.filter((r) => r.passed);

  console.log(`\n${'─'.repeat(64)}`);
  console.log(
    `\x1b[1mResultado:\x1b[0m ${passed.length}/${results.length - skipped.length} verificações passaram` +
      (skipped.length ? ` · ${skipped.length} puladas` : '')
  );

  if (failed.length) {
    console.log(`\n\x1b[31mFalhas:\x1b[0m`);
    for (const item of failed) console.log(`  · [${item.section}] ${item.name}`);
    process.exit(1);
  }

  console.log(`\x1b[32mSemanas 3 e 4 verificadas: Zod, RF-007 e refresh token estão ativos.\x1b[0m`);
}

main().catch((error) => {
  console.error('\n\x1b[31mErro inesperado durante a verificação:\x1b[0m', error);
  process.exit(1);
});
