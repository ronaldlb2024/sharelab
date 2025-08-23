// public/js/pages/paciente.js
import { anonimizar } from '../lib/anonimizador.js';
import { detectParser } from '../lib/parsers/index.js';
import { formatLinhaProfissional, formatListaPaciente } from '../lib/parse/report.js';

window.addEventListener('DOMContentLoaded', () => {
  // ... (mantém as variáveis de UI e inicialização de Firebase como estão)

  let payload = null; // armazenará linha clínica, lista e json para enviar ao médico

  // ... (gera código e conecta; permanece igual)

  // Extração e pipeline completa
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Extrai texto de todas as páginas (como já faz)
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let texto = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        texto += content.items.map(it => it.str).join('\n') + '\n';
      }

      // 1) Anonimiza o texto
      const anon = anonimizar(texto);

      // 2) Detecta o parser
      const parser = detectParser(anon);

      // 3) Executa o parser específico (retorna paciente, exame e itens)
      const parsed = parser(anon);

      // 4) Formata a linha profissional e a lista legível
      const linha  = formatLinhaProfissional(parsed.itens);
      const lista  = formatListaPaciente(parsed.itens);

      // 5) Monta payload para enviar ao médico
      payload = {
        profissional: linha || '',
        paciente: lista || [],
        json: { paciente: parsed.paciente, exame: parsed.exame, itens: parsed.itens }
      };

      // Define linhaClinica (ou status) para exibir se quiser
      setStatus(linha ? 'Pronto para enviar.' : 'Não foi possível extrair exames.');
    } catch (err) {
      console.error(err);
      setStatus('Erro ao ler PDF.');
    }
  });

  // Modifique a função connectAndSend para enviar `payload` inteiro (não só linhaClinica)
  async function connectAndSend() {
    if (!currentCode) { setStatus('Gere o código antes de conectar.'); return; }
    if (!payload) { setStatus('Selecione um PDF primeiro.'); return; }

    const db = initFirebase();
    pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });
    const dc = pc.createDataChannel('data');

    // ... (Ice handling permanece o mesmo)

    dc.onopen = () => {
      dc.send(JSON.stringify(payload));
      setStatus('Enviado ao médico via P2P.');
      // opcional: remover sinalização
    };

    // ... (resto do connectAndSend permanece igual)
  }

  // ... (eventos para gerar código e conectar permanecem iguais)
});
