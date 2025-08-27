/* public/js/worker.js
   Worker dedicado para extração local do PDF:
   - Carrega pdf.js via CDN dentro do worker.
   - Configura corretamente o GlobalWorkerOptions mesmo com disableWorker.
   - Extrai texto de todas as páginas.
   - Tenta usar /js/extractor.js (MVP canivete). Se não existir, devolve texto bruto.
*/

(function () {
  const DIAG = { steps: [] };
  function diag(msg, extra) {
    try { DIAG.steps.push({ t: Date.now(), msg, extra }); } catch {}
  }

  // Log leve pro chamador (não quebra fluxo)
  function log(m) { postMessage({ _log: m }); }

  // ---------- Carregamento de dependências no próprio worker ----------
  // 1) pdf.js (somente a lib principal; sem pdf.worker.* porque vamos desativar o worker interno)
  try {
    importScripts('https://cdn.jsdelivr.net/npm/pdf.js-dist@3.10.111/build/pdf.min.js');
    diag('pdfjs loaded');
  } catch (e) {
    postMessage({ ok: false, error: 'Falha ao carregar pdf.js no worker', diag: { ...DIAG, error: String(e) } });
    return;
  }

  // 2) Configurar o workerSrc mesmo com disableWorker (necessário para evitar o erro)
  try {
    if (self.pdfjsLib && self.pdfjsLib.GlobalWorkerOptions) {
      // Configura um workerSrc válido, mesmo que não seja usado com disableWorker
      self.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdf.js-dist@3.10.111/build/pdf.worker.min.js';
      diag('pdfjs workerSrc configured');
    }
  } catch (e) {
    diag('workerSrc config failed', String(e));
  }

  // 3) Extrator (opcional). Se existir no projeto, usamos. Senão, devolvemos texto simples.
  let extractFromText = null;
  try {
    // Caminho relativo ao worker. Ajuste se seu arquivo estiver em outro lugar.
    importScripts('js/extractor.js');
    if (typeof self.extractFromText === 'function') {
      extractFromText = self.extractFromText;
      diag('extractor.js loaded');
    } else {
      diag('extractor.js not found or no extractFromText');
    }
  } catch (e) {
    diag('extractor.js import failed', String(e));
  }

  // ---------- Funções de extração ----------
  async function extractTextFromPDF(arrayBuffer) {
    const loadingTask = self.pdfjsLib.getDocument({
      data: arrayBuffer,
      disableWorker: true,          // <- chave para não tentar criar outro worker
      useWorkerFetch: false,
    });

    const pdf = await loadingTask.promise;
    diag('pdf loaded', { numPages: pdf.numPages });

    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const strings = (content.items || []).map(it => it.str || '').join(' ');
      fullText += strings + '\n';
    }
    diag('text extracted', { length: fullText.length });
    return fullText;
  }

  // ---------- Montagem de saídas mínimas caso não haja extractor.js ----------
  function fallbackOutputs(rawText) {
    // Devolve o texto como "paciente" e uma linha profissional simples
    const prof = 'Texto extraído (' + rawText.length + ' chars).';
    const pac = rawText.slice(0, 8000); // evita estourar postMessage com PDFs enormes
    const json = { exame: { titulo: null, laboratorio: null, data: null }, itens: [] };
    return { profissional: prof, paciente: pac, json };
  }

  // ---------- Handler principal ----------
  self.onmessage = async (ev) => {
    try {
      const buf = ev.data && (ev.data.arrayBuffer || ev.data.buf || ev.data.pdf);
      if (!buf) {
        postMessage({ ok: false, error: 'Worker recebeu mensagem sem arrayBuffer', diag: DIAG });
        return;
      }
      diag('message received', { bytes: buf.byteLength });

      const text = await extractTextFromPDF(buf);

      let out;
      if (extractFromText) {
        try {
          const res = extractFromText(text);
          // Transforma res do extractor em nossas três vistas padrão.
          // Se o extractor já gera shareText, usamos como "paciente".
          const share = res && res.shareText ? res.shareText : null;
          const itens = (res && res.analytes) ? res.analytes.map(a => ({
            parametro_norm: a.key,
            rotulo: a.label,
            valor: a.value ? (a.value.val ?? null) : null,
            unidade: a.unit || null,
            ref: a.refText || null,
            status: a.flag ? a.flag.replace(/^\w/, c => c.toUpperCase()) : 'Indeterminado'
          })) : [];

          const profissional = (itens && itens.length)
            ? itens.map(it => {
                const v = (it.valor == null) ? '—' : String(it.valor);
                const u = it.unidade ? (' ' + it.unidade) : '';
                return `${it.parametro_norm} ${v}${u}`;
              }).join('; ')
            : '—';

          const paciente = (share && share.trim().length)
            ? share
            : (itens.length
                ? itens.map(it => {
                    const v = (it.valor == null) ? '—' : String(it.valor);
                    const u = it.unidade ? (' ' + it.unidade) : '';
                    const st = it.status && it.status !== 'Indeterminado' ? ` — ${it.status.toLowerCase()}` : '';
                    return `${it.rotulo || it.parametro_norm}: ${v}${u}${st}`;
                  }).join('\n')
                : text.slice(0, 8000));

          const json = {
            exame: { titulo: 'Exames de Análises Clínicas', laboratorio: null, data: null },
            itens
          };

          out = { profissional, paciente, json };
          diag('extractor outputs built', { items: itens.length });
        } catch (e) {
          diag('extractor error', String(e));
          out = fallbackOutputs(text);
        }
      } else {
        out = fallbackOutputs(text);
      }

      postMessage({ ok: true, ...out, diag: DIAG });
    } catch (err) {
      // Erro "falhou sem detalhes" resolvido aqui: sempre manda string legível
      const message = (err && (err.message || err.toString())) || 'Erro desconhecido';
      postMessage({ ok: false, error: message, diag: DIAG });
    }
  };

  // Captura falhas não tratadas dentro do worker
  self.addEventListener('error', (e) => {
    postMessage({ ok: false, error: e.message || 'worker error', diag: { ...DIAG, filename: e.filename, lineno: e.lineno } });
  });
  self.addEventListener('unhandledrejection', (e) => {
    const reason = e && e.reason ? (e.reason.message || String(e.reason)) : 'unhandledrejection';
    postMessage({ ok: false, error: reason, diag: DIAG });
  });

  log('worker ready');
})();
