import { logger } from './logger';
import nodemailer from 'nodemailer';

// Com SMTP_HOST definido, usa o servidor real do .env. Sem isso (dev sem
// credenciais de e-mail configuradas), cria uma caixa de teste descartável no
// Ethereal na primeira solicitação. O preview é registrado apenas para e-mails de teste.
let transporterPromise: ReturnType<typeof buildTransporter> | null = null;

async function buildTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  if (process.env.NODE_ENV === 'production') throw new Error('SMTP_HOST obrigatório em produção.');
  const testAccount = await nodemailer.createTestAccount();
  logger.warn({ provider: 'ethereal' }, 'SMTP não configurado; usando caixa de teste sem envio real.');
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

function getTransporter() {
  if (!transporterPromise) transporterPromise = buildTransporter();
  return transporterPromise;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"DomusApp" <no-reply@domusapp.local>',
    to,
    subject: 'Redefinição de senha — DomusApp',
    text: `Recebemos uma solicitação para redefinir sua senha.\n\nAcesse o link abaixo (válido por 1 hora):\n${resetUrl}\n\nSe você não solicitou isso, ignore este e-mail.`,
    html: `<p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${resetUrl}">Clique aqui para redefinir sua senha</a> (link válido por 1 hora).</p><p>Se você não solicitou isso, ignore este e-mail.</p>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info({ previewUrl }, 'Preview do e-mail de teste no Ethereal.');
  }
}
