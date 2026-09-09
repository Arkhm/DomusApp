// Mesmo algoritmo usado no front (web/src/components/luxury/formatters.ts).
// Duplicado aqui de propósito: o front pode ser contornado por quem chama a
// API diretamente (Postman, curl, o futuro app mobile), então o dígito
// verificador do CPF precisa ser conferido de novo no back-end.
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  // Sequências de dígito repetido (00000000000, 11111111111, …) passam no
  // cálculo do dígito verificador mas nunca são CPFs reais válidos.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (d1 !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return d2 === parseInt(cpf[10], 10);
}
