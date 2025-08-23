/* public/js/worker.js
   Extrai texto de PDF com pdf.js dentro do SEU Web Worker.
   Aqui deixamos o pdf.js usar o worker interno, indicando explicitamente o workerSrc.
*/

(() => {
  // 1) Carregar pdf.js
  let loaded = false;
  try {
    // CDN
    self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    loaded = true;
  } catch (_) {}
  if (!loaded) {
    try {
      // Fallback local (ajuste se você hospeda o pdf.js localmente)
      self.importScripts('/vendor/pdfjs/pdf.min.js');
      loaded = true;
    } catch (e) {
      // Se não carregou, falhar cedo
      self.postMessage({ ok: false, error: 'Falha ao carregar pdf.js' });
    }
  }

  // 2) Informar ONDE está o worker interno do pdf.js
  //    Use a mesma versão do min.js acima para evitar mismatch.
  if (self.pdfjsLib && self.pdfjsLib.GlobalWorkerOptions) {
    // Caminho via CDN:
    self.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // Se você preferir servir localmente, comente a linha acima e descomente esta:
    // self.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
  }
})();

// 3) Módulos do parser/formatador (caminhos relativos a /public/js/worker.js)
self.importScripts('parse/normalize.js');
self.importScripts('parse/ref.js');
self.importScripts('parse/rules.js');
self.importScripts('parse/parse.js');
self.importScripts('parse/format.js');

// (Opcional) anonimizador em /public/js/lib/anonimizador.js, se existir
let anonFn = null;
try {
  self.importScripts('lib/anonimizador.js');
  if (typeof self.anonimizeLines === 'function') anonFn = self.anonimizeLines;
} catch (_) { /* ignorar */ }

const Y_TOL = 2.0;
const GAP_AS_TAB = 40;

function reconstructLines(textContent) {
  const rows = [];
  for (const item of textContent.items || []) {
    const tr = item.transform || [1,0,0,1,0,0];
    const x = tr[4], y = tr[5];
    const str = item.str || '';
    let row = rows.find(r => Math.abs(r.y - y) <= Y_TOL);
    if (!row) { row = { y, runs: [] }; rows.push(row); }
    row.runs.push({ x, str });
  }
  rows.sort((a,b) => b.y - a.y);
  const lines = [];
  for (const row of rows) {
    row.runs.sort((a,b) => a.x - b.x);
    let acc = '';
    for (let i = 0; i < row.runs.length; i++) {
      const cur = row.runs[i];
      const prev = row.runs[i-1];
      if (i > 0) acc += (cur.x - prev.x > GAP_AS_TAB) ? '\t' : ' ';
      acc += cur.str;
    }
    const clean = acc.replace(/\u00A0/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
    if (clean) lines.push(clean);
  }
  return lines;
}

async function extractPdf(arrayBuffer) {
  if (!self.pdfjsLib) throw new Error('pdfjsLib não carregado.');
  // NÃO setar workerPort. Apenas usamos workerSrc (acima).
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

function anonymizeLinesFallback(lines) {
  return lines.map(l =>
    l
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
      .replace(/\b(\d{2}\/){2}\d{4}\b/g, '[DATA]')
      .replace(/(Paciente|Nome|Conv[eê]nio)\s*:.*$/i, '$1: [REMOVIDO]')
  );
}

self.onmessage = async (ev) => {
  try {
    const { arrayBuffer } = ev.data || {};
    if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer do PDF não recebido.');

    const lines = await extractPdf(arrayBuffer);
    const anon = anonFn ? anonFn(lines) : anonymizeLinesFallback(lines);

    if (typeof parseLabReport !== 'function') throw new Error('Parser não disponível.');
    if (typeof formatOutputs !== 'function') throw new Error('Formatador não disponível.');

    const parsed = parseLabReport(anon);
    const out = formatOutputs(parsed);

    self.postMessage({ ok: true, ...out, avisos: parsed.avisos || [] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
