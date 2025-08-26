/* public/js/parse/rules.js
   - Helpers mais seguros: parseNum lida com ponto/virgula e milhares.
   - normUnit não “converte” mEq/L para mmol/L (mantém unidade original).
   - Regras genéricas para DASA/Fleury e hemograma + qualitativos (MVP).
*/
(function(){
  self.RULES = (typeof RULES !== 'undefined') ? RULES : [];

  // -------- Helpers seguros --------
  if (typeof parseNum === 'undefined') {
    self.parseNum = (raw) => {
      const s0 = String(raw ?? '').trim();
      if (!s0) return NaN;
      // remove espaços e caracteres não numéricos (mantendo dígitos, . , e sinal)
      let s = s0.replace(/[^\d,.\-+]/g,'');
      const hasComma = s.includes(',');
      const hasDot   = s.includes('.');
      if (hasComma && hasDot) {
        // padrão pt-BR mais comum: . como milhar, , como decimal
        s = s.replace(/\./g,'').replace(',', '.');
      } else if (hasComma) {
        s = s.replace(',', '.');
      } else {
        // só ponto -> já é decimal
      }
      const v = Number(s);
      return Number.isFinite(v) ? v : NaN;
    };
  }

  if (typeof fmt === 'undefined') {
    self.fmt = n => {
      const x = Number(n);
      if (!Number.isFinite(x)) return String(n);
      const s = (Math.round(x * 100) / 100).toFixed(2);
      return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    };
  }

  if (typeof normUnit === 'undefined') {
    self.normUnit = u => {
      const s = String(u||'').trim();
      if (!s) return null;
      // padronizações leves (sem conversão de grandeza)
      return s
        .replace(/\bu\/l\b/ig,'U/L')
        .replace(/mm3\b/ig,'mm³')
        .replace(/mil\/mm3/ig,'10^3/mm³')  // indicativo textual; regra abaixo converte p/ /µL quando aplicável
        .replace(/\s+/g,' ');
    };
  }

  if (typeof absToInt === 'undefined') {
    self.absToInt = s => {
      const n = parseNum(s);
      return Number.isFinite(n) ? Math.round(n) : NaN;
    };
  }

  if (typeof guessUnitByName === 'undefined') {
    self.guessUnitByName = name => {
      const S = (name||'').toUpperCase();
      if (/S[ÓO]DIO|POT[ÁA]SSIO|MAGN[EÉ]SIO/.test(S)) return 'mmol/L';
      if (/GLICOSE|UREIA|CREATININA|PCR/.test(S)) return 'mg/dL';
      if (/HEMOGLOBINA/.test(S)) return 'g/dL';
      if (/HEMAT[ÓO]CRITO|RDW/.test(S)) return '%';
      if (/(AST|ALT|GGT|FOSFATASE)/.test(S)) return 'U/L';
      if (/LEUC[ÓO]CITOS|SEGMENTADOS|NEUTR|LINFO|MONO|EOS|BASO|PLAQUETAS/.test(S)) return '/µL';
      if (/C[ÁA]LCIO I[ÔO]NICO|HCO3|TCO2|BE|LAC/.test(S)) return 'mmol/L';
      return null;
    };
  }

  if (typeof grabNearbyRef === 'undefined') {
    self.grabNearbyRef = (lines, k) => {
      for (let t = Math.max(0,k-2); t <= Math.min(lines.length-1,k+2); t++) {
        const L = lines[t];
        let m = L.match(/\bDe\s*([0-9.,-]+)\s*(?:at[eé]|até)\s*([0-9.,-]+)\s*([^\s%]+)/i);
        if (m) return `${fmt(parseNum(m[1]))}–${fmt(parseNum(m[2]))} ${normUnit(m[3])}`;
        m = L.match(/\b(?:At[eé]|Até)\s*([0-9.,-]+)\s*([^\s%]+)/i);
        if (m) return `≤${fmt(parseNum(m[1]))} ${normUnit(m[2])}`;
        m = L.match(/\b(?:Inferior a|<)\s*([0-9.,-]+)\s*([^\s%]+)/i);
        if (m) return `<${fmt(parseNum(m[1]))} ${normUnit(m[2])}`;
        m = L.match(/\b(?:Superior a|>)\s*([0-9.,-]+)\s*([^\s%]+)/i);
        if (m) return `≥${fmt(parseNum(m[1]))} ${normUnit(m[2])}`;
      }
      return null;
    };
  }

  // -------- Regras --------

  /* Regra genérica (DASA/Fleury) — "NOME ... RESULTADO ... REFERÊNCIA" na mesma linha */
  self.RULES.push({
    lab: 'any',
    where: /(RESULTADO|INTERVALO DE REFER[ÊE]NCIA|VALORES? DE REF)/i,
    parse(lines, i) {
      const out=[];
      for (let k=i;k<Math.min(lines.length,i+80);k++){
        const s = lines[k];

        // Nome   RESULTADO:  1,23 mg/dL   VALORES DE REF: 0,50 – 1,20 mg/dL
        const m = s.match(/^(.*?)\s+(?:RESULTADO|RES\.?)\s*[:\-]?\s*([<>]?\s*[0-9.,-]+)\s*([^\s%]+)?\s+(?:REF|REFER[ÊE]NCIA|VALORES? DE REF.*)\s*[:\-]?\s*(.*)$/i);
        if(!m) continue;

        const rawName = m[1].trim();
        const param   = (typeof normalizeName==='function') ? normalizeName(rawName) : null;
        if(!param) continue;

        const vStr = m[2].replace(/\s+/g,'');
        const val  = parseNum(vStr.replace(/^</,'').replace(/^>/,''));
        const unit = normUnit(m[3] || guessUnitByName(rawName) || null);

        let ref = null, tail = m[4] || '';
        let r = tail.match(/\bDe\s*([0-9.,-]+)\s*(?:at[eé]|até)\s*([0-9.,-]+)\s*([^\s%]+)/i);
        if(r) ref = `${fmt(parseNum(r[1]))}–${fmt(parseNum(r[2]))} ${normUnit(r[3])}`;
        if(!ref){ r = tail.match(/\b(?:At[eé]|Até)\s*([0-9.,-]+)\s*([^\s%]+)/i); if(r) ref = `≤${fmt(parseNum(r[1]))} ${normUnit(r[2])}`; }
        if(!ref){ r = tail.match(/\b(?:Inferior a|<)\s*([0-9.,-]+)\s*([^\s%]+)/i); if(r) ref = `<${fmt(parseNum(r[1]))} ${normUnit(r[2])}`; }
        if(!ref){ r = tail.match(/\b(?:Superior a|>)\s*([0-9.,-]+)\s*([^\s%]+)/i); if(r) ref = `≥${fmt(parseNum(r[1]))} ${normUnit(r[2])}`; }

        out.push({ parametro:param, rotulo:rawName, valor:val, unidade:unit, ref });
      }
      return out.length ? out : null;
    }
  });

  /* Hemograma (absolutos) */
  self.RULES.push({
    lab: 'any',
    where: /HEMOGRAMA/i,
    parse(lines, i) {
      const out=[];
      for (let k=i;k<Math.min(lines.length,i+120);k++){
        const s = lines[k];

        // Hemácias
        let m = s.match(/\bHem[áa]cias.*?:\s*([0-9.,]+)\s*(milh[õo]es\/mm3|10\^6\/µL)/i);
        if(m) out.push({ parametro:'HEM', rotulo:'Hemácias', valor:parseNum(m[1]), unidade:'10^6/µL', ref:null });

        // Hb, Ht, RDW
        m = s.match(/\bHemoglobina.*?:\s*([0-9.,]+)\s*g\/dL/i);
        if(m) out.push({ parametro:'Hb', rotulo:'Hemoglobina', valor:parseNum(m[1]), unidade:'g/dL', ref:grabNearbyRef(lines,k) });

        m = s.match(/\bHemat[óo]crito.*?:\s*([0-9.,]+)\s*%/i);
        if(m) out.push({ parametro:'Ht', rotulo:'Hematócrito', valor:parseNum(m[1]), unidade:'%', ref:grabNearbyRef(lines,k) });

        m = s.match(/\bRDW.*?:\s*([0-9.,]+)\s*%/i);
        if(m) out.push({ parametro:'RDW', rotulo:'RDW', valor:parseNum(m[1]), unidade:'%', ref:grabNearbyRef(lines,k) });

        // Leucócitos total (mm3 → /µL)
        m = s.match(/\bLeuc[óo]citos.*?:\s*([0-9.,]+)\s*\/mm3/i);
        if(m) out.push({ parametro:'Leuco', rotulo:'Leucócitos', valor:absToInt(m[1]), unidade:'/µL', ref:grabNearbyRef(lines,k) });

        // Diferencial em absolutos (quando disponível)
        const diff = [
          {rx:/\bNeutr[óo]filos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Neutro',lbl:'Neutrófilos'},
          {rx:/\bSegmentados.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Seg',lbl:'Segmentados'},
          {rx:/\bLinf[óo]citos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Linf',lbl:'Linfócitos'},
          {rx:/\bMon[óo]citos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Mono',lbl:'Monócitos'},
          {rx:/\bEosin[óo]filos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Eos',lbl:'Eosinófilos'},
          {rx:/\bBas[óo]filos.*?:\s*([0-9.,]+)\s*\/mm3/i,p:'Baso',lbl:'Basófilos'}
        ];
        for(const d of diff){
          const md = s.match(d.rx);
          if(md) out.push({ parametro:d.p, rotulo:d.lbl, valor:absToInt(md[1]), unidade:'/µL', ref:null });
        }

        // Plaquetas: "mil/mm3" → multiplica por 1000 e transforma em /µL
        m = s.match(/\bPlaquetas.*?:\s*([0-9.,]+)\s*mil\/mm3/i);
        if(m){
          const valK = absToInt(m[1]); // em milhares
          if (Number.isFinite(valK)) out.push({ parametro:'Plaq', rotulo:'Plaquetas', valor:valK*1000, unidade:'/µL', ref:grabNearbyRef(lines,k) });
        }
      }
      return out.length?out:null;
    }
  });

  /* Qualitativos / Hepatites básicos */
  self.RULES.push({
    lab: 'any',
    where: /(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO|HBsAg|Anti-?HBs|Anti-?HBc|HBeAg|Anti-?HBe|S\/CO|ÍNDICE|INDICE)/i,
    parse(lines, i) {
      const out=[];
      const pushQual = (name, val, ref) => {
        const p = (typeof normalizeName==='function' ? normalizeName(name) : null) || name;
        out.push({ parametro: p, rotulo: name, valor: val, unidade: null, ref: ref || null, meta:{ qualitativo:true } });
      };

      for (let k=Math.max(0,i-6); k<Math.min(lines.length, i+20); k++){
        const s = lines[k];

        let m = s.match(/\b(HBsAg)\b.*?(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO|DETECTADO|N[ÃA]O DETECTADO)/i);
        if(m) pushQual('HBsAg', m[2].toUpperCase(), 'Não Reagente');

        m = s.match(/\b(Anti-?HBc(?:\s*total)?)\b.*?(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO)/i);
        if(m) pushQual('Anti-HBc', m[2].toUpperCase(), 'Não Reagente');

        m = s.match(/\b(Anti-?HBc\s*IgM)\b.*?(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO)/i);
        if(m) pushQual('Anti-HBc IgM', m[2].toUpperCase(), 'Não Reagente');

        m = s.match(/\b(HBeAg)\b.*?(REAGENTE|N[ÃA]O REAGENTE)/i);
        if(m) pushQual('HBeAg', m[2].toUpperCase(), 'Não Reagente');

        m = s.match(/\b(Anti-?HBe)\b.*?(REAGENTE|N[ÃA]O REAGENTE)/i);
        if(m) pushQual('Anti-HBe', m[2].toUpperCase(), 'Não Reagente');

        m = s.match(/\b(Anti-?HBs)\b.*?([0-9.,]+)\s*(m?UI\/mL|UI\/L|mIU\/mL)/i);
        if(m) out.push({ parametro:'Anti-HBs', rotulo:'Anti-HBs', valor:parseNum(m[2]), unidade:m[3].toUpperCase(), ref:'≥10 mUI/mL' });

        m = s.match(/\bS\/CO\s*[:\-]?\s*([0-9.,]+)\b/i);
        if(m) out.push({ parametro:'SCO', rotulo:'S/CO', valor:parseNum(m[1]), unidade:null, ref:'<1.0' });

        m = s.match(/\b(?:ÍNDICE|INDICE)\s*[:\-]?\s*([0-9.,]+)\b/i);
        if(m) out.push({ parametro:'IND', rotulo:'Índice', valor:parseNum(m[1]), unidade:null, ref:null });

        // genérica Positivo/Negativo/Reagente
        m = s.match(/^(.*?)\s+(REAGENTE|N[ÃA]O REAGENTE|POSITIVO|NEGATIVO)\b/i);
        if(m){ pushQual(m[1].trim(), m[2].toUpperCase()); }
      }
      return out.length?out:null;
    }
  });
})();
