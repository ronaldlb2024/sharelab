// public/js/lib/parsers/index.js
import fleuryParser  from './fleuryParser.js';
import dasaParser    from './dasaParser.js';
import genericParser from './genericParser.js';

// Detecta o laboratório analisando palavras-chave no texto.
export function detectParser(texto) {
  const t = texto.toLowerCase();
  if (t.includes('fleury')) return fleuryParser;
  if (t.includes('dasa') || t.includes("rede d'or") || t.includes('rede d’or')) return dasaParser;
  return genericParser;
}
