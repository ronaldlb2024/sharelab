/* public/js/worker.js */
(function () {
  const DIAG = { steps: [] };
  function diag(msg, extra) {
    try { DIAG.steps.push({ t: Date.now(), msg, extra }); } catch {}
  }

  function log(m) { postMessage({ _log: m }); }

  // ---------- Carregamento do PDF.js ----------
  try {
    // Carrega a versão completa do PDF.js que inclui o worker interno
    importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    diag('pdfjs loaded');
    
    // Configuração CORRETA do workerSrc - mesmo com disableWorker: true, isso é necessário
    if (self.pdfjsLib && self.pdfjsLib.GlobalWorkerOptions) {
      self.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      diag('workerSrc configured');
    }
  } catch (e) {
    postMessage({ ok: false, error: 'Falha ao carregar pdf.js: ' + e.message, diag: DIAG });
    return;
  }

  // ---------- Extrator (opcional) ----------
  let extractFromText = null;
  try {
    importScripts('/js/extractor.js');
    if (typeof self.extractFromText === 'function') {
      extractFromText = self.extractFromText;
      diag('extractor.js loaded');
    }
  } catch (e) {
    diag('extractor.js não carregado', e.message);
  }

  // ---------- Função de extração de texto ----------
  async function extractTextFromPDF(arrayBuffer) {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableWorker: true,    // Não usar worker secundário
        useWorkerFetch: false,
        isEvalSupported: false
      });

      const pdf = await loadingTask.promise;
      diag('PDF carregado', { pages: pdf.numPages });

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      return fullText;
    } catch (error) {
      throw new Error('Falha na extração do texto: ' + error.message);
    }
  }

  // ---------- Fallback se não tiver extractor ----------
  function fallbackOutputs(rawText) {
    return {
      profissional: 'Texto extraído (' + rawText.length + ' caracteres)',
      paciente: rawText.length > 8000 ? rawText.substring(0, 8000) + '...' : rawText,
      json: { 
        exame: { titulo: null, laboratorio: null, data: null }, 
        itens: [] 
      }
    };
  }

  // ---------- Handler principal ----------
  self.onmessage = async function(event) {
    try {
      const data = event.data;
      if (!data || !data.arrayBuffer) {
        throw new Error('Nenhum PDF recebido');
      }

      diag('Iniciando extração', { size: data.arrayBuffer.byteLength });
      
      const text = await extractTextFromPDF(data.arrayBuffer);
      diag('Texto extraído', { length: text.length });

      let result;
      if (extractFromText) {
        try {
          const extracted = extractFromText(text);
          // Converte o formato do extrator para o formato esperado
          result = {
            profissional: extracted.shareText || 'Dados extraídos',
            paciente: text.substring(0, 8000),
            json: {
              exame: { titulo: 'Exame Laboratorial', laboratorio: null, data: null },
              itens: extracted.analytes ? extracted.analytes.map(item => ({
                parametro_norm: item.key,
                rotulo: item.label,
                valor: item.value?.val || null,
                unidade: item.unit || null,
                ref: item.refText || null,
                status: item.flag || 'Indeterminado'
              })) : []
            }
          };
        } catch (extractError) {
          diag('Erro no extrator', extractError.message);
          result = fallbackOutputs(text);
        }
      } else {
        result = fallbackOutputs(text);
      }

      postMessage({ ok: true, ...result, diag: DIAG });

    } catch (error) {
      postMessage({ 
        ok: false, 
        error: error.message || 'Erro desconhecido no worker',
        diag: DIAG 
      });
    }
  };

  // ---------- Tratamento de erros globais ----------
  self.onerror = function(error) {
    postMessage({ 
      ok: false, 
      error: 'Erro global no worker: ' + error.message,
      diag: DIAG 
    });
  };

  log('Worker de PDF inicializado com sucesso');

})();
