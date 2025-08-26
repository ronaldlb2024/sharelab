// js/extractor.js
// MVP canivete: motor genérico + heurísticas por laboratório

// ---------- util de normalização ----------
function normTxt(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[‐-–—]/g, '-')                         // hifens variados
    .replace(/\u00A0/g, ' ')                         // nbsp
    .replace(/\s+/g, ' ')                            // colapsa espaços
    .trim();
}
function normKey(s) { return normTxt(s).toLowerCase(); }

// ---------- sinônimos ----------
const ANALYTE_SYNONYMS = {
  // bioquímica básica
  UREIA: ['ureia','ure','ureia total'],
  CREATININA: ['creatinina','cre'],
  SODIO: ['sodio','na'],
  POTASSIO: ['potassio','k'],
  MAGNESIO: ['magnesio','mg'],
  CALCIO_IONICO: ['calcio ionico','cai','calcio ionizado'],
  CALCIO_TOTAL: ['calcio','ca'],
  FOSFORO: ['fosforo','fosforo inorganico','fos'],
  GLICOSE: ['glicose','glucose','gli'],
  PCR: ['proteina c reativa','pcr'],
  GGT: ['gama gt','gamma gt','ggt','gama-glutamil transferase','gama-glutamil-transferase'],
  TGO: ['tgo','ast','aspartato amino transferase','aspartato aminotransferase'],
  TGP: ['tgp','alt','alanina amino transferase','alanina aminotransferase'],
  FA:  ['fosfatase alcalina','fal','fa'],
  BILI_TOTAL: ['bilirrubina total','bil total'],
  BILI_DIRETA: ['bilirrubina direta','bil direta'],
  BILI_INDIRETA: ['bilirrubina indireta','bil indireta'],
  // hematologia
  HEMACIAS: ['hemacias','eritrocitos','eritrocitos (rbc)','rbc'],
  HEMOGLOBINA: ['hemoglobina','hb'],
  HEMATOCRITO: ['hematocrito','hct','ht'],
  RDW: ['rdw'],
  LEUCOCITOS: ['leucocitos','wbc','leucocitos totais'],
  PLAQUETAS: ['plaquetas','plt','contagem de plaquetas'],
  NEUTROFILOS_ABS: ['neutrofilos absolutos','neutrofilos (/mm3)','neutrofilos /mm3'],
  NEUTROFILOS_%: ['neutrofilos','segmentados','neutrofilos (%)','segmentados (%)'],
  LINFÓCITOS_%: ['linfocitos','linfocitos (%)'],
  MONÓCITOS_%: ['monocitos','monocitos (%)'],
  EOSINÓFILOS_%: ['eosinofilos','eosinofilos (%)'],
  BASÓFILOS_%: ['basofilos','basofilos (%)'],
  // coagulação
  TAP: ['tap','tempo de protrombina','atividade de protrombina'],
  RNI: ['rni','inr','razao normatizada internacional'],
  TTPA: ['ttpa','tempo de tromboplastina parcial ativado'],
  // cardio/enzimas
  TROPONINA: ['troponina','troponina i de alta sensibilidade','hs-tni'],
  NT_PROBNP: ['nt-probnp','pro-bnp','ntprobnp','nt-pro bnp'],
  CPK: ['cpk','ck','ck total'],
  LDH: ['ldh','desidrogenase latica','desidrogenase lactica'],
  // lipídios
  COLESTEROL_TOTAL: ['colesterol total'],
  HDL: ['hdl colesterol','hdl'],
  LDL_CALC: ['ldl calculado','ldl-c','ldl - colesterol (calculado)'],
  VLDL: ['vldl colesterol','vldl'],
  TRIGLICERIDES: ['triglicerides','triglicerideos','triglicerídeos','triglicerides'],
  // tireoide
  TSH: ['tsh','hormonio tireoestimulante ultrasensivel','hormonio tireoestimulante ultra sensivel tsh'],
  T4L: ['t4 livre','tiroxina livre','t4l'],
  // HbA1c
  HBA1C: ['hemoglobina glicada','hba1c','hemoglobina glicada - hba1c'],
  GME: ['glicose media estimada','gme','eag'],
  // urinalise (apenas rótulos frequentes)
  EAS_LEUCOCITOS: ['leucocitos urina','leucocitos (urina)','leucocitos /ml urina'],
  EAS_HEMACIAS: ['hemacias urina','hemacias (urina)','hemacias /ml urina'],
  // gasometrias
  GASO_PH: ['ph', 'ph sangue arterial', 'ph sangue venoso'],
  GASO_PCO2: ['pco2', 'pco2 sangue arterial', 'pco2 sangue venoso'],
  GASO_PO2: ['po2', 'po2 sangue arterial', 'po2 sangue venoso'],
  GASO_HCO3: ['hco3'],
  GASO_BE: ['excesso de base','excesso de bases','base excess'],
  GASO_SAT: ['saturacao de o2','saturacao de oxigenio','saturacao de o2 (%)']
};

// pré-normaliza o dicionário
const SYN = {};
for (const k of Object.keys(ANALYTE_SYNONYMS)) {
  SYN[k] = ANALYTE_SYNONYMS[k].map(normKey);
}

// unidades (centralizado)
const UNIT_REGEX = /\b(%|mg\/dL|mg\/L|g\/dL|mmol\/L|mEq\/L|µ?IU\/mL|mIU\/mL|UI\/mL|UI\/L|U\/L|fL|pg|ng\/mL|µg\/dL|\/µL|10\^6\/µ ?L|10\^3\/µL|mil\/mm³|mmHg)\b/i;

// ---------- perfil do laudo ----------
function detectProfile(text) {
  const t = text.toLowerCase();
  return {
    isDasa: t.includes('dasa') || t.includes('intervalo de refer') || t.includes('serie vermelha'),
    hasResultadoBlocks: /(^|\n)\s*resultado\s*(\n|$)/i.test(text) && /(^|\n)\s*intervalo de refer/i.test(text),
    hasGasometria: /gasometria|sangue arterial|sangue venoso|po2|pco2|hco3|saturacao de o2/i.test(t),
  };
}

// ---------- números pt-BR ----------
function parseNumberPt(str) {
  if (!str) return null;
  let s = String(str).trim();
  const sign = s.startsWith('<') ? '<' : s.startsWith('>') ? '>' : '';
  s = s.replace(/[<>]/g, '');

  // remove espaços e não numéricos exceto . , - +
  s = s.replace(/[^\d.,\-+]/g, '');

  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');

  if (hasComma && hasDot) {
    // assume . como milhar e , como decimal (pt-BR típico)
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } // só ponto => OK

  // remove separadores de milhar remanescentes (ex.: 1.234 -> 1234)
  s = s.replace(/(?<=\d)\.(?=\d{3}\b)/g, '');

  const val = Number(s);
  return Number.isFinite(val) ? { val, sign } : null;
}

// ---------- referência ----------
function parseRefInterval(refStr) {
  if (!refStr) return null;
  const s = normTxt(refStr).toLowerCase()
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=');

  // de X a Y
  let m = s.match(/(?:de\s*)?([-+]?\d+(?:[.,]\d+)?)\s*a\s*([-+]?\d+(?:[.,]\d+)?)/i);
  if (m) {
    const a = parseNumberPt(m[1]); const b = parseNumberPt(m[2]);
    if (a && b) {
      const low = Math.min(a.val, b.val), high = Math.max(a.val, b.val);
      return { type: 'range', low, high };
    }
  }
  // <= Y  |  < Y  |  inferior a Y  |  ate Y
  m = s.match(/^(?:<=|<|inferior a|ate)\s*([-+]?\d+(?:[.,]\d+)?)/i);
  if (m) { const y = parseNumberPt(m[1]); if (y) return { type:'lte', high: y.val }; }
  // >= X  |  > X  |  superior a X
  m = s.match(/^(?:>=|>|superior a)\s*([-+]?\d+(?:[.,]\d+)?)/i);
  if (m) { const x = parseNumberPt(m[1]); if (x) return { type:'gte', low: x.val }; }

  return null;
}

function flagVsRef(value, ref) {
  if (!value || !ref) return 'indefinido';
  const v = value.val ?? value;

  // Respeita comparador do valor
  if (value.sign === '<') {
    if (ref.type === 'gte' && ref.low != null) return v < ref.low ? 'baixo' : 'normal';
    if (ref.type === 'lte' && ref.high != null) return v <= ref.high ? 'normal' : 'alto';
    if (ref.type === 'range' && ref.low != null) return v < ref.low ? 'baixo' : 'normal';
  }
  if (value.sign === '>') {
    if (ref.type === 'gte' && ref.low != null) return v >= ref.low ? 'normal' : 'baixo';
    if (ref.type === 'lte' && ref.high != null) return v > ref.high ? 'alto' : 'normal';
    if (ref.type === 'range' && ref.high != null) return v > ref.high ? 'alto' : 'normal';
  }

  if (ref.type === 'range') {
    if (v < ref.low) return 'baixo';
    if (v > ref.high) return 'alto';
    return 'normal';
  }
  if (ref.type === 'lte')  return (ref.high != null && v > ref.high) ? 'alto' : 'normal';
  if (ref.type === 'gte')  return (ref.low  != null && v < ref.low)  ? 'baixo' : 'normal';
  return 'indefinido';
}

// ---------- chave canônica ----------
function canonicalKey(label) {
  const n = normKey(label);
  for (const key of Object.keys(SYN)) {
    for (const s of SYN[key]) {
      if (n === s || n.startsWith(s + ' ') || n.endsWith(' ' + s)) return key;
      // tolera "Potassio (Soro)" etc.
      if (n.includes(s) && s.length >= 3) return key;
    }
  }
  return null;
}

// ---------- coletores ----------
function genericLineGrabber(text) {
  const lines = text.split(/\r?\n/).map(l => normTxt(l)).filter(Boolean);
  const out = [];
  for (const line of lines) {
    // Nome:  4,7 mmol/L   (ref ...)
    const m = line.match(
      new RegExp(
        String.raw`^([A-Za-z0-9 ()/\.\^°%+-]+?)[:：]?\s*([<>]?\s*\d+(?:[.,]\d+)?)\s*(${UNIT_REGEX.source})?(.*)$`,
        'i'
      )
    );
    if (!m) continue;

    const label = m[1].trim();
    const key = canonicalKey(label);
    if (!key) continue;

    const value = parseNumberPt(m[2]);
    let unit = (m[3] || '').replace(/\s+/g,'');
    if (unit) unit = unit.toUpperCase();
    const refText = (m[4] || '').trim();
    const ref = parseRefInterval(refText);
    const flag = flagVsRef(value, ref);

    out.push({ key, label, value, unit, refText, ref, flag, rawLine: line });
  }
  return out;
}

function blockTableExtractor(text) {
  const out = [];
  // separa por cabeçalhos frequentes sem perder contexto
  const chunks = text.split(/(?=\n\s*(?:RESULTADO|S[eé]rie|Hemograma|Bioqu[ií]mica))/i);
  for (const chunk of chunks) {
    // detecta “RESULTADO” e “INTERVALO DE REFERÊNCIA” proximos no bloco
    if (!/RESULTADO/i.test(chunk) || !/INTERVALO DE REFER/i.test(chunk)) continue;

    const lines = chunk.split(/\r?\n/).map(s => normTxt(s)).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const name = lines[i];
      // valor/unidade tipicamente na linha seguinte
      const next = lines[i+1] || '';
      const vu = next.match(new RegExp(String.raw`([<>]?\s*\d+(?:[.,]\d+)?)\s*(${UNIT_REGEX.source})?`, 'i'));
      if (!vu) continue;

      const key = canonicalKey(name);
      if (!key) continue;

      const value = parseNumberPt(vu[1]);
      let unit = (vu[2] || '').toUpperCase();

      // referência em até 3 linhas seguintes
      const refWindow = lines.slice(i+2, i+6).join(' ');
      const ref = parseRefInterval(refWindow);
      const flag = flagVsRef(value, ref);

      out.push({
        key, label: name, value, unit,
        refText: refWindow, ref, flag,
        rawBlock: lines.slice(i, i+6).join(' | ')
      });
    }
  }
  return out;
}

function gasoExtractor(text) {
  const out = [];
  const lines = text.split(/\r?\n/).map(l => normTxt(l)).filter(Boolean);
  const GASO_KEYS = [
    ['GASO_PH',   /(^|\b)pH\b/i],
    ['GASO_PCO2', /\bpCO2\b/i],
    ['GASO_PO2',  /\bpO2\b/i],
    ['GASO_HCO3', /\bHCO3\b/i],
    ['GASO_BE',   /\b(Excesso de base|Base excess|BE)\b/i],
    ['GASO_SAT',  /\bSaturacao de O2\b/i],
  ];
  for (const line of lines) {
    for (const [key, rx] of GASO_KEYS) {
      if (!rx.test(line)) continue;
      const m = line.match(/([<>]?\s*[-+]?\d+(?:[.,]\d+)?)/);
      if (!m) continue;

      const value = parseNumberPt(m[1]);
      let unit = '';
      if (/mmHg/i.test(line)) unit = 'mmHg';
      else if (/\bmmol\/L\b/i.test(line)) unit = 'mmol/L';
      else if (/%/.test(line)) unit = '%';

      out.push({ key, label: line.split(':')[0].trim(), value, unit, refText:'', ref:null, flag:'indefinido', rawLine: line });
    }
  }
  return out;
}

// mescla resultados, preferindo itens com referência (quando há conflito)
function mergeResults(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const it of list) {
      const k = it.key + ':' + (it.unit || '');
      if (!map.has(k)) {
        map.set(k, it);
      } else {
        const old = map.get(k);
        // prefere quem tem ref (ou flag != indefinido)
        const score = (x) => (x.ref ? 2 : 0) + (x.flag && x.flag !== 'indefinido' ? 1 : 0);
        if (score(it) > score(old)) map.set(k, it);
      }
    }
  }
  return Array.from(map.values());
}

// ---------- API ----------
export function extractFromText(rawText) {
  // 1) normalização grosseira
  let text = String(rawText || '')
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[–—]/g, '-');

  const profile = detectProfile(text);

  // 2) coletores
  const r1 = genericLineGrabber(text);                         // Nome: valor unidade
  const r2 = profile.hasResultadoBlocks ? blockTableExtractor(text) : [];
  const r3 = profile.hasGasometria ? gasoExtractor(text) : [];

  let analytes = mergeResults(r1, r2, r3);

  // 3) ordenação clínica amigável
  const orderHint = [
    'HBA1C','GME','GLICOSE','UREIA','CREATININA','SODIO','POTASSIO','MAGNESIO','CALCIO_IONICO','FOSFORO',
    'PCR','TGO','TGP','GGT','FA','BILI_TOTAL','BILI_DIRETA','BILI_INDIRETA',
    'HEMACIAS','HEMOGLOBINA','HEMATOCRITO','RDW','LEUCOCITOS','PLAQUETAS',
    'NEUTROFILOS_ABS','NEUTROFILOS_%','LINFÓCITOS_%','MONÓCITOS_%','EOSINÓFILOS_%','BASÓFILOS_%',
    'TAP','RNI','TTPA','TROPONINA','NT_PROBNP','CPK','LDH',
    'COLESTEROL_TOTAL','HDL','LDL_CALC','VLDL','TRIGLICERIDES',
    'TSH','T4L',
    'GASO_PH','GASO_PCO2','GASO_PO2','GASO_HCO3','GASO_BE','GASO_SAT'
  ];
  const pos = k => { const i = orderHint.indexOf(k); return i < 0 ? 999 : i; };
  analytes.sort((a,b)=> pos(a.key) - pos(b.key));

  // 4) saída curtinha de compartilhamento
  const lines = analytes.map(it => {
    const v = it.value?.sign ? `${it.value.sign}${it.value.val}` : (it.value?.val ?? '');
    const unit = it.unit ? ` ${it.unit.toUpperCase()}` : '';
    const flag = it.flag && it.flag !== 'indefinido' ? ` [${it.flag}]` : '';
    const nice = normTxt(it.label);
    return `• ${nice}: ${v}${unit}${flag}`;
  });

  return {
    meta: { profile, extractedCount: analytes.length },
    analytes,
    shareText: lines.join('\n')
  };
}
