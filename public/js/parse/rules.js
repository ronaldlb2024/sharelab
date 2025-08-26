/* public/js/parse/rules.js */
self.RULES = (typeof RULES !== 'undefined') ? RULES : [];

// helpers
if (typeof parseNum === 'undefined') self.parseNum = s => Number(String(s ?? '').replace(/\./g,'').replace(',', '.'));
if (typeof fmt === 'undefined') self.fmt = n => (Math.round(Number(n)*100)/100).toString();
if (typeof normUnit === 'undefined') self.normUnit = u => String(u||'').replace(/m?Eq\/L/i,'mmol/L').replace(/mil\/mm3/i,'10^3/µL').replace(/u\/l/ig,'U/L');
if (typeof absToInt === 'undefined') self.absToInt = s => Math.round(parseNum(s));
if (typeof guessUnitByName === 'undefined') self.guessUnitByName = name => {
  const s = (name||'').toUpperCase();
  if (/S[ÓO]DIO|POT[ÁA]SSIO|MAGN[EÉ]SIO/.test(s)) return 'mmol/L';
  if (/GLICOSE|UREIA|CREATININA|PCR/.test(s)) return 'mg/dL';
  if (/HEMOGLOBINA/.test(s)) return 'g/dL';
  if (/HEMAT[ÓO]CRITO|RDW/.test(s)) return '%';
  if (/AST|ALT|GGT|FOSFATASE/.test(s)) return 'U/L';
  if (/LEUC[ÓO]CITOS|SEGMENTADOS|NEUTR|LINFO|MONO|EOS|BASO|PLAQUETAS/.test(s)) return '/µL';
  if (/C[ÁA]LCIO I[ÔO]NICO|HCO3|TCO2|BE|LAC/.test(s)) return 'mmol/L';
  return null;
};
if (typeof grabNearbyRef === 'undefined') self.grabNearbyRef = (lines, k) => {
  for (let t = Math.max(0,k-2); t <= Math.min(lines.length-1,k+2); t++) {
    const L = lines[t];
    let m = L.match(/\bDe\s*([0-9.,-]+)\s*(?:at[eé]|até)\s*([0-9.,-]+)\s*([^\s%]+)/i);
    if (m) return `${fmt(parseNum(m[1]))}–${fmt(parseNum(m[2]))} ${normUnit(m[3])}`;
    m = L.match(/\b(?:At[eé]|Até)\s*([0-9.,-]+)\s*([^\s%]+)/i);
    if (m) return `≤${fmt(parseNum(m[1]))} ${normUnit(m[2])}`;
    m = L.match(/\b(?:Inferior a|<)\s*([0-9.,-]+)\s*([^\s%]+)/i);
    if (m) return `<${fmt(parseNum(m[1]))} ${normUnit(m[2])}`;
  }
  return null;
};

/* Regra genérica (DASA/Fleury) — linhas do tipo "NOME ... RESULTADO ... REFERÊNCIA" */
RULES.push({
  lab: 'any',
  where: /(RESULTADO|INTERVALO DE REFER[ÊE]NCIA|VALORES DE REF)/i,
  parse(lines, i) {
    const out=[];
    for (let k=i;k<Math.min(lines.length,i+80);k++){
      const s = lines[k];
      const m = s.match(/^(.*?)\s+(?:RESULTADO|RES\.?)\s*[:\-]?\s*([<>]?\s*[0-9.,-]+)\s*([^\s%]+)?\s+(?:REF|REFER[ÊE]NCIA|VALORES DE REF.*)\s*[:\-]?\s*(.*)$/i);
      if(!m) continue;
      const raw=m[1].trim(); const param=normalizeName(raw); if(!param) continue;
      const vStr=m[2].replace(/\s+/g,''); const val=parseNum(vStr.replace(/^</,''));
      const unit=normUnit(m[3]||guessUnitByName(raw)||null);
      let ref=null, tail=m[4]||'';
      let r=tail.match(/\bDe\s*([0-9.,-]+)\s*(?:at[eé]|até)\s*([0-9.,-]+)\s*([^\s%]+)/i);
      if(r) ref=`${fmt(parseNum(r[1]))}–${fmt(parseNum(r[2]))} ${normUnit(r[3])}`;
      if(!ref){ r=tail.match(/\b(?:At[eé]|Até)\s*([0-9.,-]+)\s*([^\s%]+)/i); if(r) ref=`≤${fmt(parseNum(r[1]))} ${normUnit(r[2])}`; }
      if(!ref){ r=tail.match(/\b(?:Inferior a|<)\s*([0-9.,-]+)\s*([^\s%]+)/i); if(r) ref=`<${fmt(parseNum(r[1]))} ${normUnit(r[2])}`; }
      out.push({ parametro:param, rotulo:raw, valor:val, unidade:unit, ref });
    }
    return out.length ? out : null;
  }
});

/* Hemograma (absolutos) */
RULES.push({
  lab: 'any',
  where: /HEMOGRAMA/i,
  parse(lines, i) {
    const out=[];
    for (let k=i;k<Math.min(lines.length,i+120);k++){
      const s=lines[k];
      let m=s.match(/\bHem[áa]cias.*?:\s*([0-9.,]+)\s*(milh[õo]es\/mm3|10\^6\/µL)/i);
      if(m) out.push({ parametro:'HEM', rotulo:'Hemácias', valor:parseNum(m[1]), unidade:'10^6/µL', ref:null });
      m=s.match(/\bHemoglobina.*?:\s*([0-9.,]+)\s*g\/dL/i);
      if(m) out.push({ parametro:'Hb', rotulo:'Hemoglobina', valor:parseNum(m[1]), unidade:'g/dL', ref:grabNearbyRef(lines,k) });
      m=s.match(/\bHemat[óo]crito.*?:\s*([0-9.,]+)\s*%/i);
      if(m) out.push({ parametro:'Ht', rotulo:'Hematócrito', valor:parseNum(m[1]), unidade:'%', ref:grabNearbyRef(lines,k) });
      m=s.match(/\bRDW.*?:\s*([0-9.,]+)\s*%/i);
      if(m) out.push({ parametro:'RDW', rotulo:'RDW', valor:parseNum(m[1]), unidade:'%', ref:grabNearbyRef(lines,k) });
      m=s.match(/\bLeuc[óo]citos.*?:\s*([0-9.,]+)\s*\/mm3/i);
      if(m) out.push({ parametro:'Leuco', rotulo:'Leucócitos', valor:absToInt(m[1]), unidade:'/µL', ref:grabNearbyRef(lines,k) });
      const diff=[
        {rx:/\bNeutr[óo]filos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Neutro',lbl:'Neutrófilos'},
        {rx:/\bSegmentados.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Seg',lbl:'Segmentados'},
        {rx:/\bLinf[óo]citos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Linf',lbl:'Linfócitos'},
        {rx:/\bMon[óo]citos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Mono',lbl:'Monócitos'},
        {rx:/\bEosin[óo]filos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Eos',lbl:'Eosinófilos'},
        {rx:/\bBas[óo]filos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Baso',lbl:'Basófilos'}
      ];
      for(const d of diff){ const md=s.match(d.rx); if(md) out.push({ parametro:d.p, rotulo:d.lbl, valor:absToInt(md[1]), unidade:'/µL', ref:null }); }
      m=s.match(/\bPlaquetas.*?:\s*([0-9.,]+)\s*mil\/mm3/i);
      if(m) out.push({ parametro:'Plaq', rotulo:'Plaquetas', valor:absToInt(m[1])*1000, unidade:'/µL', ref:grabNearbyRef(lines,k) });
    }
    return out.length?out:null;
  }
});

/* Qualitativos / Hepatites básicos */
RULES.push({
  lab: 'any',
  where: /(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO|HBsAg|Anti-?HBs|Anti-?HBc|HBeAg|Anti-?HBe|S\/CO|ÍNDICE|INDICE)/i,
  parse(lines, i) {
    const out=[];
    function pushQual(name, val, ref){ out.push({ parametro:(normalizeName(name)||name), rotulo:name, valor:val, unidade:null, ref:ref||null, meta:{qualitativo:true} }); }
    for (let k=Math.max(0,i-6); k<Math.min(lines.length, i+20); k++){
      const s=lines[k];
      let m=s.match(/\b(HBsAg)\b.*?(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO|DETECTADO|N[ÃA]O DETECTADO)/i);
      if(m) pushQual('HBsAg', m[2].toUpperCase(), 'Não Reagente');
      m=s.match(/\b(Anti-?HBc(?:\s*total)?)\b.*?(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO)/i);
      if(m) pushQual('Anti-HBc', m[2].toUpperCase(), 'Não Reagente');
      m=s.match(/\b(Anti-?HBc\s*IgM)\b.*?(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO)/i);
      if(m) pushQual('Anti-HBc IgM', m[2].toUpperCase(), 'Não Reagente');
      m=s.match(/\b(HBeAg)\b.*?(REAGENTE|N[ÃA]O REAGENTE)/i);
      if(m) pushQual('HBeAg', m[2].toUpperCase(), 'Não Reagente');
      m=s.match(/\b(Anti-?HBe)\b.*?(REAGENTE|N[ÃA]O REAGENTE)/i);
      if(m) pushQual('Anti-HBe', m[2].toUpperCase(), 'Não Reagente');

      m=s.match(/\b(Anti-?HBs)\b.*?([0-9.,]+)\s*(m?UI\/mL|UI\/L|mIU\/mL)/i);
      if(m) out.push({ parametro:'Anti-HBs', rotulo:'Anti-HBs', valor:parseNum(m[2]), unidade:m[3].toUpperCase(), ref:'≥10 mUI/mL' });

      m=s.match(/\bS\/CO\s*[:\-]?\s*([0-9.,]+)\b/i);
      if(m) out.push({ parametro:'SCO', rotulo:'S/CO', valor:parseNum(m[1]), unidade:null, ref:'<1.0' });

      m=s.match(/\b(?:ÍNDICE|INDICE)\s*[:\-]?\s*([0-9.,]+)\b/i);
      if(m) out.push({ parametro:'IND', rotulo:'Índice', valor:parseNum(m[1]), unidade:null, ref:null });

      // genérica Positivo/Negativo
      m=s.match(/^(.*?)\s+(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO)\b/i);
      if(m){ pushQual(m[1].trim(), m[2].toUpperCase()); }
    }
    return out.length?out:null;
  }
});
