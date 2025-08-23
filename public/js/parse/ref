/* public/js/parse/ref.js
   Parse de faixa de referência e classificação Baixo/Normal/Alto.
*/
self.parseRef = (s) => {
  if (!s) return { low:null, high:null, typ:'unknown' };
  const t = String(s).toLowerCase().replace(/–|—/g,'-').replace('até','a');
  let m = t.match(/(?:de\s*)?([-+]?\d+(?:[.,]\d+)?)\s*a\s*([-+]?\d+(?:[.,]\d+)?)/i);
  if (m) {
    const low = parseFloat(m[1].replace(',','.'));
    const high = parseFloat(m[2].replace(',','.'));
    return { low: Math.min(low,high), high: Math.max(low,high), typ:'range' };
  }
  m = t.match(/inferior\s+a\s+([-+]?\d+(?:[.,]\d+)?)/i);
  if (m) return { low:null, high:parseFloat(m[1].replace(',','.')), typ:'le' };
  m = t.match(/superior\s+a\s+([-+]?\d+(?:[.,]\d+)?)/i);
  if (m) return { low:parseFloat(m[1].replace(',','.')), high:null, typ:'ge' };
  m = t.match(/\ba\s+([-+]?\d+(?:[.,]\d+)?)\b/);
  if (m) return { low:null, high:parseFloat(m[1].replace(',','.')), typ:'le' };
  return { low:null, high:null, typ:'unknown' };
};

self.classify = (val, ref) => {
  if (val == null) return 'Indeterminado';
  const v = Number(val);
  if (Number.isNaN(v)) return 'Indeterminado';
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
