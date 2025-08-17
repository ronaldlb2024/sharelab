// public/js/lib/parse/evolutivo.js
import { NORMALIZE_MAP } from '../lib/parse/normalizers.js';
import { normalizeNumber } from './report.js';

const DATE_RE = /(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{1,2}:\d{2}))?/g;

export function parseEvolutivo(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let dates = [];
  for (const line of lines.slice(0, 10)) {
    const found = [...line.matchAll(DATE_RE)].map(m => (m[2] ? m[1] + ' ' + m[2] : m[1]));
    if (found.length >= 2) { dates = found; break; }
  }
  if (!dates.length) return { datas: [], series: {}, usedMostRecentOnly: true };

  const NUM = /[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?/g;
  const series = {};
  for (const line of lines) {
    let code = null, label = null;
    for (const [c, syns] of Object.entries(NORMALIZE_MAP)) {
      const hit = syns.find(s => new RegExp(`\\b${s}\\b`, 'i').test(line));
      if (hit) { code = c; label = hit; break; }
    }
    if (!code) continue;

    const nums = [...line.matchAll(NUM)].map(m => m[0]);
    if (nums.length < 2) continue;

    const values = nums.slice(-dates.length);
    const parsed = values.map(v => normalizeNumber(v));

    series[code] = dates.map((d, i) => ({
      data: toISODateSafe(d),
      valor: parsed[i] ?? null,
      unidade: inferUnit(line)
    }));
  }

  return { datas: dates.map(toISODateSafe), series, usedMostRecentOnly: false };
}

function toISODateSafe(d) {
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return d;
  let [_, dd, mm, yyyy, HH='00', MM='00'] = m;
  if (yyyy.length === 2) yyyy = '20' + yyyy;
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}`;
}

function inferUnit(line) {
  const UNIT = /(%|mg\/dL|g\/dL|U\/L|UI\/L|mmol\/L|mEq\/L|µ?g\/dL|ng\/L|ng\/mL|mmHg|(?:10\^3|10\^6)\/?µL|\/?µL|\/?mm³|mL\/min\/1\.73m²)/i;
  const m = line.match(UNIT);
  return m ? m[1] : null;
}
