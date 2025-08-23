// public/js/lib/parse/index.js
import fleuryParser  from './fleuryParser.js';
import dasaParser    from './dasaParser.js';
import genericParser from './genericParser.js';

// Normaliza acentos e padroniza para comparação
function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')                 // decompõe acentos
    .replace(/\p{Diacritic}/gu, '')   // remove acentos
    .replace(/\s+/g, ' ')             // colapsa espaços
    .trim();
}

// Conjuntos de padrões para cada grupo/lab (em texto normalizado)
const DASA_PATTERNS = [
  /(?:\bdasa\b)/,
  /\brede d[ ']?or\b/,               // rede d'or / rede d or / rede dor
  /\bsao luiz\b/,                    // São Luiz
  /\bdelboni\b/,
  /\blavoisier\b/,
  /\balta\b/,
  /\bsalomao(?:\s+zoppi)?\b/,        // salomao / salomao zoppi
  /\bsz\b/,                          // SZ (Salomão Zoppi)
  /\bexame\b/,                       // marca "exame"
  /\bcdb\b/,
  /\bcura\b/,
  /\bbronstein\b/,
];

const FLEURY_PATTERNS = [
  /\bfleury\b/,
  /\bgrupo\s+fleury\b/,
  /\ba\+\b/,                         // A+ Medicina Diagnóstica
  /\ba\+\s*medicina\b/,
];

export function detectParser(texto) {
  const t = norm(texto);

  // Fleury primeiro (menos marcas, evita falso-positivo com "exame")
  if (FLEURY_PATTERNS.some(re => re.test(t))) {
    return fleuryParser;
  }

  // DASA e marcas relacionadas
  if (DASA_PATTERNS.some(re => re.test(t))) {
    return dasaParser;
  }

  // Fallback
  return genericParser;
}

// (Opcional) se quiser saber quem foi detectado sem mudar a API:
export function detectParserName(texto) {
  const t = norm(texto);
  if (FLEURY_PATTERNS.some(re => re.test(t))) return 'fleury';
  if (DASA_PATTERNS.some(re => re.test(t)))   return 'dasa';
  return 'generic';
}
