/* public/js/parse/format.js */
function fmt(n){ return (Math.round(Number(n)*100)/100).toString(); }
function statusFromRef(val, ref){
  if (!ref || typeof val !== 'number') return 'Indeterminado';
  const m = ref.match(/([0-9.,-]+)\s*[–-]\s*([0-9.,-]+)/);
  if (m){ const lo=Number(String(m[1]).replace(',','.')); const hi=Number(String(m[2]).replace(',','.'));
    if (val<lo) return 'Baixo'; if (val>hi) return 'Alto'; return 'Normal';
  }
  const le = ref.match(/^≤\s*([0-9.,-]+)/) || ref.match(/^<\s*([0-9.,-]+)/);
  if (le){ const hi=Number(String(le[1]).replace(',','.')); return (val>hi)?'Alto':'Normal'; }
  return 'Indeterminado';
}
function formatItem(it){
  const v = (it.valor===null||it.valor===undefined) ? '—' : (typeof it.valor==='number'? fmt(it.valor): String(it.valor));
  const u = it.unidade ? (' '+it.unidade) : '';
  return `${it.parametro} ${v}${u}`;
}
self.formatOutputs = function(parsed){
  const items = parsed.items||[];
  const order = ['Hb','Ht','Leuco','Plaq','URE','CRE','NA','K','MG','CAI','pH(v)','pO2(v)','pCO2(v)','HCO3(v)','BE(v)','SatO2(v)','GLI','PCR','AST','ALT','GGT','FA','RDW','Neutro','Seg','Linf','Mono','Eos','Baso'];
  const byKey = {}; for (const it of items){ if(!byKey[it.parametro]) byKey[it.parametro]=it; }
  const ordered = []; for (const k of order){ if (byKey[k]) ordered.push(byKey[k]); }
  for (const it of items){ if (!order.includes(it.parametro)) ordered.push(it); }
  const profissional = ordered.map(formatItem).join('; ');

  const paciente = items.map(it => {
    const nome = it.rotulo || it.parametro;
    const v = (it.valor===null||it.valor===undefined) ? '—' : (typeof it.valor==='number'? fmt(it.valor): String(it.valor));
    const u = it.unidade ? (' '+it.unidade) : '';
    const st = statusFromRef((typeof it.valor==='number'?it.valor:null), it.ref);
    return `${nome}: ${v}${u}` + (st!=='Indeterminado'? ` — ${st.toLowerCase()}` : '');
  }).join('\n');

  const json = { exame:{ titulo:"Exames de Análises Clínicas", laboratorio:null, data:null }, itens: items.map(it => ({
    parametro_norm: it.parametro, rotulo: it.rotulo||it.parametro, valor: it.valor, unidade: it.unidade||null, ref: it.ref||null,
    status: statusFromRef((typeof it.valor==='number'?it.valor:null), it.ref)
  })) };
  return { profissional, paciente, json };
};
