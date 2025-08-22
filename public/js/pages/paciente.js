// js/pages/paciente.js

// ---------- UI refs ----------
const pdfInput = document.getElementById('pdfInput');
const pdfStatus = document.getElementById('pdfStatus');
const pdfPreview = document.getElementById('pdfPreview');

// (Se já tiver estes botões/fluxo de sessão P2P, mantenha-os)
const codeEl = document.getElementById('sessionCodeDisplay');
const btnCode = document.getElementById('generateCodeBtn');
const btnConnect = document.getElementById('connectBtn');
const p2pStatus = document.getElementById('p2pStatus');

// ---------- Utils ----------
function setStatus(msg, ok = true) {
  pdfStatus.textContent = msg || '';
  pdfStatus.className = ok ? 'muted ok' : 'muted err';
}

// Extrai o texto de uma página do PDF
async function extractPageText(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  // Junta os "items" na ordem
  return content.items.map(it => it.str).join(' ');
}

// Lê o arquivo selecionado e retorna ArrayBuffer
function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(file);
  });
}

// ---------- Carregamento do PDF do input ----------
pdfInput?.addEventListener('change', async () => {
  try {
    if (!pdfInput.files || !pdfInput.files[0]) {
      setStatus('Nenhum arquivo selecionado.', false);
      return;
    }
    const file = pdfInput.files[0];
    if (!/\.pdf$/i.test(file.name)) {
      setStatus('Selecione um arquivo PDF válido.', false);
      return;
    }

    setStatus('Lendo arquivo PDF…');
    const ab = await fileToArrayBuffer(file);

    // IMPORTANTE: use {data: ab} para evitar CORS
    const loadingTask = pdfjsLib.getDocument({ data: ab });
    const pdf = await loadingTask.promise;

    setStatus(`PDF carregado: ${pdf.numPages} página(s). Extraindo texto…`);
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const pageText = await extractPageText(pdf, p);
      fullText += (p > 1 ? '\n\n' : '') + pageText;
    }

    // Mostra prévia e mantém em memória para o próximo passo (extrator/normalizador)
    pdfPreview.value = fullText || '(Sem texto extraível — se o PDF for imagem digitalizada, será preciso OCR)';

    setStatus('Texto extraído com sucesso.');
  } catch (err) {
    console.error(err);
    setStatus('Falha ao carregar/extrair o PDF. Verifique o arquivo e tente novamente.', false);
  }
});

// ---------- (Opcional) Integração com seu extrator/normalizador ----------
// Aqui você pode chamar a sua função de normalização extraindo do pdfPreview.value.
// Ex.: const linhaProfissional = normalizarExame(pdfPreview.value);

// ---------- (Opcional) Geração de código de sessão e envio P2P ----------
// Mantenha seu fluxo Firebase/WebRTC existente; a seguir só placeholders:

btnCode?.addEventListener('click', () => {
  // gere/exiba seu código de sessão (placeholder)
  codeEl.textContent = String(Math.floor(100000 + Math.random()*900000));
});

btnConnect?.addEventListener('click', async () => {
  // aqui você conecta via WebRTC ou envia via mecanismo escolhido
  // enviando, por exemplo, pdfPreview.value já normalizado
  p2pStatus.textContent = 'Conectando… (implemente sua lógica P2P aqui)';
});
