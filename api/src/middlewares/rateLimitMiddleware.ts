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

// RF-007 — o par forgot/reset também precisa de teto. Sem ele, /forgot-password
// vira ferramenta de spam contra a caixa de entrada de um morador, e
// /reset-password aceitaria tentativas ilimitadas de adivinhar um token.
// O limite é mais alto que o do login porque as duas rotas dividem a mesma cota.
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de recuperação. Tente novamente em 15 minutos.' },
});
