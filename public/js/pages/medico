/* public/js/pages/medico.js
 * Lógica da página do médico. Permite que o profissional insira o
 * código de sessão fornecido pelo paciente e receba os resultados
 * extraídos através de um canal de dados WebRTC.
 */
import { joinSession } from '../utils/signaling-rtdb.js';

// Inicializa o Firebase caso ainda não tenha sido inicializado. Isso é
// necessário para acessar o Realtime Database. Se a aplicação já estiver
// inicializada em outra parte do código, a chamada será ignorada.
if (typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
  } catch (err) {
    // Silencia exceções de inicialização duplicada.
  }
}

const $ = (sel) => document.querySelector(sel);
const elInput = $('#sessionCodeInput');
const btnConn = $('#connectBtn');
const elStatus = $('#p2pStatus');
const elProf = $('#profissional');

let pc = null; // PeerConnection atual
let joined = false; // evita múltiplas conexões

function setBusy(busy) {
  if (busy) {
    btnConn?.setAttribute('disabled', 'true');
    btnConn.textContent = 'Conectando...';
  } else {
    btnConn?.removeAttribute('disabled');
    btnConn.textContent = 'Conectar';
  }
}

function safeClose() {
  try {
    pc?.close();
  } catch {}
  pc = null;
  joined = false;
}

btnConn?.addEventListener('click', async () => {
  const code = (elInput.value || '').replace(/\D/g, '').slice(0, 4);
  if (code.length !== 4) {
    elStatus.textContent = 'Código inválido (4 dígitos).';
    return;
  }
  if (joined) {
    elStatus.textContent = 'Sessão já iniciada.';
    return;
  }
  try {
    setBusy(true);
    elStatus.textContent = 'Conectando...';
    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        elStatus.textContent = 'Conectado.';
      } else if (st === 'disconnected' || st === 'failed' || st === 'closed') {
        elStatus.textContent = `Conexão encerrada (${st}).`;
        safeClose();
        setBusy(false);
      }
    };
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === 'failed') {
        elStatus.textContent = 'Falha ICE. Verifique rede/Firewall.';
      }
    };
    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      dc.onopen = () => {
        elStatus.textContent = 'Canal de dados aberto. Aguardando resultados...';
      };
      dc.onerror = (e) => {
        elStatus.textContent = 'Erro no canal de dados.';
        console.error('[medico] datachannel error', e);
      };
      dc.onmessage = (mev) => {
        try {
          const data = JSON.parse(mev.data);
          elProf.textContent = data?.profissional || '—';
          elStatus.textContent = 'Resultados recebidos.';
        } catch (e) {
          elStatus.textContent = 'Erro ao ler dados recebidos.';
          console.error('[medico] parse message error', e);
        }
      };
      dc.onclose = () => {
        elStatus.textContent = 'Canal fechado.';
      };
    };
    const db = firebase.database();
    await joinSession(code, pc, db);
    joined = true;
    window.addEventListener(
      'beforeunload',
      () => {
        try {
          pc?.close();
        } catch {}
        try {
          pc?.__signalingCleanup?.();
        } catch {}
      },
      { once: true }
    );
  } catch (err) {
    elStatus.textContent = 'Erro: ' + (err?.message || err);
    console.error('[medico] join error', err);
    safeClose();
  } finally {
    // mantém "Conectando..." por alguns instantes; volta para "Conectar" se falhar
    if (!joined) setBusy(false);
  }
});
