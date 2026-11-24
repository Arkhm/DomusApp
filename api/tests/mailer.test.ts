import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { sendPasswordResetEmail } from '../src/lib/mailer';

test('falha ao inicializar transporte permite nova tentativa; SMTP não registra preview', async t => {
  const saved = { ...process.env };
  t.after(() => { process.env = saved; });
  for (const key of Object.keys(process.env)) if (key.startsWith('SMTP_')) delete process.env[key];
  process.env.NODE_ENV = 'test';
  t.mock.method(nodemailer, 'createTestAccount', async () => { throw new Error('offline'); });
  await assert.rejects(sendPasswordResetEmail('unit@example.com', 'https://demo.example.com'), /offline/);
  process.env.SMTP_HOST = 'unit.invalid';
  process.env.SMTP_FROM = 'DomusApp <unit@example.com>';
  process.env.FRONTEND_URL = 'https://demo.example.com';
  let delivered = false;
  t.mock.method(nodemailer, 'createTransport', (() => ({ sendMail: async () => { delivered = true; return {}; } })) as any);
  t.mock.method(nodemailer, 'getTestMessageUrl', () => false);
  await sendPasswordResetEmail('unit@example.com', 'https://demo.example.com');
  assert.equal(delivered, true);
});
