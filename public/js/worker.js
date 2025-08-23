/* public/js/worker.js
   Extrai texto de PDF com pdf.js rodando DENTRO deste Web Worker.
   - Usa este worker como worker do pdf.js (sem fake worker).
   - Importa js/parse/*.js a partir da URL do próprio worker.
   - Retorna mensagens de erro detalhadas (name/message/stack) e logs via _log.
*/

function postLog(...args) {
  try { self.postMessage({ _log: args.join(' ') }); } catch {}
}
function toErrString(err) {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  const name = err.name || 'Error';
  const msg  = err.message || String(err);
  const stk  = err.stack ? `\nstack: ${err.stack}` : '';
  return `${name}: ${msg}${stk}`;
}

const CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.10.111/build';

// ---------- Carregar pdf.js e apontar para ESTE worker ----------
(function loadPdfjs() {
  try {
    importScripts(`${CDN}/pdf.min.js`);
    if (!self.pdfjsLib) throw new Error('pdfjsLib não exposto');
    // use ESTE worker; evita fake worker e "document is not defined"
    pdfjsLib.GlobalWorkerOptions.workerPort = self;
    pdfjsLib.GlobalWorkerOptions.workerSrc  = null;
    postLog('pdf.js carregado do jsDelivr');
  } catch (e1) {
    try {
      importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.min.js');
      if (!self.pdfjsLib) throw e1;
      pdfjsLib.GlobalWorkerOptions.workerPort = self;
      pdfjsLib.GlobalWorkerOptions.workerSrc  = null;
      postLog('pdf.js carregado do cdnjs');
    } catch (e2) {
      self._pdfLoadError = e2;
    }
  }
})();

// ---------- Importar módulos de parsing/format ----------
(function importParseModules() {
  const WORKER_BASE = self.location.href.replace(/\/worker\.js(?:\?.*)?$/, ''); // .../js
  const mods = [
    `${WORKER_BASE}/parse/normalize.js`,
    `${WORKER_BASE}/parse/ref.js`,
    `${WORKER_BASE}/parse/rules.js`,
    `${WORKER_BASE}/parse/parse.js`,
    `${WORKER_BASE}/parse/format.js`,
  ];
  const failed = [];
  for (const m of mods) {
    try {
      importScripts(m);
      postLog('importScripts OK:', m);
    } catch (e) {
      failed.push(`${m} -> ${toErrString(e)}`);
    }
  }
  if (failed.length) {
    self._parseLoadError = new Error('Falha ao importar módulos:\n' + failed.join('\n'));
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
    throw new Error('pdfjsLib não carregado: ' + toErrString(self._pdfLoadError));
  }
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;

  const all = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const lines = reconstructLines(tc);
    all.push(...lines);
  }
  return all;
}

// ---------- Anonimização ----------
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
    if (self._parseLoadError) {
      throw self._parseLoadError;
    }
    const { arrayBuffer } = ev.data || {};
    if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer do PDF não recebido.');

    const rawLines = await extractPdf(arrayBuffer);
    postLog('linhas extraídas:', String(rawLines.length));
    if (!rawLines.length) {
      throw new Error('PDF sem texto extraível (talvez escaneado).');
    }

    if (typeof parseLabReport !== 'function' || typeof formatOutputs !== 'function') {
      throw new Error('Parser/formatador não encontrado (verifique js/parse/*.js).');
    }

    const anon = anonymizeLines(rawLines);
    const parsed = parseLabReport(anon);
    const out = formatOutputs(parsed);
    self.postMessage({ ok: true, ...out, avisos: parsed.avisos || [] });
  } catch (err) {
    self.postMessage({ ok: false, error: toErrString(err) });
  }
};
