/* Versão alternativa minimalista */
importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

self.onmessage = async function(e) {
  try {
    const pdf = await pdfjsLib.getDocument({
      data: e.data.arrayBuffer,
      disableWorker: true
    }).promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }

    self.postMessage({ 
      ok: true, 
      profissional: 'Texto extraído', 
      paciente: text.substring(0, 8000),
      json: { exame: {}, itens: [] }
    });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message });
  }
};
