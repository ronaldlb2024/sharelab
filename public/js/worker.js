/* Versão alternativa minimalista
 * Este worker utiliza pdf.js para extrair texto de um PDF de forma
 * completamente offline. A extração simplificada retorna apenas o texto
 * cru (limitado a 8000 caracteres), além de um campo JSON vazio para
 * compatibilidade futura com as funções de análise.
 */
importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');

// Define o worker script do pdf.js. Quando hospedado externamente é
// necessário apontar explicitamente para o arquivo de worker.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

self.onmessage = async function (e) {
  try {
    const pdf = await pdfjsLib
      .getDocument({ data: e.data.arrayBuffer, disableWorker: true })
      .promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(' ') + '\n';
    }
    self.postMessage({
      ok: true,
      profissional: 'Texto extraído',
      paciente: text.substring(0, 8000),
      json: { exame: {}, itens: [] },
    });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message });
  }
};
