// Gera/valida códigos NUMÉRICOS. Padrão: 4 dígitos.
export function newCode(len = 4) {
  const L = Math.min(Math.max(len, 4), 6); // clamp 4..6
  const min = 10 ** (L - 1);
  const max = (10 ** L) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

export function isValidCode(code) {
  return /^\d{4,6}$/.test(String(code || '').trim());
}
