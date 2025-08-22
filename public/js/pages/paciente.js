// public/js/pages/paciente.js
import { parseReport, parseReportLoose, formatLinhaProfissional } from '../lib/parse/report.js';

window.addEventListener('DOMContentLoaded', () => {
  // Elementos
  const input   = document.getElementById('pdfInput');
  const codeEl  = document.getElementById('sessionCodeDisplay');
  const genBtn  = document.getElementById('generateCodeBtn');
  const connBtn = document.getElementById('connectBtn');
  const statusEl= document.getElementById('p2pStatus');

  // Estado
  let linhaClinica = '';   // único campo a enviar
  let currentCode  = null;
  let pc           = null;

  // Helpers UI
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
  const genCode   = () => String(Math.floor(100000 + Math.random()*900000));
  const showCode  = (code) => {
    currentCode = code;
    if (codeEl) codeEl.textContent = code.replace(/(...)(...)/, '$1 $2');
  };

  // Firebase
  function initFirebase(){
    if (!window.FIREBASE_CONFIG) { setStatus('firebase-config.js ausente'); throw new Error('FIREBASE_CONFIG missing'); }
    if (!window.firebase?.apps?.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
    return window.firebase.database();
  }

  // WebRTC (envio)
  async function connectAndSend(){
    if (!currentCode){ setStatus('Gere o código antes de conectar.'); return; }
    if (!linhaClinica){ setStatus('Selecione um PDF primeiro.'); return; }

    const db = initFirebase();
    pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });
    const dc = pc.createDataChannel('data');

    pc.onicecandidate = (ev) => {
      if (ev.candidate) db.ref(`webrtc/${currentCode}/ice/paciente`).push(JSON.stringify(ev.candidate));
    };
    db.ref(`webrtc/${currentCode}/ice/medico`).on('child_added', (snap) => {
      try { pc.addIceCandidate(new RTCIceCandidate(JSON.parse(snap.val()))).catch(console.error); }
      catch(e){ console.error(e); }
    });

    dc.onopen = async () => {
      try {
        dc.send(JSON.stringify({ profissional: linhaClinica }));
        setStatus('Enviado ao médico via P2P.');
        // opcional: limpar sinalização depois
        setTimeout(()=> db.ref(`webrtc/${currentCode}`).remove().catch(()=>{}), 3000);
      } catch(e){
        console.error(e); setStatus('Falha ao enviar.');
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await db.ref(`webrtc/${currentCode}/offer`).set(JSON.stringify(offer));
    setStatus('Offer publicada. Aguardando médico…');

    db.ref(`webrtc/${currentCode}/answer`).on('value', async (snap) => {
      const v = snap.val(); if (!v) return;
      await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(v)));
      setStatus('Conectado. Enviando…');
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') db.ref(`webrtc/${currentCode}`).off();
      };
    });
  }

  // Eventos de UI P2P
  genBtn?.addEventListener('click', () => { showCode(genCode()); setStatus('Código gerado. Passe ao médico.'); });
  if (!currentCode) showCode(genCode());
  connBtn?.addEventListener('click', () => { connectAndSend().catch(e=>{console.error(e);setStatus('Erro ao conectar.');}); });

  // Extração (gera só a linha clínica)
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // (PDF.js já está configurado no HTML)
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = '';
      for (let i=1;i<=pdf.numPages;i++){
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join('\n') + '\n';
      }

      // Parser (estrito → se fraco, usa loose)
      let base = parseReport(text);
      if (!base.itens || base.itens.length < 3) {
        const loose = parseReportLoose(text);
        if (loose.itens.length > (base.itens?.length || 0)) base = loose;
      }

      linhaClinica = formatLinhaProfissional(base.itens) || '';
      setStatus(linhaClinica ? 'Pronto para enviar.' : 'Não foi possível montar linha clínica.');
    } catch (err) {
      console.error(err);
      setStatus('Erro ao ler PDF.');
    }
  });
});
