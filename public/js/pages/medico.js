/* Médico: digita código (4–6 dígitos), conecta via RTDB e recebe payload no DataChannel. */
import { isValidCode } from '../utils/sessionCode.js';
import { joinSession } from '../utils/signaling-rtdb.js';

const $ = (sel) => document.querySelector(sel);
const elInput = $('#sessionCodeInput');
const btnConn = $('#connectBtn');
const elStatus = $('#p2pStatus');
const elProf   = $('#profissional');

btnConn?.addEventListener('click', async () => {
  try {
    const code = (elInput?.value || '').trim();
    if (!isValidCode(code)) {
      elStatus.textContent = 'Digite um código numérico de 4 a 6 dígitos.';
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      dc.onopen = () => { elStatus.textContent = 'Conectado. Aguardando dados...'; };
      dc.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          elProf.textContent = payload.profissional || '—';
          elStatus.textContent = 'Resultados recebidos.';
          // Se quiser armazenar/exibir mais, adicione campos ou modifique o HTML
        } catch (err) {
          elStatus.textContent = 'Erro ao processar resposta.';
          console.error(err);
        }
      };
      dc.onclose = () => { elStatus.textContent = 'Canal encerrado.'; };
    };

    const db = firebase.database();
    await joinSession(code, pc, db);
    elStatus.textContent = 'Conectando...';

    window.addEventListener('beforeunload', () => { try { pc.close(); pc.__signalingCleanup?.(); } catch {} }, { once: true });

  } catch (err) {
    elStatus.textContent = 'Erro: ' + (err?.message || err);
  }
});
