/* public/js/parse/format.js
   - Usa classify/parseRef do ref.js se presentes (evita duplicar lógica).
   - Mantém ordem clínica e gera as três saídas.
*/
(function(){
  // número com 2 casas máx., sem zeros supérfluos
  function fmt2(n){
    const x = Number(n);
    if (!Number.isFinite(x)) return String(n);
    const s = (Math.round(x * 100) / 100).toFixed(2);
    return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  // fallback simples quando ref.js não estiver carregado
  function _statusFallback(val, ref){
    if (!ref || typeof val !== 'number' || !Number.isFinite(val)) return 'Indeterminado';
    const txt = String(ref).trim();
    // faixa x–y
    let m = txt.match(/([0-9.,]+)\s*[–-]\s*([0-9.,]+)/);
    if (m){
      const lo = Number(String(m[1]).replace(',','.'));
      const hi = Number(String(m[2]).replace(',','.'));
      if (Number.isFinite(lo) && val < lo) return 'Baixo';
      if (Number.isFinite(hi) && val > hi) return 'Alto';
      return 'Normal';
    }
    // ≤ ou <
    m = txt.match(/^(?:≤|<)\s*([0-9.,]+)/);
    if (m){
      const hi = Number(String(m[1]).replace(',','.'));
      if (Number.isFinite(hi) && val > hi) return 'Alto';
      return 'Normal';
    }
    // ≥ ou >
    m = txt.match(/^(?:≥|>)\s*([0-9.,]+)/);
    if (m){
      const lo = Number(String(m[1]).replace(',','.'));
      if (Number.isFinite(lo) && val < lo) return 'Baixo';
      return 'Normal';
    }
    return 'Indeterminado';
  }

  function statusFromRef(val, ref){
    if (typeof self.classify === 'function' && typeof self.parseRef === 'function'){
      const pr = self.parseRef(ref || '');
      return self.classify(val, pr);
    }
    return _statusFallback(val, ref);
  }

  function formatItem(it){
    const v = (it.valor==null)
      ? '—'
      : (typeof it.valor==='number' ? fmt2(it.valor) : String(it.valor));
    const u = it.unidade ? (' '+it.unidade) : '';
    return `${it.parametro} ${v}${u}`;
  }

  self.formatOutputs = function(parsed){
    const items = parsed.items || [];

    // Ordem clínica (MVP)
    const order = [
      'Hb','Ht','Leuco','Plaq','URE','CRE','NA','K','MG','CAI',
      'pH(v)','pO2(v)','pCO2(v)','HCO3(v)','BE(v)','SatO2(v)',
      'GLI','PCR','AST','ALT','GGT','FA','RDW','Neutro','Seg','Linf','Mono','Eos','Baso'
    ];

    const byKey = {};
    for (const it of items){
      if (!byKey[it.parametro]) byKey[it.parametro] = it;
    }

    const ordered = [];
    for (const k of order){ if (byKey[k]) ordered.push(byKey[k]); }
    for (const it of items){ if (!order.includes(it.parametro)) ordered.push(it); }

    const profissional = ordered.map(formatItem).join('; ');

    const paciente = items.map(it => {
      const nome = it.rotulo || it.parametro;
      const v = (it.valor==null)
        ? '—'
        : (typeof it.valor==='number' ? fmt2(it.valor) : String(it.valor));
      const u = it.unidade ? (' '+it.unidade) : '';
      const st = statusFromRef((typeof it.valor==='number'?it.valor:null), it.ref);
      return `${nome}: ${v}${u}` + (st!=='Indeterminado'? ` — ${st.toLowerCase()}` : '');
    }).join('\n');

    const json = {
      exame: { titulo: "Exames de Análises Clínicas", laboratorio: null, data: null },
      itens: items.map(it => ({
        parametro_norm: it.parametro,
        rotulo: it.rotulo || it.parametro,
        valor: it.valor,
        unidade: it.unidade || null,
        ref: it.ref || null,
        status: statusFromRef((typeof it.valor==='number'?it.valor:null), it.ref)
      }))
    };

    return { profissional, paciente, json };
  };
})();
