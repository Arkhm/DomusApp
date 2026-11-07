const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(value: string | number): string {
  const amount = typeof value === 'string' && !value.trim() ? NaN : Number(value);
  return Number.isFinite(amount) ? currency.format(amount) : 'Valor indisponível';
}
