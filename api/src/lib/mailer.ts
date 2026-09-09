import nodemailer from 'nodemailer';

// Com SMTP_HOST definido, usa o servidor real do .env. Sem isso (dev sem
// credenciais de e-mail configuradas), cria uma caixa de teste descartável no
// Ethereal na primeira solicitação — nada chega a ninguém de verdade, mas o
// link de preview aparece no log da API, então o fluxo dá pra testar de ponta
// a ponta sem depender de nenhum provedor de e-mail.
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

  const testAccount = await nodemailer.createTestAccount();
  console.warn(
    '[mailer] SMTP_HOST não configurado — usando conta de teste Ethereal (nenhum e-mail real é enviado).',
  );
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
    console.log(`[mailer] Preview do e-mail (Ethereal): ${previewUrl}`);
  }
}
