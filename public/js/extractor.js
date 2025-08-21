// js/extractor.js
// MVP canivete: motor genérico + perfis por laboratório

const ANALYTE_SYNONYMS = {
  // bioquímica básica
  "UREIA": ["ureia","uréia","ure","uréia"],
  "CREATININA": ["creatinina","cre"],
  "SODIO": ["sódio","sodio","na"],
  "POTASSIO": ["potássio","potassio","k"],
  "MAGNESIO": ["magnésio","magnesio","mg"],
  "CALCIO_IONICO": ["cálcio iônico","calcio ionico","cálcio iônico:","calcio iônico","cai","cálcio iônico"],
  "CALCIO_TOTAL": ["cálcio","calcio","ca"],
  "FOSFORO": ["fósforo","fosforo","fos"],
  "GLICOSE": ["glicose","gli","glucose"],
  "PCR": ["proteína c reativa","pcr","proteina c reativa"],
  "GGT": ["gama gt","gamma gt","ggt","gama-glutamil transferase","gama‑glutamil transferase"],
  "TGO": ["tgo","ast","transaminase oxalacética","aspartato amino transferase"],
  "TGP": ["tgp","alt","transaminase pirúvica","alanina amino transferase"],
  "FA":  ["fosfatase alcalina","fal","fa"],
  "BILI_TOTAL": ["bilirrubina total","bil total"],
  "BILI_DIRETA": ["bilirrubina direta","bil direta"],
  "BILI_INDIRETA": ["bilirrubina indireta","bil indireta"],
  // hematologia
  "HEMACIAS": ["hemácias","hemacias","eritrocitos","eritrócitos","eritrócitos"],
  "HEMOGLOBINA": ["hemoglobina","hb"],
  "HEMATOCRITO": ["hematócrito","hematocrito","hct"],
  "RDW": ["rdw"],
  "LEUCOCITOS": ["leucócitos","leucocitos","wbc","leucócitos:"],
  "PLAQUETAS": ["plaquetas","plt","contagem de plaquetas"],
  "NEUTROFILOS_%": ["neutrófilos","neutrofilos","segmentados","neutrófilos:","segmentados:"],
  "LINFÓCITOS_%": ["linfócitos","linfocitos"],
  "MONÓCITOS_%": ["monócitos","monocitos"],
  "EOSINÓFILOS_%": ["eosinófilos","eosinofilos"],
  "BASÓFILOS_%": ["basófilos","basofilos"],
  // coagulação
  "TAP": ["tap","tempo de protrombina","atividade de protrombina"],
  "RNI": ["rni","inr","razão normatizada internacional"],
  "TTPA": ["ttpa","tempo de tromboplastina parcial ativado"],
  // cardio/enzimas
  "TROPONINA": ["troponina i de alta sensibilidade","hs-tni","troponina"],
  "NT_PROBNP": ["nt-probnp","pro-bnp","ntprobnp","nt-pro bnp"],
  "CPK": ["cpk","ck"],
  "LDH": ["ldh","desidrogenase láctica","desidrogenase lática","desidrogenase láctica - ldh"],
  // lipídios
  "COLESTEROL_TOTAL": ["colesterol total"],
  "HDL": ["hdl - colesterol","hdl colesterol","hdl"],
  "LDL_CALC": ["ldl - colesterol (calculado)","ldl calculado","ldl-c"],
  "VLDL": ["vldl - colesterol","vldl"],
  "TRIGLICERIDES": ["triglicérides","triglicerides","triglicerídeos"],
  // tireoide
  "TSH": ["tsh","hormônio tireoestimulante ultra sensível tsh","hormôniotireoestimulante ultra sensível tsh"],
  "T4L": ["t4 livre","tiroxina livre","t4l"],
  // HbA1c
  "HBA1C": ["hemoglobina glicada - hba1c","hba1c","hemoglobina glicada"],
  "GME": ["glicose média estimada","gme","eag"],
  // urinálise
  "EAS_LEUCOCITOS": ["leucócitos: urina","leucócitos (urina)","leucócitos /ml","leucócitos – urina"],
  "EAS_HEMACIAS": ["hemácias: urina","hemácias (urina)","hemácias /ml"],
  // gasometrias
  "GASO_PH": ["ph","ph: sangue arterial","ph: sangue venoso"],
  "GASO_PCO2": ["pco2","pco2: sangue arterial","pco2: sangue venoso"],
  "GASO_PO2": ["po2","po2: sangue arterial","po2: sangue venoso"],
  "GASO_HCO3": ["hco3","hco3:"],
  "GASO_BE": ["excesso de base","excesso de bases"],
  "GASO_SAT": ["saturação de o2","saturacao de o2","saturação de oxigênio"]
};

const UNIT_REGEX = /\b(%|mg\/dL|g\/dL|mmol\/L|µUI\/mL|u?i\/?l|ui\/l|u\/l|fL|pg|ng\/mL|µg\/dL|\/µL|10\^6\/µ ?L|mil\/mm³|mmHg)\b/i;

// detecta “perfil” (ajustes de parsing leves)
function detectProfile(text) {
  const t = text.toLowerCase();
  return {
    isDasa: t.includes("dasa") || t.includes("intervalo de referência") || t.includes("série vermelha"),
    hasResultadoBlocks: /(^|\n)\s*resultado\s*(\n|$)/i.test(text) && /(^|\n)\s*intervalo de referência/i.test(text),
    hasGasometria: /gasometria|sangue arterial|sangue venoso/i.test(text),
  };
}

// normalização de números pt-BR -> número JS
function parseNumberPt(str) {
  if (!str) return null;
  let s = String(str).trim()
    .replace(/\s/g, "")
    .replace(/−/g, "-")
    .replace(/,/g, "."); // vírgula decimal
  // remove milhar
  s = s.replace(/(?<=\d)\.(?=\d{3}\b)/g, "");
  // sinais tipo <0.012
  const sign = s.startsWith("<") ? "<" : s.startsWith(">") ? ">" : "";
  s = s.replace(/[<>]/g, "");
  const val = Number(s);
  return isFinite(val) ? { val, sign } : null;
}

// interpreta "Intervalo de Referência"
function parseRefInterval(refStr) {
  if (!refStr) return null;
  const s = refStr.toLowerCase().replace(/\s+/g," ").replace(/,/,".");
  // de X até Y
  let m = s.match(/de\s*([\-–]?\d+[\.,]?\d*)\s*(?:até|a)\s*([\-–]?\d+[\.,]?\d*)/i);
  if (m) return { type:"range", low: parseNumberPt(m[1]).val, high: parseNumberPt(m[2]).val };
  // até Y / inferior a Y
  m = s.match(/(?:até|inferior a)\s*([\-–]?\d+[\.,]?\d*)/i);
  if (m) return { type:"lte", high: parseNumberPt(m[1]).val };
  // superior a X
  m = s.match(/superior a\s*([\-–]?\d+[\.,]?\d*)/i);
  if (m) return { type:"gte", low: parseNumberPt(m[1]).val };
  return null;
}

// classifica valor vs referência
function flagVsRef(value, ref) {
  if (!value || !ref) return "indefinido";
  const v = value.val ?? value;
  if (ref.type === "range") {
    if (v < ref.low) return "baixo";
    if (v > ref.high) return "alto";
    return "normal";
  }
  if (ref.type === "lte") {
    return v <= ref.high ? "normal" : "alto";
  }
  if (ref.type === "gte") {
    return v >= ref.low ? "normal" : "baixo";
  }
  return "indefinido";
}

// mapeia um rótulo qualquer -> chave padronizada do dicionário
function canonicalKey(label) {
  const norm = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  for (const key of Object.keys(ANALYTE_SYNONYMS)) {
    for (const s of ANALYTE_SYNONYMS[key]) {
      const sn = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
      if (norm === sn || norm.startsWith(sn)) return key;
    }
  }
  return null;
}

// extrai pares Nome: Valor Unidade [ref]
function genericLineGrabber(text) {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\t/g," ").replace(/\s{2,}/g," ").trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    // formato: Nome:  4,7 mmol/L   (ref ...)
    const m = line.match(/^([A-Za-zÁ-ú0-9 \-\(\)\/\.\^]+?)[:：]?\s*([<>]?\d+(?:[\.,]\d+)?)\s*(%|mg\/dL|g\/dL|mmol\/L|µUI\/mL|UI\/L|U\/L|fL|pg|ng\/mL|µg\/dL|\/µL|10\^6\/µ ?L|mil\/mm³|mmHg)?(.*)$/i);
    if (!m) continue;
    const label = m[1].trim();
    const key = canonicalKey(label);
    if (!key) continue;

    const value = parseNumberPt(m[2]);
    const unit = (m[3] || "").replace(/\s+/g,"").toLowerCase();
    // tenta achar referência no resto da linha
    const refText = m[4] ? m[4].trim() : "";
    const ref = parseRefInterval(refText);
    const flag = flagVsRef(value, ref);
    out.push({ key, label, value, unit, refText, ref, flag, rawLine: line });
  }
  return out;
}

// extrator específico para blocos "RESULTADO / INTERVALO DE REFERÊNCIA"
function blockTableExtractor(text) {
  // pega blocos onde RESULTADO aparece “lado a lado” de INTERVALO…
  const out = [];
  const chunks = text.split(/(?=S[eé]rie|RESULTADO|Hemograma com Contagem de Plaquetas)/i);
  for (const chunk of chunks) {
    // linhas que têm “RESULTADO” à esquerda e “INTERVALO DE REFERÊNCIA” à direita
    const m = chunk.match(/([^\n]+)\n\s*RESULTADO[\s\S]{0,80}?INTERVALO DE REFER[ÊE]NCIA([\s\S]+?)(?=\n\s*(?:Fontes:|Assinado|Respons[aá]vel|$))/i);
    if (!m) continue;
    // varre linha a linha depois dos títulos
    const lines = m[2].split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    for (let i=0;i<lines.length;i+=2) {
      const name = (lines[i]||"").replace(/\s{2,}/g," ").trim();
      const next = (lines[i+1]||"").trim();
      if (!name) continue;

      // name pode ser: "Potássio" e a próxima linha "4,7 mmol/L" e abaixo "3,5 a 5,1 mmol/L"
      // tenta capturar valor/unidade na “linha seguinte”
      const vu = next.match(/([<>]?\d+(?:[\.,]\d+)?)\s*(%|mg\/dL|g\/dL|mmol\/L|µUI\/mL|UI\/L|U\/L|fL|pg|ng\/mL|µg\/dL|\/µL|10\^6\/µ ?L|mmHg)?/i);
      if (!vu) continue;
      const key = canonicalKey(name);
      if (!key) continue;

      const value = parseNumberPt(vu[1]);
      const unit = (vu[2]||"").toLowerCase();
      // procura referência em até 3 linhas seguintes
      const refWindow = lines.slice(i+2, i+6).join(" ");
      const ref = parseRefInterval(refWindow);
      const flag = flagVsRef(value, ref);
      out.push({ key, label: name, value, unit, refText: refWindow, ref, flag, rawBlock: lines.slice(i,i+6).join(" | ") });
    }
  }
  return out;
}

// extrator “gasometrias”: pH/pCO2/pO2/HCO3/Sat/BE
function gasoExtractor(text) {
  const out = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const GASO_KEYS = [
    ["GASO_PH", /(^|\b)pH\b/i],
    ["GASO_PCO2", /\bpCO2\b/i],
    ["GASO_PO2", /\bpO2\b/i],
    ["GASO_HCO3", /\bHCO3\b/i],
    ["GASO_BE", /Excesso de base/i],
    ["GASO_SAT", /Satura[çc][aã]o de O2/i],
  ];
  for (const line of lines) {
    for (const [key, rx] of GASO_KEYS) {
      if (rx.test(line)) {
        const m = line.match(/([\-–]?\d+(?:[\.,]\d+)?)/);
        if (!m) continue;
        const value = parseNumberPt(m[1]);
        // unidades típicas
        let unit = "";
        if (/mmHg/i.test(line)) unit = "mmHg";
        else if (/\bmmol\/L\b/i.test(line)) unit = "mmol/L";
        else if (/%/.test(line)) unit = "%";
        out.push({ key, label: line.split(":")[0].trim(), value, unit, refText:"", ref:null, flag:"indefinido", rawLine: line });
      }
    }
  }
  return out;
}

// mescla resultados, preferindo blocos específicos e evitando duplicatas
function mergeResults(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const it of list) {
      const k = it.key + ":" + (it.unit||"");
      if (!map.has(k)) map.set(k, it);
    }
  }
  return Array.from(map.values());
}

export function extractFromText(rawText) {
  // 1) normalização básica
  let text = rawText
    .replace(/\r/g,"")
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\u00A0/g, " ")
    .replace(/[–—]/g,"-");

  const profile = detectProfile(text);

  // 2) executa coletores
  const r1 = genericLineGrabber(text);          // linhas “Nome: 12,3 unidade …”
  const r2 = profile.hasResultadoBlocks ? blockTableExtractor(text) : [];
  const r3 = profile.hasGasometria ? gasoExtractor(text) : [];

  let analytes = mergeResults(r1, r2, r3);

  // 3) ordenação amigável
  const orderHint = ["HBA1C","GME","GLICOSE","UREIA","CREATININA","SODIO","POTASSIO","MAGNESIO","CALCIO_IONICO","FOSFORO",
                     "PCR","TGO","TGP","GGT","FA","BILI_TOTAL","BILI_DIRETA","BILI_INDIRETA",
                     "HEMACIAS","HEMOGLOBINA","HEMATOCRITO","RDW","LEUCOCITOS","PLAQUETAS",
                     "NEUTROFILOS_%","LINFÓCITOS_%","MONÓCITOS_%","EOSINÓFILOS_%","BASÓFILOS_%",
                     "TAP","RNI","TTPA","TROPONINA","NT_PROBNP","CPK","LDH",
                     "COLESTEROL_TOTAL","HDL","LDL_CALC","VLDL","TRIGLICERIDES",
                     "TSH","T4L",
                     "GASO_PH","GASO_PCO2","GASO_PO2","GASO_HCO3","GASO_BE","GASO_SAT"];
  const pos = k => {
    const i = orderHint.indexOf(k);
    return i < 0 ? 999 : i;
  };
  analytes.sort((a,b)=> pos(a.key)-pos(b.key));

  // 4) gera texto curtinho pra compartilhar
  const lines = analytes.map(it => {
    const v = it.value?.sign ? `${it.value.sign}${it.value.val}` : (it.value?.val ?? "");
    const unit = it.unit ? ` ${it.unit.toUpperCase()}` : "";
    const flag = it.flag && it.flag !== "indefinido" ? ` [${it.flag}]` : "";
    const nice = it.label.replace(/\s{2,}/g," ").trim();
    return `• ${nice}: ${v}${unit}${flag}`;
  });

  return {
    meta: { profile, extractedCount: analytes.length },
    analytes,
    shareText: lines.join("\n")
  };
}
