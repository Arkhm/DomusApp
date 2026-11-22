export function mailConfig(env: NodeJS.ProcessEnv = process.env) {
  const host = env.SMTP_HOST?.trim();
  const production = env.NODE_ENV === 'production';
  const configured = ['SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].some(k => !!env[k]);
  if (!host && (production || configured)) throw new Error('SMTP_HOST obrigatório para envio SMTP.');
  const rawUrl = env.FRONTEND_URL?.trim();
  if (!rawUrl && (production || host)) throw new Error('FRONTEND_URL obrigatório para envio SMTP.');
  let frontend: URL;
  try { frontend = new URL(rawUrl || 'http://localhost:5173'); }
  catch { throw new Error('FRONTEND_URL inválida.'); }
  if (!['http:', 'https:'].includes(frontend.protocol) || frontend.username || frontend.password || frontend.search || frontend.hash || frontend.pathname !== '/') throw new Error('FRONTEND_URL deve ser uma origem HTTP(S).');
  if (production && frontend.protocol !== 'https:') throw new Error('FRONTEND_URL deve usar HTTPS em produção.');
  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT inválida.');
  if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) throw new Error('SMTP_SECURE deve ser true ou false.');
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
  if ((port === 465 && !secure) || ([587, 2525].includes(port) && secure)) throw new Error('SMTP_SECURE incompatível com a porta SMTP.');
  if (!!env.SMTP_USER !== !!env.SMTP_PASS) throw new Error('SMTP_USER e SMTP_PASS devem ser fornecidos juntos.');
  const from = env.SMTP_FROM?.trim();
  if (host && (!from || !/^(?:[^<>\r\n]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/.test(from))) throw new Error('SMTP_FROM deve conter um remetente válido.');
  return { frontendUrl: frontend.origin, from: from || '"DomusApp" <no-reply@domusapp.local>', host, port, secure,
    requireTLS: !secure, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS! } : undefined };
}
