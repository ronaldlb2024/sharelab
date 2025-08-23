/* public/js/worker.js
   Extrai texto de PDF com pdf.js dentro do SEU Web Worker (sem o worker interno do pdf.js),
   reconstrói linhas/colunas por posição, normaliza e formata as saídas.
*/

/* 1) Carregar somente a lib principal do pdf.js (NÃO carrega pdf.worker.min.js) */
(() => {
  try {
    // CDN estável
    self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  } catch (e) {
    // fallback local, se você servir em /vendor/pdfjs/pdf.min.js
    try { self.importScripts('/vendor/pdfjs/pdf.min.js'); } catch (_) {}
  }
})();

/* 2) Importar módulos de parsing/format (caminhos relativos ao próprio worker: /js/worker.js) */
self.importScripts('parse/normalize.js');
self.importScripts('parse/ref.js');
self.importScripts('parse/rules.js');
self.importScripts('parse/parse.js');
self.importScripts('parse/format.js');

/* 3) (Opcional) Anonimizador, se você tiver em lib/anonimizador.js */
let anonFn = null;
try {
  self.importScripts('lib/anonimizador.js');
  if (typeof self.anonimizeLines === 'function') anonFn = self.anonimizeLines;
} catch (_) { /* seguir com anonimização mínima */ }

/* Parâmetros de reconstrução de linhas */
const Y_TOL = 2.0;      // tolerância vertical (px) para agrupar na mesma linha
const GAP_AS_TAB = 40;  // gap horizontal (px) que vira TAB (separa colunas)

/* Reconstrói linhas preservando colunas, inserindo '\t' quando gap é grande */
function reconstructLines(textContent) {
  const rows = [];
  for (const item of textContent.items || []) {
    const tr = item.transform || [1,0,0,1,0,0];
    const x = tr[4], y = tr[5];
    const str = item.str || '';
    // agrupar por Y com tolerância
    let row = rows.find(r => Math.abs(r.y - y) <= Y_TOL);
    if (!row) {
      row = { y, runs: [] };
      rows.push(row);
    }
    row.runs.push({ x, str });
  }
  // ordenar linhas de cima (y maior) para baixo; dentro da linha, por X
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

/* Extrai todas as páginas em linhas reconstruídas (DESLIGA o worker interno do pdf.js) */
async function extractPdf(arrayBuffer) {
  if (!self.pdfjsLib) throw new Error('pdfjsLib não carregado.');
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableWorker: true,    // <- crítico: evita o erro com workerPort
    isEvalSupported: false,
    useWorkerFetch: false
  }).promise;

  const all = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const lines = reconstructLines(tc);
    all.push(...lines);
  }
  return all;
}

/* Anonimização mínima caso não exista anonimizador dedicado */
function anonymizeLinesFallback(lines) {
  return lines.map(l =>
    l
      // CPF (000.000.000-00 ou variações sem pontuação)
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
      // Datas dd/mm/aaaa
      .replace(/\b(\d{2}\/){2}\d{4}\b/g, '[DATA]')
      // Cabeçalhos comuns
      .replace(/(Paciente|Nome|Conv[eê]nio)\s*:.*$/i, '$1: [REMOVIDO]')
  );
}

/* Protocolo do worker */
self.onmessage = async (ev) => {
  try {
    const { arrayBuffer } = ev.data || {};
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error('ArrayBuffer do PDF não recebido.');
    }

    // 1) Ler PDF e reconstruir linhas
    const lines = await extractPdf(arrayBuffer);

    // 2) Anonimizar (usa anonimizador se presente; senão fallback)
    const anon = anonFn ? anonFn(lines) : anonymizeLinesFallback(lines);

    // 3) Parsear & formatar (funções importadas dos módulos)
    if (typeof parseLabReport !== 'function') throw new Error('Parser não disponível.');
    if (typeof formatOutputs !== 'function') throw new Error('Formatador não disponível.');

    const parsed = parseLabReport(anon);   // -> { exame, itens, avisos }
    const out = formatOutputs(parsed);     // -> { profissional, paciente, json }

    // 4) Responder à thread principal
    self.postMessage({ ok: true, ...out, avisos: parsed.avisos || [] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
