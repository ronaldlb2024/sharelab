/* public/js/parse/ref.js
   Parse de faixa de referência e classificação Baixo/Normal/Alto.
*/
(function(){
  self.parseRef = (s) => {
    if (!s) return { low:null, high:null, typ:'unknown' };
    const t = String(s).toLowerCase()
      .replace(/–|—/g,'-')
      .replace(/\s+até\s+/g,' a ');

    // x a y
    let m = t.match(/(?:de\s*)?([-+]?\d+(?:[.,]\d+)?)\s*a\s*([-+]?\d+(?:[.,]\d+)?)/i);
    if (m) {
      const low = parseFloat(m[1].replace(',','.'));
      const high = parseFloat(m[2].replace(',','.'));
      return { low: Math.min(low,high), high: Math.max(low,high), typ:'range' };
    }
    // ≤ y   |  < y
    m = t.match(/^(?:≤|<|inferior\s+a)\s*([-+]?\d+(?:[.,]\d+)?)/i);
    if (m) return { low:null, high:parseFloat(m[1].replace(',','.')), typ:'le' };
    // ≥ x   |  > x
    m = t.match(/^(?:≥|>|superior\s+a)\s*([-+]?\d+(?:[.,]\d+)?)/i);
    if (m) return { low:parseFloat(m[1].replace(',','.')), high:null, typ:'ge' };

    return { low:null, high:null, typ:'unknown' };
  };

  self.classify = (val, ref) => {
    if (val == null) return 'Indeterminado';
    const v = Number(val);
    if (!Number.isFinite(v)) return 'Indeterminado';
    const { low, high, typ } = ref || {};
    if (typ === 'range') {
      if (low != null && v < low) return 'Baixo';
      if (high != null && v > high) return 'Alto';
      return 'Normal';
    }
    if (typ === 'le')  return (high != null && v > high) ? 'Alto' : 'Normal';
    if (typ === 'ge')  return (low  != null && v < low)  ? 'Baixo' : 'Normal';
    return 'Indeterminado';
  };
})();
