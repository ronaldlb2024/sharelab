/* public/js/worker.js
   Extrai texto com pdf.js dentro do seu Web Worker.
   Importa módulos: parse/normalize.js, ref.js, rules.js, parse.js, format.js
   e retorna {profissional, paciente, json}. Inclui diagnóstico detalhado.
*/

// ========== util de import com diagnóstico ==========
const DIAG = { imports: [] };
function safeImport(src) {
  try {
    self.importScripts(src);
    DIAG.imports.push({ src, ok: true });
  } catch (e) {
    const msg = String(e && e.message || e);
    DIAG.imports.push({ src, ok: false, error: msg });
    throw e;
  }
}

// ========== pdf.js (min + workerSrc explícito) ==========
(() => {
  let ok = false;
  try {
    // CDN (mesma versão nas duas URLs!)
    safeImport('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    ok = true;
  } catch (_) {}
  if (!ok) {
    try {
      // fallback local (ajuste se você hospeda esses arquivos)
      safeImport('/vendor/pdfjs/pdf.min.js');
      ok = true;
    } catch (e) {
      self.postMessage({ ok: false, error: 'Falha ao carregar pdf.js', diag: DIAG });
      return;
    }
  }
  if (self.pdfjsLib?.GlobalWorkerOptions) {
    self.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    // OU local:
    // self.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
  }
})();

// ========== importar seus módulos (sem index.js) ==========
try {
  safeImport('parse/normalize.js');
  safeImport('parse/ref.js');
  safeImport('parse/rules.js');
  safeImport('parse/parse.js');
  safeImport('parse/format.js');
  // opcional: anonimizador
  try { safeImport('lib/anonimizador.js'); } catch (_) {}
} catch (e) {
  self.postMessage({ ok: false, error: 'Falha ao importar módulos do parser', diag: DIAG });
  // aborta inicialização
}

// ========== reconstrução de linhas ==========
const Y_TOL = 2.0;
const GAP_AS_TAB = 40;

function reconstructLines(textContent) {
  const rows = [];
  for (const item of (textContent.items || [])) {
    const tr = item.transform || [1,0,0,1,0,0];
    const x = tr[4], y = tr[5], str = item.str || '';
    let row = rows.find(r => Math.abs(r.y - y) <= Y_TOL);
    if (!row) rows.push(row = { y, runs: [] });
    row.runs.push({ x, str });
  }
  rows.sort((a, b) => b.y - a.y);
  const lines = [];
  for (const row of rows) {
    row.runs.sort((a, b) => a.x - b.x);
    let s = '';
    for (let i = 0; i < row.runs.length; i++) {
      const cur = row.runs[i], prev = row.runs[i - 1];
      if (i > 0) s += (cur.x - prev.x > GAP_AS_TAB) ? '\t' : ' ';
      s += cur.str;
    }
    const clean = s.replace(/\u00A0/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
    if (clean) lines.push(clean);
  }
  return lines;
}

// ========== extrair pdf ==========
async function extractPdf(arrayBuffer) {
  if (!self.pdfjsLib) throw new Error('pdfjsLib não carregado');
  // NÃO usar workerPort. Apenas workerSrc definido acima.
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const all = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    all.push(...reconstructLines(tc));
  }
  return all;
}

// ========== anonimização mínima (fallback) ==========
function anonymizeLinesFallback(lines) {
  return lines.map(l =>
    l
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
      .replace(/\b(\d{2}\/){2}\d{4}\b/g, '[DATA]')
      .replace(/(Paciente|Nome|Conv[eê]nio)\s*:.*$/i, '$1: [REMOVIDO]')
  );
}

// ========== listener principal ==========
self.onmessage = async (ev) => {
  try {
    const { arrayBuffer } = ev.data || {};
    if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer do PDF não recebido');

    const lines = await extractPdf(arrayBuffer);
    const anon = (typeof self.anonimizeLines === 'function')
      ? self.anonimizeLines(lines)
      : anonymizeLinesFallback(lines);

    if (typeof self.parseLabReport !== 'function')
      throw new Error('parseLabReport ausente (cheque imports e caminhos de parse/*.js)');
    if (typeof self.formatOutputs !== 'function')
      throw new Error('formatOutputs ausente (cheque imports e caminhos de parse/*.js)');

    const parsed = self.parseLabReport(anon);
    const out = self.formatOutputs(parsed);

    self.postMessage({ ok: true, ...out, avisos: parsed.avisos || [], diag: DIAG });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err?.message || err), diag: DIAG });
  }
};
