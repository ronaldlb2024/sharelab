/* public/js/parse/parse.js
   - Mantém detectLabGroup (para futuro specialization).
   - No MVP, varre RULES com lab 'any'.
*/
(function(){
  function detectLabGroup(lines){
    const head = lines.slice(0,80).join(' ');
    const tail = lines.slice(-40).join(' ');
    const txt = (head + ' ' + tail).toUpperCase();

    if (/VALIDA\.DASA\.COM\.BR|INTERVALO DE REFER/.test(txt)) return 'dasa';
    if (/REDE D'?OR|S[ÃA]O LUIZ/.test(txt)) return 'saoluiz';
    if (/\bFLEURY\b|\bA\+\b|CKD-?EPI|MDRD|ALBUMINURIA/.test(txt)) return 'fleury';
    return 'any';
  }
  self.detectLabGroup = detectLabGroup;

  self.parseLabReport = function(lines){
    const out = [];
    // No MVP, aplicamos apenas regras 'any'
    for (let i=0;i<lines.length;i++){
      for (const R of (self.RULES || [])) {
        if (R.lab && R.lab !== 'any') continue;
        if (!R.where.test(lines[i])) continue;
        try{
          const items = R.parse(lines, i);
          if (items && items.length) out.push(...items);
        }catch(e){
          // não interrompe o loop
        }
      }
    }
    return { items: out };
  };
})();
