/*
 * Parser simples de laudos clínicos em PDF (texto extraído).
 *
 * Este módulo contém funções que recebem o texto bruto extraído de um
 * laudo e tentam identificar o paciente, o exame e os parâmetros
 * laboratoriais com seus valores, unidades e faixas de referência.
 * O objetivo não é cobrir todos os formatos de laudo possíveis, mas
 * oferecer um MVP suficiente para laudos do tipo AFIP ou DASA com
 * layout tabular simples.
 */
import { normalizeName } from './normalizers.js';

/**
 * Função principal de parsing. Recebe o texto completo de um laudo e retorna
 * um objeto `ParsedReport` com campos opcionais e lista de itens.
 */
export function parseReport(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const result = { items: [] };
    // Buscar nome do paciente e data de nascimento.
    for (const line of lines) {
        // Nome do Paciente: Geralmente precedido por "Nome" ou "Paciente".
        const nomeMatch = line.match(/(?:nome do paciente|paciente|nome)[:\s]*([A-Za-zÁ-ÿ\s]+)$/i);
        if (nomeMatch && !result.patientName) {
            result.patientName = nomeMatch[1].trim();
        }
        const nascMatch = line.match(/(?:nascimento|data de nascimento|dn|nasc\.)[:\s]*([0-9]{2}\/?[0-9]{2}\/?[0-9]{4})/i);
        if (nascMatch && !result.dob) {
            result.dob = nascMatch[1].replace(/\s+/g, '');
        }
        // Data do exame/coleta
        const dataMatch = line.match(/(?:coleta|data|realizado em)[:\s]*([0-9]{1,2}\/?[0-9]{1,2}\/?[0-9]{2,4})/i);
        if (dataMatch && !result.date) {
            result.date = dataMatch[1];
        }
        // Laboratório
        const labMatch = line.match(/laborat[óo]rio[:\s]*([A-Za-zÁ-ÿ\s]+)/i);
        if (labMatch && !result.lab) {
            result.lab = labMatch[1].trim();
        }
        // Título do exame (ex.: Hemograma Completo)
        const titleMatch = line.match(/^(hemograma|exame|laudo|bioqu[íi]mico|sangue).+/i);
        if (titleMatch && !result.examTitle) {
            result.examTitle = titleMatch[0].trim();
        }
    }
    // Procurar linhas que contenham valores numéricos. O parser simples
    // considera a primeira ocorrência de um número na linha como valor.
    for (const line of lines) {
        if (!/[0-9]/.test(line))
            continue;
        // Separar tokens por espaço(s) ou tabulação
        const tokens = line.split(/\s+/).filter(Boolean);
        let valueIndex = -1;
        for (let i = 0; i < tokens.length; i++) {
            if (/^-?[0-9]+(?:[.,][0-9]+)?$/.test(tokens[i])) {
                valueIndex = i;
                break;
            }
        }
        if (valueIndex <= 0)
            continue;
        const paramTokens = tokens.slice(0, valueIndex);
        let valueToken = tokens[valueIndex];
        let unitToken = '';
        let refTokens = [];
        // Verificar se próximo token é unidade (contém letra ou símbolo %/u/µ) e não começa com número ou '('‐like
        if (tokens[valueIndex + 1] && /^[A-Za-z%/µ]+/.test(tokens[valueIndex + 1])) {
            unitToken = tokens[valueIndex + 1];
            refTokens = tokens.slice(valueIndex + 2);
        }
        else {
            refTokens = tokens.slice(valueIndex + 1);
        }
        // Caso existam tokens de referência separados por parênteses, juntar
        let ref = refTokens.join(' ').trim();
        // Remover parênteses se houver
        if (ref.startsWith('(') && ref.endsWith(')')) {
            ref = ref.slice(1, -1).trim();
        }
        // Param name
        const rawName = paramTokens.join(' ').replace(/:$/g, '').trim();
        if (!rawName)
            continue;
        // Valor numérico (substituir vírgula por ponto)
        const value = parseFloat(valueToken.replace(',', '.'));
        if (isNaN(value))
            continue;
        const item = {
            rawName,
            name: normalizeName(rawName),
            value,
            unit: unitToken || '',
            ref: ref || undefined,
            status: undefined,
        };
        // Determinar status baseado na referência
        if (item.ref) {
            const range = parseRange(item.ref);
            if (range) {
                const [min, max] = range;
                if (value < min)
                    item.status = 'Baixo';
                else if (value > max)
                    item.status = 'Alto';
                else
                    item.status = 'Normal';
            }
            else {
                item.status = 'Indeterminado';
            }
        }
        else {
            item.status = 'Indeterminado';
        }
        result.items.push(item);
    }
    return result;
}

/**
 * Tenta extrair valores mínimo e máximo de uma faixa de referência.
 * Suporta formatos como "12,0-16,0", "12.0 – 16.0", "12,0 a 16,0".
 */
export function parseRange(ref) {
    // Substituir vírgulas por pontos
    const cleaned = ref.replace(/,/, '.');
    // Capturar dois números separados por hífen, travessão ou "a"
    const m = cleaned.match(/([-+]?[0-9]*\.?[0-9]+)\s*[-–a]\s*([-+]?[0-9]*\.?[0-9]+)/i);
    if (m) {
        const min = parseFloat(m[1]);
        const max = parseFloat(m[2]);
        if (!isNaN(min) && !isNaN(max)) {
            return [min, max];
        }
    }
    return null;
}

/**
 * Formata uma lista de itens laboratoriais em uma linha corrida ordenada
 * conforme a ordem clínica sugerida. Itens não listados na ordem serão
 * colocados ao final, em ordem alfabética.
 */
export function formatLinhaProfissional(items) {
    const order = [
        'Hb', 'Ht', 'Leuco', 'Plaq', 'URE', 'CRE', 'NA', 'K', 'MG', 'CAI',
        'pH(a)', 'pO2(a)', 'pCO2(a)', 'HCO3(a)', 'BE(a)', 'SatO2(a)',
        'pH(v)', 'pO2(v)', 'pCO2(v)', 'HCO3(v)', 'BE(v)', 'SatO2(v)',
        'LAC', 'PCR', 'TnI', 'RDW', 'Neutro', 'Seg', 'Linf', 'Mono', 'Eos', 'Baso',
        'RNI', 'TTPA_rel'
    ];
    const orderIndex = {};
    order.forEach((name, idx) => (orderIndex[name] = idx));
    const sorted = [...items].sort((a, b) => {
        const ia = orderIndex[a.name] ?? Number.MAX_VALUE;
        const ib = orderIndex[b.name] ?? Number.MAX_VALUE;
        if (ia === ib)
            return a.name.localeCompare(b.name);
        return ia - ib;
    });
    return sorted
        .map((it) => `${it.name} ${it.value}${it.unit ? ' ' + it.unit : ''}`)
        .join('; ');
}

/**
 * Formata itens para exibição legível ao paciente. Mantém nomes
 * completos, valores com unidades e interpretações simples.
 */
export function formatPacienteLista(items) {
    return items.map((it) => {
        const nome = it.rawName;
        const valor = it.value.toString().replace('.', ',');
        const unidade = it.unit;
        const status = it.status || 'Indeterminado';
        return `${nome} — ${valor}${unidade ? ' ' + unidade : ''} — ${status.toLowerCase()}`;
    });
}