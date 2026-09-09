import rateLimit from 'express-rate-limit';

// Máximo de 10 tentativas de login por IP a cada 15 minutos.
// Sem isso, um atacante pode testar senhas indefinidamente contra /auth/login.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,   // expõe RateLimit-* (RFC)
  legacyHeaders: false,    // não expõe X-RateLimit-*
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  // Um login bem-sucedido não consome cota — a proteção é contra força bruta.
  skipSuccessfulRequests: true,
});

// Máximo de 5 solicitações de redefinição de senha por IP a cada 15 minutos.
// Sem isso, o endpoint vira um jeito fácil de floodar a caixa de entrada de
// alguém. Sem `skipSuccessfulRequests`: toda solicitação aqui responde 200
// (é assim que evitamos revelar se o e-mail existe), então pular sucesso
// desativaria o limite por completo.
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações. Tente novamente em 15 minutos.' },
});
