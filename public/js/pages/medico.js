/* Página do MÉDICO
   - Digita código 4 dígitos
   - Conecta via WebRTC
   - Recebe payload (profissional, paciente, json) pelo DataChannel
*/
import { isValidCode } from '/js/utils/sessionCode.js';
import { joinSession } from '/js/utils/signaling-firestore.js';

const EL = {
  input: document.querySelector('#inputCode'),
  btnJoin: document.querySelector('#btnJoin'),
  outProf: document.querySelector('#outProfissional'),
  outPac: document.querySelector('#outPaciente'),
  outJson: document.querySelector('#outJson'),
};

let pc = null;
let cleanup = null;

async function join() {
  const code = (EL.input?.value || '').trim();
  if (!isValidCode(code)) {
    alert('Digite um código de 4 dígitos (ex.: 4821).');
    return;
  }

  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  pc.ondatachannel = (ev) => {
    const dc = ev.channel;
    dc.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        EL.outProf.textContent = payload.profissional || '';
        EL.outPac.textContent = payload.paciente || '';
        EL.outJson.textContent = JSON.stringify(payload.json || {}, null, 2);
      } catch (err) {
        console.error('Erro ao processar mensagem:', err);
      }
    };
  };

  const db = firebase.firestore();
  await joinSession(code, pc, db);
  cleanup = pc.__signalingCleanup;
}

EL.btnJoin?.addEventListener('click', join);

window.addEventListener('beforeunload', () => {
  try { pc?.close(); } catch {}
  try { cleanup?.(); } catch {}
});
