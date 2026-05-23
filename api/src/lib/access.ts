// Quem tem acesso ao painel administrativo do DomusApp.
//
// O painel é usado por administração, equipe operacional (porteiro, zelador) e
// pela síndica eleita — que é tecnicamente uma `MORADOR` mas com a flag
// `isSyndic = true`. Moradores comuns não acessam o painel; o consumo deles
// será via um app/canal separado no futuro.
export function hasPanelAccess(user: {
  role?: string | null;
  isSyndic?: boolean | null;
}): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'FUNCIONARIO') return true;
  if (user.role === 'MORADOR' && user.isSyndic === true) return true;
  return false;
}
