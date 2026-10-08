import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('ERRO: JWT_SECRET não está definido no arquivo .env');
}

// Access e refresh precisam ser assinados com segredos diferentes: se fossem o
// mesmo, um access token roubado poderia ser apresentado ao /auth/refresh (e
// vice-versa). Quando JWT_REFRESH_SECRET não está no .env, derivamos um valor
// distinto do JWT_SECRET — some do caminho o risco de esquecer a variável e
// acabar com os dois tokens intercambiáveis.
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}::refresh`;

// 15 minutos: o access token viaja em toda requisição, então vale pouco se
// vazar. Quem sustenta a sessão longa é o refresh token.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// 7 dias sem precisar digitar a senha de novo.
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AccessTokenPayload {
  id: string;
  role: string;
  isSyndic?: boolean;
}

// `type` é conferido na verificação. É o cinto de segurança caso um dia os dois
// segredos sejam igualados por engano na configuração.
interface RefreshTokenClaims {
  id: string;
  type: 'refresh';
  iat: number;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });

export const signRefreshToken = (userId: string): string =>
  jwt.sign({ id: userId, type: 'refresh' }, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });

// Lança se a assinatura não bater ou o prazo tiver vencido — quem chama trata.
export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

export const verifyRefreshToken = (token: string): RefreshTokenClaims => {
  const decoded = jwt.verify(token, REFRESH_SECRET) as RefreshTokenClaims;
  if (decoded.type !== 'refresh') {
    throw new Error('Token não é um refresh token.');
  }
  return decoded;
};
