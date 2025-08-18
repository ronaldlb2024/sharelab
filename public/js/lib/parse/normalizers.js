// js/lib/parse/normalizers.js
export const NORMALIZE_MAP = {
  hb: ['hemoglobina','hb'],
  ht: ['hematocrito','ht'],

  leuco: ['leucocitos','wbc','globulos brancos','leuco'],
  // diferencial (percentual ou absoluto)
  neutro: ['neutrofilos','neutrofilos absolutos','neutro'],
  seg:    ['segmentados','seg'],
  linf:   ['linfocitos','linfocitos absolutos','linf'],
  mono:   ['monocitos','monocitos absolutos','mono'],
  eos:    ['eosinofilos','eosinofilos absolutos','eos'],
  baso:   ['basofilos','basofilos absolutos','baso'],

  plaq: ['plaquetas','contagem de plaquetas','plaq','plt','platelets'],

  ure: ['ureia','urea','ureia serica','bun'],
  cre: ['creatinina','cre','creatinina serica'],
  na:  ['sodio','sodio serico','na'],
  k:   ['potassio','potassio serico','k'],
  mg:  ['magnesio','mg'],
  cai: ['calcio ionico','cai'],
  gli: ['glicose','glucose','gli'],

  pcr: ['proteina c reativa','proteina c reativa ultrassensivel','pcr-us','hs-crp','pcr','crp'],

  ast: ['ast','tgo'],
  alt: ['alt','tgp'],
  fa:  ['fal','fa','fosfatase alc','fosfatase alcalina'],
  ggt: ['ggt'],
  ldh: ['ldh'],
  tni: ['troponina i','troponina i alta sensibilidade','tni'],
  rdw: ['rdw'],

  rni: ['inr','rni'],
  'ttpa_rel': ['ttpa','aptt','relacao ttpa','ttpa rel','aptt ratio'],

  // Gasometria arterial
  'ph(a)':    ['ph arterial','ph(a)'],
  'po2(a)':   ['po2 arterial','po2(a)'],
  'pco2(a)':  ['pco2 arterial','pco2(a)'],
  'hco3(a)':  ['hco3 arterial','hco3(a)','bicarbonato arterial'],
  'be(a)':    ['be arterial','excesso de base arterial','base excess arterial','be(a)'],
  'sato2(a)': ['sato2 arterial','saturacao de o2 arterial','sato2(a)'],

  // Gasometria venosa
  'ph(v)':    ['ph venoso','ph(v)'],
  'po2(v)':   ['po2 venoso','po2(v)'],
  'pco2(v)':  ['pco2 venoso','pco2(v)'],
  'hco3(v)':  ['hco3 venoso','hco3(v)','bicarbonato venoso'],
  'be(v)':    ['be venoso','excesso de base venoso','be(v)'],
  'sato2(v)': ['sato2 venoso','saturacao de o2 venoso','sato2(v)']
};
