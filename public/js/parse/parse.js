/* public/js/parse/parse.js */
function detectLabGroup(lines){
  const txt = (lines.slice(0,80).join(' ') + ' ' + lines.slice(-40).join(' ')).toUpperCase();
  if (/VALIDA\.DASA\.COM\.BR|INTERVALO DE REFER/.test(txt)) return 'dasa';
  if (/REDE D'?OR|S[ÃA]O LUIZ/.test(txt)) return 'saoluiz';
  if (/\bFLEURY\b|\bA\+\b|CKD-?EPI|MDRD|ALBUMINURIA/.test(txt)) return 'fleury';
  return 'any';
}
self.parseLabReport = function(lines){
  // Por simplicidade do MVP, varremos todas as regras com 'any'.
  // O detectLabGroup está pronto para especializar se quiser.
  const picked = [];
  for (let i=0;i<lines.length;i++){
    for (const R of (self.RULES||[])) {
      if (R.lab && R.lab !== 'any') continue; // manteve genéricas no MVP
      if (!R.where.test(lines[i])) continue;
      const items = R.parse(lines, i);
      if (items && items.length) picked.push(...items);
    }
  }
  return { items: picked };
};
