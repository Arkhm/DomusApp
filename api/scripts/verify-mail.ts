import 'dotenv/config';
import { verifyMailConnection } from '../src/lib/mailer';
verifyMailConnection().then(() => {
  console.log('Conexão e autenticação SMTP verificadas. Nenhuma mensagem enviada; entrega não comprovada.');
}).catch(() => {
  console.error('Falha na verificação SMTP. Confira configuração, credenciais, TLS, rede e IPs permitidos no provedor.');
  process.exitCode = 1;
});
