/* public/js/parse/format.js
   Gera as três saídas: profissional, paciente e JSON.
*/
self.formatOutputs = (parsed) => {
  const map = {};
  for (const it of parsed.itens) map[it.parametro_norm] = it;

  const parts = [];
  for (const code of PROF_ORDER) {
    const it = map[code];
    if (!it || it.valor == null) continue;
    let v = it.valor;
    let u = it.unidade || '';
    let s;
    if (u === '%') s = v.toFixed(1);
    else if (/\/(µ|u)?l|mm3|mm³/i.test(u)) s = String(Math.round(v));
    else s = Number.isInteger(v) ? String(v) : String(+v.toFixed(2)).replace(/\.00$/,'');
    parts.push(`${code.toUpperCase()} ${s}${u ? ' '+u : ''}`.trim());
  }
  const profissional = parts.join('; ');

  const linhas = [];
  for (const it of parsed.itens.sort((a,b)=> (a.rotulo||'').localeCompare(b.rotulo||''))) {
    if (it.valor == null) continue;
    const v = Number.isInteger(it.valor) ? it.valor : +it.valor.toFixed(2);
    const u = it.unidade ? ` ${it.unidade}` : '';
    linhas.push(`${it.rotulo}: ${String(v).replace('.',',')}${u} — ${it.status.toLowerCase()}`);
  }
  const header = [parsed.exame?.titulo, parsed.exame?.laboratorio, parsed.exame?.data].filter(Boolean).join(' • ');
  const paciente = (header ? header + '\n\n' : '') + linhas.join('\n');

  const json = {
    paciente: { nome: null, data_nascimento: null },
    exame: parsed.exame,
    itens: parsed.itens,
    evolutivo: {}
  };

  return { profissional, paciente, json };
};
