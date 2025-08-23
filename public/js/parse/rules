/* public/js/parse/rules.js
   Regras e utilitários de parsing.
*/
self.pctUnit = (u) => u && /%$/.test(String(u).trim());

self.looksUrine = (label, unit) =>
  /urina/i.test(label || '') || (unit && /\/ml\b/i.test(unit));

self.firstNumberAndUnit = (partsAfterLabel) => {
  for (const part of partsAfterLabel) {
    const s = String(part).trim();
    const m = s.match(/^([<>]?\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) continue;
    const val = parseFloat(m[1].replace(',','.'));
    let unit = (m[2] || '').trim();
    if (unit && !/[A-Za-z/%µ^/]/.test(unit)) unit = null;
    if (pctUnit(unit)) continue; // pular percentual quando houver absoluto em outra coluna
    return { val, unit };
  }
  return { val:null, unit:null };
};

self.preferAbsoluteCounts = (itens) => {
  const preferAbs = ['neutro','seg','linf','mono','eos','baso','leuco'];
  for (const code of preferAbs) {
    const i = itens.findIndex(x => x.parametro_norm === code && x.unidade && /\/(µ|u)?l|mm3|mm³/i.test(x.unidade));
    const j = itens.findIndex(x => x.parametro_norm === code && x.unidade && /%$/.test(x.unidade));
    if (i >= 0 && j >= 0) itens.splice(j,1);
  }
};

self.isEvolutiveRest = (rest) => {
  const nums = (rest.match(/\d+(?:[.,]\d+)?/g) || []);
  return nums.length > 2;
};

self.tailRefText = (text) => {
  if (!text) return null;
  const m = text.match(/(de\s+\d.*a\s+\d.*|até\s+\d.*|inferior a\s+\d.*|superior a\s+\d.*)$/i);
  return m ? m[1] : null;
};
