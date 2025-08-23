/* public/js/parse/normalize.js
   Mapa de sinônimos → códigos normalizados + rótulos legíveis.
   Funções auxiliares para normalizar strings.
*/
self.NORMALIZE_MAP = {
  hb:    { labels: ['hemoglobina'], patient: 'Hemoglobina' },
  ht:    { labels: ['hematócrito','hematocrito'], patient: 'Hematócrito' },
  hem:   { labels: ['hemácias','hemacias','eritrocitos','eritrócitos'], patient: 'Hemácias' },
  rdw:   { labels: ['rdw'], patient: 'RDW' },
  leuco: { labels: ['leucócitos','leucocitos'], patient: 'Leucócitos' },
  plaq:  { labels: ['plaquetas','contagem de plaquetas'], patient: 'Plaquetas' },

  neutro: { labels: ['neutrófilos','neutrofilos'], patient: 'Neutrófilos' },
  seg:    { labels: ['segmentados','seg'], patient: 'Neutrófilos segmentados' },
  linf:   { labels: ['linfócitos','linfocitos'], patient: 'Linfócitos' },
  mono:   { labels: ['monócitos','monocitos'], patient: 'Monócitos' },
  eos:    { labels: ['eosinófilos','eosinofilos'], patient: 'Eosinófilos' },
  baso:   { labels: ['basófilos','basofilos'], patient: 'Basófilos' },

  ure:  { labels: ['ureia','uréia'], patient: 'Ureia' },
  cre:  { labels: ['creatinina'], patient: 'Creatinina' },
  egfr: { labels: ['egfr','tfg'], patient: 'Taxa de filtração glomerular (eGFR)' },

  na: { labels: ['sódio','sodio'], patient: 'Sódio' },
  k:  { labels: ['potássio','potassio'], patient: 'Potássio' },
  mg: { labels: ['magnésio','magnesio'], patient: 'Magnésio' },
  cai:{ labels: ['cálcio iônico','calcio ionico'], patient: 'Cálcio iônico' },
  gli:{ labels: ['glicose'], patient: 'Glicose' },

  pcr:{ labels: ['proteína c reativa','proteina c reativa','pcr'], patient: 'Proteína C Reativa' },
  tni:{ labels: ['troponina i','tni'], patient: 'Troponina I' },
  cpk:{ labels: ['ck','cpk','creatinofosfoquinase'], patient: 'Creatinofosfoquinase (CK)' },
  ldh:{ labels: ['ldh'], patient: 'Desidrogenase láctica (LDH)' },

  ast:{ labels: ['ast','tgo'], patient: 'AST (TGO)' },
  alt:{ labels: ['alt','tgp'], patient: 'ALT (TGP)' },
  fa: { labels: ['fa','fal','fosfatase alcalina'], patient: 'Fosfatase alcalina' },
  ggt:{ labels: ['ggt','gama gt','gamma gt'], patient: 'Gama-GT (GGT)' },

  'bil t': { labels: ['bilirrubina total','bil t','bil total'], patient: 'Bilirrubina total' },
  'bil d': { labels: ['bilirrubina direta','bil d','bil direta'], patient: 'Bilirrubina direta' },
  'bil i': { labels: ['bilirrubina indireta','bil i','bil indireta'], patient: 'Bilirrubina indireta' },

  rni:      { labels: ['rni','inr'], patient: 'INR' },
  ttpa_rel: { labels: ['ttpa','aptt','relação ttpa','ttpa rel'], patient: 'TTPA (relação)' },

  // Gasometrias (exemplo; pode expandir conforme necessidade)
  'ph(a)':    { labels: ['ph(a)'], patient: 'pH arterial' },
  'pco2(a)':  { labels: ['pco2(a)'], patient: 'pCO₂ arterial' },
  'po2(a)':   { labels: ['po2(a)'], patient: 'pO₂ arterial' },
  'hco3(a)':  { labels: ['hco3(a)','bicarbonato (a)'], patient: 'Bicarbonato arterial (HCO₃⁻)' },
  'be(a)':    { labels: ['be(a)'], patient: 'Excesso de base arterial' },
  'sato2(a)': { labels: ['sato2(a)'], patient: 'Saturação O₂ arterial' },
  'ph(v)':    { labels: ['ph(v)'], patient: 'pH venoso' },
  'pco2(v)':  { labels: ['pco2(v)'], patient: 'pCO₂ venoso' },
  'po2(v)':   { labels: ['po2(v)'], patient: 'pO₂ venoso' },
  'hco3(v)':  { labels: ['hco3(v)'], patient: 'Bicarbonato venoso (HCO₃⁻)' },
  'be(v)':    { labels: ['be(v)'], patient: 'Excesso de base venoso' },
  'sato2(v)': { labels: ['sato2(v)'], patient: 'Saturação O₂ venoso' },
};

self.PROF_ORDER = [
  'hb','ht','leuco','plaq','ure','cre','na','k','mg','cai',
  'ph(a)','po2(a)','pco2(a)','hco3(a)','be(a)','sato2(a)',
  'ph(v)','po2(v)','pco2(v)','hco3(v)','be(v)','sato2(v)',
  'pcr','tni','rdw','neutro','seg','linf','mono','eos','baso',
  'rni','ttpa_rel','ast','alt','ggt','fa','bil t','bil d','bil i','cpk','ldh'
];

self.strip = (s) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

self.canonicalKey = (label) => {
  const norm = strip(String(label).replace(/[:：]\s*$/,''));
  for (const code in NORMALIZE_MAP) {
    const { labels } = NORMALIZE_MAP[code];
    for (const l of labels) {
      const sl = strip(l);
      if (norm === sl || norm.startsWith(sl+' ')) return code;
    }
  }
  return null;
};
