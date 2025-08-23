// patches/paciente-example.js
import { newCode } from '/js/utils/sessionCode.js';
import { createSession } from '/js/utils/signaling-firestore.js';

async function startPatientFlow() {
  const code = newCode();
  document.querySelector('#pairingCode').textContent = code;

  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  // anexe streams/datachannel conforme seu app
  const dc = pc.createDataChannel('sharelab');
  dc.onopen = () => console.log('canal aberto');
  dc.onmessage = (e) => console.log('mensagem do médico:', e.data);

  const db = firebase.firestore();
  await createSession(code, pc, db);

  // Exemplo: enviar payload anonimizado depois da extração
  function sendResult(payload) {
    if (dc.readyState === 'open') dc.send(JSON.stringify(payload));
  }
  window.sendResult = sendResult; // expõe para ser chamado após extração
}

startPatientFlow();
