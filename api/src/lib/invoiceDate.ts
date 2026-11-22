/** Vencimentos são dias civis armazenados em UTC; o relógio é de Brasília. */
export function dueDayCutoff(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(`${day}T00:00:00.000Z`);
}
