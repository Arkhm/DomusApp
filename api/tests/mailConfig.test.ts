import test from 'node:test';
import assert from 'node:assert/strict';
import { mailConfig } from '../src/lib/mailConfig';
const smtp = { SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'DomusApp <test@example.com>', FRONTEND_URL: 'https://demo.example.com', SMTP_USER: 'user', SMTP_PASS: 'secret' };
test('SMTP e URL de recuperação independem de CORS', () => {
  const config = mailConfig({ ...smtp, ALLOWED_ORIGIN: 'https://other.example.com' });
  assert.equal(config.frontendUrl, smtp.FRONTEND_URL);
  assert.equal(config.port, 587); assert.equal(config.secure, false); assert.equal(config.requireTLS, true);
  assert.equal(mailConfig({ ...smtp, SMTP_PORT: '465' }).secure, true);
});
test('configuração incompleta e TLS incompatível falham', () => {
  for (const patch of [{ SMTP_FROM: '' }, { FRONTEND_URL: '' }, { SMTP_PASS: '' }, { SMTP_PORT: 'oops' }, { SMTP_SECURE: 'yes' }, { SMTP_PORT: '465', SMTP_SECURE: 'false' }, { FRONTEND_URL: 'https://demo.example.com/?token=secret' }]) {
    assert.throws(() => mailConfig({ ...smtp, ...patch }));
  }
});
test('Ethereal apenas sem SMTP fora de produção; produção exige HTTPS', () => {
  assert.equal(mailConfig({}).host, undefined);
  assert.throws(() => mailConfig({ NODE_ENV: 'production' }));
  assert.throws(() => mailConfig({ ...smtp, NODE_ENV: 'production', FRONTEND_URL: 'http://demo.example.com' }));
});
