/* public/js/worker.js
   Extrai texto de PDF com pdf.js dentro de um Worker.
   - pdf.js rodando com disableWorker=true (não tenta criar fake worker).
   - Importa módulos de parsing/format a partir da mesma pasta js/.
   - Reconstrói linhas preservando colunas.
*/

const CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.10.111/build';

(function loadPdfjs() {
  try {
    importScripts(`${CDN}/pdf.min.js`);
    if (!self.pdfjsLib) throw new Error('pdfjsLib não exposto');

    // rodando já num Web Worker → desabilita o worker interno
    pdfjsLib.GlobalWorkerOptions.disableWorker = true;
  } catch (e) {
    try {
      importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.min.js');
      if (!self.pdfjsLib) throw e;
      pdfjsLib.GlobalWorkerOptions.disableWorker = true;
    } catch (e2) {
      self._pdfLoadError = e2;
    }
  }
})();

// Importar módulos de parsing/format (usando base relativa à URL do worker)
(function importParseModules() {
  const WORKER_BASE = self.location.href.replace(/\/worker\.js(?:\?.*)?$/, '');
  try {
    importScripts(
      `${WORKER_BASE}/parse/normalize.js`,
      `${WORKER_BASE}/parse/ref.js`,
      `${WORKER_BASE}/parse/rules.js`,
      `${WORKER_BASE}/parse/parse.js`,
      `${WORKER_BASE}/parse/format.js`
    );
  } catch (e) {
    self._parseLoadError = e;
  }
})();

// ---------- Reconstrução de linhas ----------
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
    for (let i=0;i<row.runs.length;i++){
      const cur = row.runs[i], prev = row.runs[i-1];
      if (i>0) acc += (cur.x - prev.x > GAP_AS_TAB) ? '\t' : ' ';
      acc += cur.str;
    }
    const clean = acc.replace(/\u00A0/g,' ').replace(/[ ]{2,}/g,' ').trim();
    if (clean) lines.push(clean);
  }
  return lines;
}

// ---------- Extração ----------
async function extractPdf(arrayBuffer) {
  if (!self.pdfjsLib) {
    const msg = 'pdfjsLib não carregado.';
    throw new Error(msg + (self._pdfLoadError ? ' ' + self._pdfLoadError : ''));
  }
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

// ---------- Anonimização simples ----------
function anonymizeLines(lines) {
  return lines.map(l =>
    l
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
      .replace(/\b(\d{2}\/){2}\d{4}\b/g, '[DATA]')
      .replace(/(Paciente|Nome|Conv[eê]nio)\s*:.*$/i, '$1: [REMOVIDO]')
  );
}

// ---------- Protocolo ----------
self.onmessage = async (ev) => {
  try {
    if (self._parseLoadError) throw new Error('Falha ao carregar módulos de parsing: ' + self._parseLoadError);

    const { arrayBuffer } = ev.data || {};
    if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer do PDF não recebido.');

    const rawLines = await extractPdf(arrayBuffer);
    const anon = anonymizeLines(rawLines);

    if (typeof parseLabReport !== 'function' || typeof formatOutputs !== 'function') {
      throw new Error('Parser ou formatOutputs não definidos (verifique js/parse/*.js).');
    }

    const parsed = parseLabReport(anon);
    const out = formatOutputs(parsed);

    self.postMessage({ ok: true, ...out, avisos: parsed.avisos || [] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
