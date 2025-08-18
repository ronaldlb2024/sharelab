// public/js/pages/paciente.js
import { parseReport, parseReportLoose, formatLinhaProfissional, formatListaPaciente } from '../lib/parse/report.js';

const input = document.getElementById('pdfInput');
const rawOut = document.getElementById('output');
const proOut = document.getElementById('profissionalOutput');
const pacOut = document.getElementById('pacienteOutput');
const jsonOut = document.getElementById('jsonOutput');

input?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const array = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: array }).promise;
    let text = '';
    for (let i=1;i<=pdf.numPages;i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join('\n') + '\n';
    }
    rawOut.textContent = text.slice(0, 8000);

    let base = parseReport(text);
    if (!base.itens || base.itens.length < 3) {
      const loose = parseReportLoose(text);
      if (loose.itens.length > (base.itens?.length || 0)) base = loose;
    }

    const linha = formatLinhaProfissional(base.itens);
    const lista = formatListaPaciente(base.itens);

    proOut.textContent = linha || '—';
    pacOut.innerHTML = '';
    lista.forEach(li => {
      const el = document.createElement('li');
      el.textContent = li;
      pacOut.appendChild(el);
    });

    const json = { paciente: base.paciente, exame: base.exame, itens: base.itens };
    jsonOut.textContent = JSON.stringify(json, null, 2);
  } catch (err) {
    rawOut.textContent = 'Erro ao ler PDF: ' + (err && err.message ? err.message : String(err));
  }
});
