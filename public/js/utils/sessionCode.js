// public/js/utils/sessionCode.js
export function newCode() {
  // 4 dígitos, sem letras, evitando 0000/9999-like se quiser
  return String(Math.floor(1000 + Math.random() * 9000));
}
export function isValidCode(code) {
  return /^\d{4}$/.test(String(code || '').trim());
}