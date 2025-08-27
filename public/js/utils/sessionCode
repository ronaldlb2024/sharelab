// Gera/valida códigos numéricos (4 dígitos)
export function newCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
export function isValidCode(code) {
  return /^\d{4}$/.test(String(code || '').trim());
}
