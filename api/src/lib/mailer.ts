import nodemailer, { type Transporter } from 'nodemailer';

// URL do front, usada para montar o link do email de recuperação.
const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

const MAIL_FROM = () => process.env.MAIL_FROM || 'DomusApp <nao-responda@domusapp.local>';

// Sem SMTP configurado (o caso do ambiente de desenvolvimento e da banca), o
// nodemailer roda em `jsonTransport`: nada sai pela rede, o email é serializado
// e o link vai para o console. O fluxo de recuperação continua testável de
// ponta a ponta sem depender de credenciais de um servidor de email real.
const isSmtpConfigured = () => Boolean(process.env.SMTP_HOST);

let cached: Transporter | null = null;

const transporter = (): Transporter => {
  if (cached) return cached;

  cached = isSmtpConfigured()
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        // 465 usa TLS implícito; 587 sobe para TLS via STARTTLS.
        secure: process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === 'true'
          : Number(process.env.SMTP_PORT || 587) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });

  return cached;
};

// Precisa bater com a rota declarada no AppRoutes do front.
export const buildResetUrl = (token: string) =>
  `${appUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;

export const mailer = {
  async sendPasswordReset(to: string, name: string, token: string) {
    const url = buildResetUrl(token);

    await transporter().sendMail({
      from: MAIL_FROM(),
      to,
      subject: 'DomusApp — redefinição de senha',
      text: [
        `Olá, ${name}.`,
        '',
        'Recebemos um pedido para redefinir a senha da sua conta no DomusApp.',
        'Abra o link abaixo para escolher uma nova senha (válido por 1 hora):',
        '',
        url,
        '',
        'Se não foi você quem pediu, ignore este email — sua senha continua a mesma.',
      ].join('\n'),
      html: `
        <p>Olá, ${name}.</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta no DomusApp.</p>
        <p><a href="${url}">Clique aqui para escolher uma nova senha</a> (link válido por 1 hora).</p>
        <p style="color:#666">Se não foi você quem pediu, ignore este email — sua senha continua a mesma.</p>
      `,
    });

    // Sem SMTP o email não chega a lugar nenhum, então o link precisa aparecer
    // em algum lugar para o fluxo ser testável. Nunca em produção.
    if (!isSmtpConfigured()) {
      console.log(`[mailer:dev] Link de recuperação para ${to}: ${url}`);
    }
  },
};
