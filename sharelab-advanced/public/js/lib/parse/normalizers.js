/*
 * Mapa de normalização de nomes de parâmetros laboratoriais.
 *
 * Este módulo centraliza as abreviações e sinônimos utilizados para
 * converter nomes de analitos para códigos padronizados (por exemplo,
 * “Hemoglobina” → “Hb”). A lista não é exaustiva, mas cobre os
 * principais exames de hemograma, bioquímica, hepatograma, inflamação
 * e coagulação. Futuras entradas podem ser adicionadas conforme novos
 * laudos forem analisados.
 */
export const NAME_MAP = {
    // Hemograma
    'hemoglobina': 'Hb',
    'hematócrito': 'Ht',
    'hematocrito': 'Ht',
    'hemácias': 'HEM',
    'hemacias': 'HEM',
    'rdw': 'RDW',
    'leucócitos': 'Leuco',
    'leucocitos': 'Leuco',
    'leuco': 'Leuco',
    'plaquetas': 'Plaq',
    'plaquetas contagem': 'Plaq',
    'contagem de plaquetas': 'Plaq',
    'neutrófilos': 'Neutro',
    'neutrofilos': 'Neutro',
    'segmentados': 'Seg',
    'linfócitos': 'Linf',
    'linfocitos': 'Linf',
    'monócitos': 'Mono',
    'monocitos': 'Mono',
    'eosinófilos': 'Eos',
    'eosinofilos': 'Eos',
    'basófilos': 'Baso',
    'basofilos': 'Baso',
    // Eletrólitos e bioquímica
    'sódio': 'NA',
    'sodio': 'NA',
    'na': 'NA',
    'potássio': 'K',
    'potassio': 'K',
    'k': 'K',
    'magnésio': 'MG',
    'magnesio': 'MG',
    'mg': 'MG',
    'cálcio iônico': 'CAI',
    'calcio ionico': 'CAI',
    'ureia': 'URE',
    'urea': 'URE',
    'creatinina': 'CRE',
    'cre': 'CRE',
    'egrf': 'eGFR',
    'tfg': 'eGFR',
    'glicose': 'GLI',
    'gli': 'GLI',
    // Hepáticas
    'ast': 'AST',
    'tgo': 'AST',
    'alt': 'ALT',
    'tgp': 'ALT',
    'fa': 'FA',
    'fal': 'FA',
    'ggt': 'GGT',
    'bilirrubina total': 'BIL T',
    'bilirrubina direta': 'BIL D',
    'bilirrubina indireta': 'BIL I',
    // Inflamação/Cardio
    'proteína c reativa': 'PCR',
    'proteina c reativa': 'PCR',
    'pcr': 'PCR',
    'cpk': 'CPK',
    'ck': 'CPK',
    'ldh': 'LDH',
    'troponina i': 'TnI',
    'tni': 'TnI',
    'pro bnp': 'PROBNP',
    'probnp': 'PROBNP',
    // Coagulação
    'rni': 'RNI',
    'inr': 'RNI',
    'ttpa': 'TTPA_rel',
    'ttpa_rel': 'TTPA_rel',
    'tap': 'TAP',
    'protrombina': 'TAP',
    // Gasometrias Arterial
    'ph(a)': 'pH(a)',
    'pco2(a)': 'pCO2(a)',
    'po2(a)': 'pO2(a)',
    'hco3(a)': 'HCO3(a)',
    'be(a)': 'BE(a)',
    'sato2(a)': 'SatO2(a)',
    // Gasometrias Venosa
    'ph(v)': 'pH(v)',
    'pco2(v)': 'pCO2(v)',
    'po2(v)': 'pO2(v)',
    'hco3(v)': 'HCO3(v)',
    'be(v)': 'BE(v)',
    'sato2(v)': 'SatO2(v)',
    // Outros
    'lactato': 'LAC',
};

/**
 * Normaliza um nome bruto de parâmetro para sua abreviação padrão.
 * A função converte o texto para minúsculas, remove acentos e busca
 * correspondências em NAME_MAP. Se nenhuma correspondência for
 * encontrada, retorna o nome original normalizado (primeira letra
 * maiúscula).
 */
export function normalizeName(raw) {
    const normalized = removeDiacritics(raw.trim().toLowerCase());
    const key = normalized.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    const match = NAME_MAP[key];
    if (match)
        return match;
    // Caso não encontre, retorna com primeira letra maiúscula (ex.: "Albumina").
    return raw.trim().replace(/\s+/g, ' ').replace(/^(\w)/, (c) => c.toUpperCase());
}

/**
 * Remove diacríticos e acentos de uma string (normalização NFD).
 */
function removeDiacritics(str) {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}