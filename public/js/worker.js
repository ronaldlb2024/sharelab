/* public/js/worker.js
   Extrai texto do PDF com pdf.js dentro do próprio Worker.
   - Carrega pdf.js via CDN (mesma versão do HTML: 3.10.111)
   - Seta GlobalWorkerOptions.workerSrc
   - Reconstrói linhas preservando colunas
   - Devolve { profissional, paciente, json } via formatOutputs()
*/

const CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.10.111/build';

function log(...args){ try { self.postMessage({ _log: args.map(String).join(' ') }); } catch {} }

// 1) Carregar pdf.js dentro do Worker
(function loadPdfjs() {
  try {
    // carrega núcleo (expondo pdfjsLib no escopo global do worker)
    importScripts(`${CDN}/pdf.min.js`);
    // setar caminho do worker secundário do pdf.js (necessário)
    if (self.pdfjsLib && self.pdfjsLib.GlobalWorkerOptions) {
      self.pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN}/pdf.worker.min.js`;
      log('pdfjs carregado no worker.');
    } else {
      throw new Error('pdfjsLib não exposto pelo pdf.min.js');
    }
  } catch (e) {
    // último recurso: tentar uma versão estável no cdnjs
    try {
      importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.min.js');
      if (self.pdfjsLib && self.pdfjsLib.GlobalWorkerOptions) {
        self.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js';
        log('fallback cdnjs ok.');
      } else {
        throw e;
      }
    } catch (e2) {
      // Se chegar aqui, não teremos pdfjs
      self._pdfLoadError = e2;
    }
  }
})();

// 2) Importar módulos de parsing/format
//    ATENÇÃO: caminhos relativos à pasta /public/js/
try {
  importScripts('/js/parse/normalize.js');
  importScripts('/js/parse/ref.js');
  importScripts('/js/parse/rules.js');
  importScripts('/js/parse/parse.js');
  importScripts('/js/parse/format.js');
} catch (e) {
  // fallback relativo (caso sirva /public como raiz sem barra)
  try {
    importScripts('parse/normalize.js', 'parse/ref.js', 'parse/rules.js', 'parse/parse.js', 'parse/format.js');
  } catch (e2) {
    self._parseLoadError = e2;
  }
}

// 3) Reconstrução de linhas/colunas
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

// 4) Extração do PDF
async function extractPdf(arrayBuffer) {
  if (!self.pdfjsLib) {
    const msg = 'pdfjsLib não carregado dentro do worker.';
    const detail = self._pdfLoadError ? ' Detalhe: ' + (self._pdfLoadError.message || String(self._pdfLoadError)) : '';
    throw new Error(msg + detail);
  }
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const all = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent(); // pode usar { includeMarkedContent: true } se precisar
    const lines = reconstructLines(tc);
    all.push(...lines);
  }
  return all;
}

// 5) Anonimização rápida (exemplo)
function anonymizeLines(lines) {
  return lines.map(l =>
    l
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
      .replace(/\b(\d{2}\/){2}\d{4}\b/g, '[DATA]')
      .replace(/(Paciente|Nome|Conv[eê]nio)\s*:.*$/i, '$1: [REMOVIDO]')
  );
}

// 6) Protocolo
self.onmessage = async (ev) => {
  try {
    if (self._parseLoadError) throw new Error('Falha ao carregar módulos de parsing: ' + (self._parseLoadError.message || self._parseLoadError));
    const { arrayBuffer } = ev.data || {};
    if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer do PDF não recebido.');
    const rawLines = await extractPdf(arrayBuffer);
    log('linhas extraídas:', rawLines.length);

    const anon = anonymizeLines(rawLines);
    if (typeof parseLabReport !== 'function' || typeof formatOutputs !== 'function') {
      throw new Error('Parser/formatador não disponível no worker (verifique importScripts de /js/parse/*).');
    }

    const parsed = parseLabReport(anon);
    const out = formatOutputs(parsed);
    self.postMessage({ ok: true, ...out, avisos: parsed.avisos || [] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
