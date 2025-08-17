/*
 * Lógica da página do paciente.
 *
 * Esta página adiciona um ouvinte ao campo de upload de PDF e, quando um
 * arquivo é selecionado, utiliza a biblioteca PDF.js (carregada via CDN
 * em paciente.html) para ler o conteúdo textual do arquivo localmente. O
 * texto extraído é exibido em uma `<div>` na própria página e, em
 * seguida, é processado pelo parser para gerar as três saídas: linha
 * profissional, lista legível e JSON. Nenhuma informação é enviada
 * para servidores ou armazenada de forma persistente.
 */
import { parseReport, formatLinhaProfissional, formatPacienteLista } from '../lib/parse/report.js';

// Seleciona os elementos da página.
const fileInput = document.getElementById('pdfInput');
const output = document.getElementById('output');
const profissionalOutput = document.getElementById('profissionalOutput');
const pacienteOutput = document.getElementById('pacienteOutput');
const jsonOutput = document.getElementById('jsonOutput');

// Proteção: se o elemento não for encontrado (por exemplo, se o script for
// carregado em outra página), simplesmente não registra o listener.
if (fileInput && output) {
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) {
            return;
        }
        // Atualiza a interface enquanto o PDF é processado.
        output.textContent = 'Extraindo texto do PDF…';
        const reader = new FileReader();
        reader.onload = async () => {
            const arrayBuffer = reader.result;
            try {
                // Configura o caminho do worker da biblioteca PDF.js. Este arquivo é
                // carregado do CDN para evitar carregar scripts locais pesados.
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.10.111/build/pdf.worker.min.js';
                // Carrega o documento PDF a partir do ArrayBuffer.
                const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
                let text = '';
                // Itera sobre todas as páginas do PDF e concatena o texto.
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items
                        .map((item) => item.str)
                        .join(' ');
                    text += pageText + '\n';
                }
                const extractedText = text.trim();
                output.textContent = extractedText || 'Não foi possível extrair texto do PDF.';
                // Tenta interpretar o laudo se houver texto extraído.
                if (extractedText) {
                    const parsed = parseReport(extractedText);
                    // Linha profissional
                    if (profissionalOutput) {
                        profissionalOutput.textContent = formatLinhaProfissional(parsed.items);
                    }
                    // Lista legível
                    if (pacienteOutput) {
                        pacienteOutput.innerHTML = '';
                        const linhas = formatPacienteLista(parsed.items);
                        for (const linha of linhas) {
                            const li = document.createElement('li');
                            li.textContent = linha;
                            pacienteOutput.appendChild(li);
                        }
                    }
                    // JSON
                    if (jsonOutput) {
                        jsonOutput.textContent = JSON.stringify(parsed, null, 2);
                    }
                }
            }
            catch (err) {
                console.error(err);
                output.textContent = 'Erro ao ler o PDF.';
            }
        };
        reader.onerror = () => {
            output.textContent = 'Erro ao ler o arquivo.';
        };
        reader.readAsArrayBuffer(file);
    });
}