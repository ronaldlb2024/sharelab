/* public/js/worker.js
   Web Worker: recebe ArrayBuffer do PDF, usa pdf.js para extrair texto,
   reconstrói linhas/colunas por posição, chama o parser e devolve {profissional, paciente, json}.
*/

// --- Carregamento do pdf.js (tenta local; cai para CDN se não houver) ---
(() => {
  try {
    // ajuste estes caminhos se você já serve pdf.js localmente
    self.importScripts('/vendor/pdfjs/pdf.min.js', '/vendor/pdfjs/pdf.worker.min.js');
  } catch (e) {
    // fallback: CDN (versão estável)
    self.importScripts(
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    );
  }
})();

// --- Módulos locais do parser/formatador ---
self.importScripts('/js/parse/normalize.js');
self.importScripts('/js/parse/ref.js');
self.importScripts('/js/parse/rules.js');
self.importScripts('/js/parse/parse.js');
self.importScripts('/js/parse/format.js');

// --- Parâmetros de reconstrução de linhas ---
const Y_TOL = 2.0;      // tolerância (px) para agrupar items na mesma linha
const GAP_AS_TAB = 40;  // gap horizontal (px) que vira TAB (colunas)

// Reconstrói linhas preservando colunas (inserindo '\t' quando gap é grande)
function reconstructLines(textContent) {
  const rows = [];
  for (const item of textContent.items || []) {
    const tr = item.transform || [1,0,0,1,0,0];
    const x = tr[4], y = tr[5];
    const str = item.str || '';
    // agrupar por Y
    let row = rows.find(r => Math.abs(r.y - y) <= Y_TOL);
    if (!row) {
      row = { y, runs: [] };
      rows.push(row);
    }
    row.runs.push({ x, str });
  }
  // ordenar linhas de cima para baixo; runs por x
  rows.sort((a,b) => b.y - a.y);
  const lines = [];
  for (const row of rows) {
    row.runs.sort((a,b) => a.x - b.x);
    let acc = '';
    for (let i = 0; i < row.runs.length; i++) {
      const cur = row.runs[i];
      const prev = row.runs[i-1];
      if (i > 0) {
        const gap = cur.x - prev.x;
        acc += (gap > GAP_AS_TAB) ? '\t' : ' ';
      }
      acc += cur.str;
    }
    const clean = acc.replace(/\u00A0/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
    if (clean) lines.push(clean);
  }
  return lines;
}

// Extrai todas as páginas como linhas reconstruídas
async function extractPdf(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const all = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const lines = reconstructLines(tc);
    all.push(...lines);
  }
  return all;
}

// Anonimização mínima (substitua por seu anonimizador.js se quiser)
function anonymizeLines(lines) {
  return lines.map(l =>
    l
      // CPF
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
      // datas dd/mm/aaaa
      .replace(/\b(\d{2}\/){2}\d{4}\b/g, '[DATA]')
      // cabeçalhos típicos
      .replace(/(Paciente|Nome|Conv[eê]nio)\s*:.*$/i, '$1: [REMOVIDO]')
  );
}

// Protocolo do worker
self.onmessage = async (ev) => {
  try {
    const { arrayBuffer } = ev.data || {};
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error('ArrayBuffer do PDF não recebido.');
    }

    // 1) ler PDF e reconstruir linhas
    const lines = await extractPdf(arrayBuffer);

    // 2) anonimizar antes de parsear
    const anon = anonymizeLines(lines);

    // 3) parsear (módulos importados acima)
    const parsed = parseLabReport(anon);   // -> { exame, itens, avisos }
    const out = formatOutputs(parsed);     // -> { profissional, paciente, json }

    // 4) devolver para a UI
    self.postMessage({ ok: true, ...out, avisos: parsed.avisos || [] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
