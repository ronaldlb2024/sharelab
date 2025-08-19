import { parseReport, parseReportLoose, formatLinhaProfissional } from '../lib/parse/report.js';

window.addEventListener('DOMContentLoaded', () => {
  const input   = document.getElementById('pdfInput');
  const codeEl  = document.getElementById('sessionCodeDisplay');
  const genBtn  = document.getElementById('generateCodeBtn');
  const connBtn = document.getElementById('connectBtn');
  const statusEl= document.getElementById('p2pStatus');

  let linhaClinica = '';
  let currentCode  = null;
  let pc           = null;

  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
  const genCode   = () => String(Math.floor(100000 + Math.random()*900000));
  const showCode  = (c) => { currentCode=c; if (codeEl) codeEl.textContent=c.replace(/(...)(...)/,'$1 $2'); };

  function initFirebase(){
    if (!window.FIREBASE_CONFIG) throw new Error('firebase-config.js ausente');
    if (!window.firebase?.apps?.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
    return window.firebase.database();
  }

  async function connectAndSend(){
    if (!currentCode){ setStatus('Gere o código antes.'); return; }
    if (!linhaClinica){ setStatus('Selecione um PDF primeiro.'); return; }

    const db = initFirebase();
    pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });
    const dc = pc.createDataChannel('data');

    pc.onicecandidate = (ev) => { if (ev.candidate) db.ref(`webrtc/${currentCode}/ice/paciente`).push(JSON.stringify(ev.candidate)); };
    db.ref(`webrtc/${currentCode}/ice/medico`).on('child_added',(s)=>{ try{pc.addIceCandidate(new RTCIceCandidate(JSON.parse(s.val())));}catch{} });

    dc.onopen = () => { dc.send(JSON.stringify({profissional:linhaClinica})); setStatus('Enviado ao médico.'); };

    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await db.ref(`webrtc/${currentCode}/offer`).set(JSON.stringify(offer));
    setStatus('Aguardando médico…');

    db.ref(`webrtc/${currentCode}/answer`).on('value', async (snap) => {
      const v = snap.val(); if (!v) return;
      await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(v)));
      setStatus('Conectado.');
    });
  }

  genBtn?.addEventListener('click',()=>{showCode(genCode());setStatus('Código gerado.');});
  if (!currentCode) showCode(genCode());
  connBtn?.addEventListener('click',()=>connectAndSend());

  input?.addEventListener('change', async (e)=>{
    const file=e.target.files?.[0]; if(!file)return;
    try{
      if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.10.111/build/pdf.worker.min.js';}
      const buf=await file.arrayBuffer();
      const pdf=await pdfjsLib.getDocument({data:buf}).promise;
      let text='';
      for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const c=await page.getTextContent();text+=c.items.map(it=>it.str).join('\n')+'\n';}
      let base=parseReport(text);
      if(!base.itens||base.itens.length<3){const loose=parseReportLoose(text);if(loose.itens.length>(base.itens?.length||0))base=loose;}
      linhaClinica=formatLinhaProfissional(base.itens)||'';
      setStatus(linhaClinica?'Pronto para enviar.':'Não foi possível montar linha clínica.');
    }catch(err){console.error(err);setStatus('Erro ao ler PDF.');}
  });
});
