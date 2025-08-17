// public/js/lib/parse/report.js
import { NORMALIZE_MAP } from '../lib/parse/normalizers.js';

const NUM = String.raw`[+-]?\d{1,3}(\.\d{3})*(,\d+)?|[+-]?\d+(\.\d+)?`;
const SEP = String.raw`(?:-|–|a|até)`;
const UNIT = String.raw`%|mg/dL|g/dL|U/L|UI/L|mmol/L|mEq/L|µ?g/dL|ng/L|ng/mL|mmHg|k?/?µL|10\^3/?µL|10\^6/?µL|mmol/L|mL/min/1\.73m²`;
const UNIT_RE = new RegExp(`^(${UNIT})$`, 'i');

export function normalizeNumber(str) {
  if (!str) return null;
  let s = String(str).trim();
  s = s.replace(/\s+/g, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

// (rest of parser, value detection, leucocyte rule, formatLinhaProfissional, formatListaPaciente)
