// js/lib/parse/report.js
import { NORMALIZE_MAP } from './normalizers.js';

const NUM = String.raw`[+-]?\d{1,3}(\.\d{3})*(,\d+)?|[+-]?\d+(\.\d+)?`;
const SEP = String.raw`(?:-|–|a|até)`;
const UNIT = String.raw`%|mg/dL|g/dL|U/L|UI/L|mmol/L|mEq/L|µ?g/dL|ng/L|ng/mL|mmHg|k?/?µL|10\^3/?µL|10\^6/?µL|mmol/L|mL/min/1\.73m²`;
const UNIT_RE = new RegExp(`^(${UNIT})$`, 'i');

export function normalizeNumber(str) {
  if (!str) return null;
  let s = String(str).trim().replace(/\s+/g, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) s = s.replace(',', '.');
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

function norm(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
}

export function parseRef(str) {
  if (!str) return null;
  const m = String(str).match(new RegExp(`(${NUM})\\s*${SEP}\\s*(${NUM})`, 'i'));
  if (!m) return null;
  const lo = normalizeNumber(m[1]); const hi = normalizeNumber(m[2]);
  if (lo == null || hi == null) return null;
  return { lo, hi, raw: m[0] };
}

export function parseValueUnit(line) {
  const re = new RegExp(`(${NUM})\\s*(${UNIT})?`, 'ig');
  let best = null;
  for (const m of line.matchAll(re)) {
    const value = normalizeNumber(m[1]); const unit = m[2] || null;
    if (value == null) continue;
    const score = unit ? 2 : 1;
    if (!best || score > best.score) best = { value, unit, score, raw: m[0] };
  }
  return best ? { value: best.value, unit: best.unit || null, raw: best.raw } : null;
}

function statusFromRef(value, ref) {
  if (value == null || !ref) return 'Indeterminado';
  if (value < ref.lo) return 'Baixo';
  if (value > ref.hi) return 'Alto';
  return 'Normal';
}

function matchParamOnLine(line){
  const L = norm(line);
  for (const [code, syns] of Object.entries(NORMALIZE_MAP)) {
    const h = syns.find(s => L.includes(norm(s)));
    if (h) return { code, label: h };
  }
  return null;
}

function applyLeukocyteRule(item) {
  if (item.parametro_norm !== 'leuco') return item;
  if (item.unit && /%/.test(item.unit)) item._penalty = 'percent_ignored';
  return item;
}

export function parseReport(text) {
  const lines = String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    const hit = matchParamOnLine(line);
    if (!hit) continue;
    const val = parseValueUnit(line);
    if (!val) continue;
    const ref = parseRef(line) || null;
    let unit = val.unit; if (unit && !UNIT_RE.test(unit)) unit = null;
    let item = {
      parametro_norm: hit.code,
      rotulo: hit.label,
      valor: val.value,
      unidade: unit,
      ref: ref ? `${ref.lo}–${ref.hi}` : null,
      _refObj: ref,
      status: statusFromRef(val.value, ref),
      confidence: ref ? 0.95 : 0.8,
      raw: line
    };
    item = applyLeukocyteRule(item);
    items.push(item);
  }
  const leucos = items.filter(i=>i.parametro_norm==='leuco');
  if (leucos.length>1){
    const abs = leucos.find(i=>i.unidade && /(\/µL|10\^3\/?µL)/i.test(i.unidade));
    if (abs){
      for (let i=items.length-1;i>=0;i--)
        if (items[i].parametro_norm==='leuco' && items[i]!==abs) items.splice(i,1);
    }
  }
  return { paciente:{nome:null,data_nascimento:null}, exame:{titulo:null,laboratorio:null,data:null}, itens:items, faltantes:[] };
}

export function parseReportLoose(text){
  const whole = String(text||''); const wholeN = norm(whole);
  const items = []; const seen = new Set();
  const NUM_ANY = /[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?/;
  const DATE = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;

  for (const [code, syns] of Object.entries(NORMALIZE_MAP)){
    if (seen.has(code)) continue;
    let found = null;
    for (const s of syns){
      const needle = norm(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      // >>> CORREÇÃO: usar \\d (duplo) dentro de string passada ao RegExp
      const rx = new RegExp(needle + '[^\\d]{0,40}(' + NUM_ANY.source + ')','i');
      const idx = wholeN.search(rx);
      if (idx>=0){
        const slice = whole.slice(Math.max(0, idx-10), idx+200);
        const nm = slice.match(NUM_ANY);
        if (nm && !DATE.test(nm[0])) { found = nm[0]; break; }
      }
    }
    if (found!=null){
      items.push({ parametro_norm: code, rotulo: syns[0], valor: normalizeNumber(found), unidade: null, ref: null, status: 'Indeterminado', confidence: 0.6 });
      seen.add(code);
    }
  }
  return { paciente:{nome:null,data_nascimento:null}, exame:{titulo:null,laboratorio:null,data:null}, itens:items, faltantes:[] };
}

function max(a,b){return a>b?a:b;}

const ORDEM = [
  'hb','ht','leuco','plaq','ure','cre','na','k','mg','cai',
  'ph(a)','po2(a)','pco2(a)','hco3(a)','be(a)','sato2(a)',
  'ph(v)','po2(v)','pco2(v)','hco3(v)','be(v)','sato2(v)',
  'lac','pcr','tni','rdw','neutro','seg','linf','mono','eos','baso','rni','ttpa_rel'
];

export function formatLinhaProfissional(items){
  const map = new Map(); for (const it of items) map.set(it.parametro_norm, it);
  const chunks = [];
  for (const code of ORDEM){
    const it = map.get(code); if (!it) continue;
    const v = it.valor!=null ? String(it.valor) : '—';
    const u = it.unidade ? ` ${it.unidade}` : '';
    chunks.push(`${code.toUpperCase()} ${v}${u}`);
  }
  for (const it of items) if (!ORDEM.includes(it.parametro_norm)){
    const v = it.valor!=null ? String(it.valor) : '—';
    const u = it.unidade ? ` ${it.unidade}` : '';
    chunks.push(`${it.parametro_norm.toUpperCase()} ${v}${u}`);
  }
  return chunks.join('; ');
}

export function formatListaPaciente(items){
  return items.map(it=>{
    const nome = it.rotulo || it.parametro_norm.toUpperCase();
    const v = it.valor!=null ? String(it.valor) : '—';
    const u = it.unidade ? ` ${it.unidade}` : '';
    const st = it.status || 'Indeterminado';
    return `${nome} — ${v}${u} — ${st}`;
  });
}
