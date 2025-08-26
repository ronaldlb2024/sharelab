/* public/js/parse/normalize.js */
const NMAP = (typeof NMAP !== 'undefined') ? NMAP : {};

// Bioquímica / Eletrólitos
Object.assign(NMAP, {
  'SÓDIO':'NA','SODIO':'NA','NA':'NA',
  'POTÁSSIO':'K','POTASSIO':'K','K':'K',
  'MAGNÉSIO':'MG','MAGNESIO':'MG','MG':'MG',
  'CÁLCIO IÔNICO':'CAI','CALCIO IONICO':'CAI','CÁLCIO IONIZADO':'CAI','CAI':'CAI',
  'GLICOSE':'GLI','GLI':'GLI',
  'UREIA':'URE','URÉIA':'URE','URE':'URE',
  'CREATININA':'CRE','CRE':'CRE',
  'TFG':'eGFR','DEPI':'eGFR','CKD-EPI':'eGFR'
});
// Hepáticas
Object.assign(NMAP, {
  'ASPARTATO AMINOTRANSFERASE (TGO/AST)':'AST','TGO':'AST','AST':'AST',
  'ALANINA AMINOTRANSFERASE (TGP/ALT)':'ALT','TGP':'ALT','ALT':'ALT',
  'FOSFATASE ALCALINA':'FA','FA':'FA',
  'GAMA GT':'GGT','GGT':'GGT',
  'BILIRRUBINA TOTAL':'BIL T','BILIRRUBINA DIRETA':'BIL D','BILIRRUBINA INDIRETA':'BIL I'
});
// Inflamação / Cardio / Enzimas
Object.assign(NMAP, {
  'PCR - PROTEINA C REATIVA QUANTITATIVA':'PCR','PROTEÍNA C REATIVA':'PCR','PROTEINA C REATIVA':'PCR','PCR':'PCR',
  'CK TOTAL':'CK','CPK/CK':'CK','CK':'CK',
  'LDH':'LDH',
  'TROPONINA I':'TnI','TROPONINA I ALTA SENSIBILIDADE':'TnI',
  'PROBNP':'PROBNP'
});
// Coagulação
Object.assign(NMAP, {
  'INR':'RNI','RNI':'RNI','TTPA':'TTPA',
  'TTPA (RELAÇÃO PACIENTE/CONTROLE)':'TTPA_rel',
  'TEMPO DE PROTROMBINA':'TP','ATIVIDADE DE PROTROMBINA':'TAP'
});
// Hemograma
Object.assign(NMAP, {
  'HEMOGLOBINA':'Hb','Hb':'Hb',
  'HEMATÓCRITO':'Ht','HEMATOCRITO':'Ht','Ht':'Ht',
  'HEMÁCIAS':'HEM','HEMACIAS':'HEM','RBC':'HEM',
  'RDW':'RDW','LEUCÓCITOS':'Leuco','LEUCOCITOS':'Leuco',
  'PLAQUETAS':'Plaq',
  'NEUTRÓFILOS':'Neutro','NEUTRÓFILOS SEGMENTADOS':'Seg','SEGMENTADOS':'Seg',
  'LINFÓCITOS':'Linf','LINFOCITOS':'Linf',
  'MONÓCITOS':'Mono','MONOCITOS':'Mono',
  'EOSINÓFILOS':'Eos','EOSINOFILOS':'Eos',
  'BASÓFILOS':'Baso','BASOFILOS':'Baso'
});
// Gasometrias venosa
Object.assign(NMAP, {
  'PH':'pH(v)','PCO2':'pCO2(v)','PO2':'pO2(v)',
  'HCO3':'HCO3(v)','TCO2':'TCO2(v)','BE':'BE(v)','SO2':'SatO2(v)'
});
// Qualitativos / Hepatites
Object.assign(NMAP, {
  'REAGENTE':'QUAL','NÃO REAGENTE':'QUAL','NAO REAGENTE':'QUAL',
  'POSITIVO':'QUAL','NEGATIVO':'QUAL','NÃO DETECTADO':'QUAL','NAO DETECTADO':'QUAL','DETECTADO':'QUAL','INDETERMINADO':'QUAL',
  'ÍNDICE':'IND','INDICE':'IND','S/CO':'SCO','TITLE':'TIT',
  'HBsAg':'HBsAg','Anti-HBs':'Anti-HBs','Anti-HBc':'Anti-HBc','Anti-HBc TOTAL':'Anti-HBc','Anti-HBc IgM':'Anti-HBc IgM',
  'HBeAg':'HBeAg','Anti-HBe':'Anti-HBe'
});
// Genética (básico)
Object.assign(NMAP, {
  'GENE':'GENE','VARIANTE':'VAR','INTERPRETAÇÃO':'ACMG','INTERPRETACAO':'ACMG','ZIGOSE':'ZYG',
  'COBERTURA MÉDIA':'COV','COBERTURA MEDIA':'COV','PROFUNDIDADE':'DEP','CLASSIFICAÇÃO ACMG':'ACMG','CLASSIFICACAO ACMG':'ACMG',
  'VARIANT':'VAR','ZYGOSITY':'ZYG'
});

if (typeof normalizeName === 'undefined') {
  self.normalizeName = function (raw) {
    if (!raw) return null;
    const k = String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
    return NMAP[k] || NMAP[k.replace(/[º°]/g,'O')] || null;
  };
}
