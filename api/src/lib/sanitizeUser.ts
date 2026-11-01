// Remove campos que nunca devem sair da API: o hash da senha e o material do
// fluxo de recuperação de senha (RF-007). Centralizado aqui em vez de
// desestruturar campo por campo em cada Service, onde seria fácil esquecer
// resetToken/resetTokenExpiry ao adicionar um novo ponto que devolve usuário.
export function sanitizeUser<
  T extends { password: string; resetToken?: string | null; resetTokenExpiry?: Date | null },
>(user: T): Omit<T, 'password' | 'resetToken' | 'resetTokenExpiry'> {
  const { password, resetToken, resetTokenExpiry, ...safe } = user;
  return safe;
}
