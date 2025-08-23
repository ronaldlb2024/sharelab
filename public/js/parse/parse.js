/* public/js/parse/parse.js
   Converte linhas em itens clínicos.
*/
function parseColonLine(line) {
  const m = line.match(/^([^:：]+)[:：]\s*(.+)$/);
  if (!m) return null;
  const label = m[1].trim();
  const rest = m[2].trim();
  if (isEvolutiveRest(rest)) return null;

  const mu = rest.match(/^([<>]?\d+(?:[.,]\d+)?)(?:\s+([^\s]+))?/);
  if (!mu) return null;
  const val = parseFloat(mu[1].replace(',','.'));
  let unit = (mu[2] || '').trim();
  if (unit && !/[A-Za-z/%µ^/]/.test(unit)) unit = null;

  const refText = (rest.slice(mu[0].length).match(/(ref\.?|refer[êe]ncia|de\s+\d.*)$/i) || [null])[0];
  const code = canonicalKey(label);
  if (!code) return null;
  if (looksUrine(label, unit) && ['hem','leuco','neutro','linf','mono','eos','baso'].includes(code)) return null;

  return { code, label, val, unit, refText };
}

function parseResultadoBlocks(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!/[A-Za-z]/.test(L) || /resultado\s*:/i.test(L)) continue;
    const code = canonicalKey(L);
    if (!code) continue;

    for (let j = i+1; j <= i+4 && j < lines.length; j++) {
      const r = lines[j];
      const m = r.match(/resultado\s*:\s*([<>]?\d+(?:[.,]\d+)?)(?:\s+([^\s]+))?/i);
      if (!m) continue;
      const val = parseFloat(m[1].replace(',','.'));
      let unit = (m[2] || '').trim();
      if (unit && !/[A-Za-z/%µ^/]/.test(unit)) unit = null;

      let refText = null;
      for (let k = j; k <= j+4 && k < lines.length; k++) {
        const t = lines[k];
        const mm = t.match(/(valores? de refer[êe]ncia.*|de\s+\d.*a\s+\d.*|inferior a\s+\d.*|superior a\s+\d.*|até\s+\d.*)$/i);
        if (mm) { refText = mm[1]; break; }
      }

      if (!(looksUrine(L, unit) && ['hem','leuco','neutro','linf','mono','eos','baso'].includes(code))) {
        out.push({ code, label: L, val, unit, refText });
      }
      break;
    }
  }
  return out;
}

self.parseLabReport = (lines) => {
  const itens = [];
  const seen = new Set();
  const avisos = [];

  // 1) Linhas com tabs (colunas)
  for (const raw of lines) {
    const parts = raw.split('\t');
    if (parts.length <= 1) continue;
    const label = parts[0].replace(/\s+/g,' ').trim().replace(/[:：]$/,'');
    const code = canonicalKey(label);
    if (!code) continue;

    const { val, unit } = firstNumberAndUnit(parts.slice(1));
    if (val == null) continue;
    if (looksUrine(label, unit) && ['hem','leuco','neutro','linf','mono','eos','baso'].includes(code)) continue;

    const refTail = parts[parts.length - 1];
    const refText = tailRefText(refTail);

    const key = code;
    if (seen.has(key)) continue;
    seen.add(key);

    const ref = parseRef(refText);
    const status = classify(val, ref);
    itens.push({
      parametro_norm: code,
      rotulo: NORMALIZE_MAP[code]?.patient || label,
      valor: val,
      unidade: unit || null,
      ref: refText || null,
      status
    });
  }

  // 2) Linhas colonizadas “label: valor unidade”
  for (const raw of lines) {
    const obj = parseColonLine(raw);
    if (!obj) continue;
    const key = obj.code;
    if (seen.has(key)) continue;
    seen.add(key);
    const ref = parseRef(obj.refText);
    const status = classify(obj.val, ref);
    itens.push({
      parametro_norm: obj.code,
      rotulo: NORMALIZE_MAP[obj.code]?.patient || obj.label,
      valor: obj.val,
      unidade: obj.unit || null,
      ref: obj.refText || null,
      status
    });
  }

  // 3) Blocos “Resultado:”
  const rBlocks = parseResultadoBlocks(lines);
  for (const b of rBlocks) {
    const key = b.code;
    if (seen.has(key)) continue;
    seen.add(key);
    const ref = parseRef(b.refText);
    const status = classify(b.val, ref);
    itens.push({
      parametro_norm: b.code,
      rotulo: NORMALIZE_MAP[b.code]?.patient || b.label,
      valor: b.val,
      unidade: b.unit || null,
      ref: b.refText || null,
      status
    });
  }

  // Regras extras: leucograma – preferir absolutos
  preferAbsoluteCounts(itens);

  return {
    exame: { titulo: null, laboratorio: null, data: null },
    itens,
    avisos
  };
};
