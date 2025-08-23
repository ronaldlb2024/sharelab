/* Página do PACIENTE
   - Gera código 4 dígitos
   - Extrai PDF no worker (/js/worker.js)
   - Cria sessão WebRTC e envia resultados via DataChannel
*/
import { newCode } from '/js/utils/sessionCode.js';
import { createSession } from '/js/utils/signaling-firestore.js';

const EL = {
  code: document.querySelector('#pairingCode'),
  btnShare: document.querySelector('#btnShare'),
  pdfInput: document.querySelector('#pdfInput'),
  outProf: document.querySelector('#outProfissional'),
  outPac: document.querySelector('#outPaciente'),
  outJson: document.querySelector('#outJson'),
};

// Worker para extração local (ajuste caminho se necessário)
const worker = new Worker('/js/worker.js');

let lastResult = null;
worker.onmessage = (ev) => {
  const { ok, error, profissional, paciente, json } = ev.data || {};
  if (!ok) {
    alert('Erro na extração: ' + error);
    return;
  }
  lastResult = { profissional, paciente, json };
  EL.outProf.textContent = profissional || '';
  EL.outPac.textContent = paciente || '';
  EL.outJson.textContent = JSON.stringify(json, null, 2);
};

EL.pdfInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  worker.postMessage({ arrayBuffer: buf }, [buf]);
});

let pc = null;
let dc = null;
let cleanup = null;

async function startShare() {
  if (!lastResult) {
    alert('Selecione um PDF e aguarde a extração antes de compartilhar.');
    return;
  }

  // Gera e mostra código 4 dígitos
  const code = newCode();
  EL.code.textContent = code;
  // RTCPeerConnection + DataChannel
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  dc = pc.createDataChannel('sharelab');
  dc.onopen = () => {
    try {
      dc.send(JSON.stringify(lastResult));
      // opcional: encerrar após enviar
      // pc.close(); cleanup?.();
    } catch (e) {
      console.error('Erro ao enviar payload:', e);
    }
  };
  dc.onclose = () => console.log('datachannel fechado');

  const db = firebase.firestore();
  await createSession(code, pc, db);
  cleanup = pc.__signalingCleanup;
}

EL.btnShare?.addEventListener('click', startShare);

// limpeza ao fechar a página
window.addEventListener('beforeunload', () => {
  try { pc?.close(); } catch {}
  try { cleanup?.(); } catch {}
});
