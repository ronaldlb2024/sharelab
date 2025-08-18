// public/js/pages/paciente.js
import { parseReport, parseReportLoose, formatLinhaProfissional, formatListaPaciente } from '../lib/parse/report.js';

window.addEventListener('DOMContentLoaded', () => {
  // Elementos da UI
  const input        = document.getElementById('pdfInput');
  const rawOut       = document.getElementById('output');
  const proOut       = document.getElementById('profissionalOutput');
  const pacOut       = document.getElementById('pacienteOutput');
  const jsonOut      = document.getElementById('jsonOutput');
  const codeDisplay  = document.getElementById('sessionCodeDisplay');
  const genBtn       = document.getElementById('generateCodeBtn');
  const connBtn      = document.getElementById('connectBtn');
  const statusEl     = document.getElementById('p2pStatus');

  // Estado global
  let latestPayload = null;
  let currentCode   = null;
  let pc            = null;

  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; console.log('[P2P]', msg); };
  const genCode   = () => String(Math.floor(100000 + Math.random()*900000));
  const showCode  = (code) => {
    currentCode = code;
    if (codeDisplay) codeDisplay.textContent = code.replace(/(...)(...)/, '$1 $2');
  };

  // Firebase
  function initFirebase() {
    if (!window.FIREBASE_CONFIG) { setStatus('firebase-config.js ausente'); throw new Error('FIREBASE_CONFIG missing'); }
    if (!window.firebase?.apps?.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
    return window.firebase.database();
  }

  // WebRTC (envio)
  async function connectAndSend() {
    if (!currentCode) { setStatus('Gere o código antes de conectar.'); return; }
    if (!latestPayload) { setStatus('Faça a extração antes de conectar.'); return; }

    const db = initFirebase();
    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const dc = pc.createDataChannel('data');

    pc.onicecandidate = (ev) => {
      if (ev.candidate) db.ref(`webrtc/${currentCode}/ice/paciente`).push(JSON.stringify(ev.candidate));
    };
    db.ref(`webrtc/${currentCode}/ice/medico`).on('child_added', (snap) => {
      try {
        const cand = JSON.parse(snap.val());
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
      } catch (e) { console.error(e); }
    });

    dc.onopen = () => {
      try { dc.send(JSON.stringify(latestPayload)); setStatus('Enviado ao médico via P2P.'); }
      catch (e) { console.error(e); setStatus('Falha ao enviar payload.'); }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await db.ref(`webrtc/${currentCode}/offer`).set(JSON.stringify(offer));
    setStatus('Offer publicada. Aguardando médico…');

    db.ref(`webrtc/${currentCode}/answer`).on('value', async (snap) => {
      const val = snap.val();
      if (!val) return;
      const answer = JSON.parse(val);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setStatus('Conectado. Enviando dados…');
    });
  }

  // Eventos de UI
  genBtn?.addEventListener('click', () => {
    showCode(genCode());
    setStatus('Código gerado. Passe ao médico.');
  });
  if (!currentCode) showCode(genCode());

  connBtn?.addEventListener('click', () => {
    connectAndSend().catch((e) => { console.error(e); setStatus('Erro ao conectar. Veja console.'); });
  });

  // Extração do PDF
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Configurar worker do PDF.js
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.10.111/build/pdf.worker.min.js';
      }
      const buffer = await file.arrayBuffer();
      const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
      let text     = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it) => it.str).join('\n') + '\n';
      }
      if (rawOut) rawOut.textContent = text.slice(0, 8000) || '—';
      // Parser: primeiro tentamos o parse "estrito"
      let base = parseReport(text);
      if (!base.itens || base.itens.length < 3) {
        const loose = parseReportLoose(text);
        if (loose.itens.length > (base.itens?.length || 0)) base = loose;
      }
      const linha = formatLinhaProfissional(base.itens);
      const lista = formatListaPaciente(base.itens);

      if (proOut) proOut.textContent = linha || '—';
      if (pacOut) {
        pacOut.innerHTML = '';
        (lista || []).forEach((li) => {
          const el = document.createElement('li');
          el.textContent = li;
          pacOut.appendChild(el);
        });
      }
      const json = { paciente: base.paciente, exame: base.exame, itens: base.itens };
      if (jsonOut) jsonOut.textContent = JSON.stringify(json, null, 2);
      latestPayload = { profissional: linha || '', paciente: lista || [], json };
      setStatus('Pronto para enviar. Clique em “Conectar & Enviar”.');
    } catch (err) {
      if (rawOut) rawOut.textContent = 'Erro ao ler PDF: ' + (err?.message || String(err));
      console.error(err);
    }
  });
});
