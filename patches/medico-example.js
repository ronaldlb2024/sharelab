// patches/medico-example.js
import { isValidCode } from '/js/utils/sessionCode.js';
import { joinSession } from '/js/utils/signaling-firestore.js';

async function startDoctorFlow() {
  const codeInput = document.querySelector('#inputCode').value.trim();
  if (!isValidCode(codeInput)) return alert('Digite um código de 4 dígitos.');

  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.ondatachannel = (ev) => {
    const dc = ev.channel;
    dc.onopen = () => console.log('canal aberto');
    dc.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      console.log('resultado do paciente:', payload);
      // renderizar na UI
    };
  };

  const db = firebase.firestore();
  await joinSession(codeInput, pc, db);
}

document.querySelector('#btnJoin').addEventListener('click', startDoctorFlow);
