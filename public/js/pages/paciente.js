// paciente.js (ESM)
// Requer: firebase-config.js define firebase.initializeApp({...})
// HTML já inclui pdf.js (UI), Firebase compat e este módulo.

const els = {
  input: document.getElementById('pdfInput'),
  code: document.getElementById('sessionCodeDisplay'),
  genBtn: document.getElementById('generateCodeBtn'),
  connectBtn: document.getElementById('connectBtn'),
  p2pStatus: document.getElementById('p2pStatus'),
};

let latestPayload = null;       // { profissional, paciente, json }
let sessionCode = null;
let pc = null;                  // RTCPeerConnection
let dataChannel = null;         // RTCDataChannel
let db = null;                  // firebase.database()
let worker = null;

// ---------- Worker para extrair PDF ----------
function ensureWorker() {
  if (worker) return worker;
  worker = new Worker('/js/worker.js'); // usa o worker que te enviei no zip
  worker.onmessage = (ev) => {
    const { ok, error, profissional, paciente, json, avisos } = ev.data || {};
    if (!ok) {
      alert('Erro na extração: ' + (error || 'desconhecido'));
      return;
    }
    latestPayload = { profissional, paciente, json };
    renderOutputs({ profissional, paciente, json, avisos });
  };
  return worker;
}

els.input.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  ensureWorker().postMessage({ arrayBuffer: buf }, [buf]); // transfere ownership
});

// ---------- UI de resultados (simples e direto) ----------
function renderOutputs({ profissional, paciente, json, avisos = [] }) {
  // cria contêiner se não houver
  let out = document.getElementById('outputs');
  if (!out) {
    out = document.createElement('div');
    out.id = 'outputs';
    out.style.marginTop = '16px';
    document.body.appendChild(out);
  }
  out.innerHTML = '';

  const h2 = (t) => { const el = document.createElement('h2'); el.textContent = t; return el; };
  const pre = (t) => { const el = document.createElement('pre'); el.textContent = t; el.style.whiteSpace='pre-wrap'; el.style.background='#f7f7f7'; el.style.padding='8px'; el.style.border='1px solid #ddd'; el.style.borderRadius='8px'; return el; };

  out.appendChild(h2('Saída profissional'));
  out.appendChild(pre(profissional || '(vazio)'));

  out.appendChild(h2('Saída para o paciente'));
  out.appendChild(pre(paciente || '(vazio)'));

  out.appendChild(h2('JSON'));
  out.appendChild(pre(JSON.stringify(json || {}, null, 2)));

  if (avisos.length) {
    out.appendChild(h2('Avisos'));
    out.appendChild(pre(avisos.join('\n')));
  }
}

// ---------- Geração de código ----------
function generateCode() {
  // 3 blocos para ficar legível: AAA-BBB-CCC (base36)
  const block = () => Math.random().toString(36).slice(2, 5).toUpperCase();
  sessionCode = `${block()}-${block()}-${block()}`;
  els.code.textContent = sessionCode;
}
els.genBtn.addEventListener('click', generateCode);

// ---------- Firebase + WebRTC P2P ----------
function ensureFirebase() {
  if (!db) {
    const app = firebase.app();               // usa firebase-config.js já embutido no HTML
    db = firebase.database();
  }
  return db;
}

function pathRoot() {
  if (!sessionCode) throw new Error('Gere um código antes de conectar.');
  return `sessions/${sessionCode}`;
}

async function connectAndSend() {
  try {
    if (!latestPayload) {
      alert('Selecione um PDF primeiro. O conteúdo só é enviado após processar localmente.');
      return;
    }
    if (!sessionCode) {
      generateCode();
    }
    ensureFirebase();

    // 1) criar RTCPeerConnection + datachannel
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
      ]
    });
    dataChannel = pc.createDataChannel('lab');
    dataChannel.onopen = () => {
      els.p2pStatus.textContent = 'Conectado. Enviando dados…';
      try {
        dataChannel.send(JSON.stringify({ type: 'sharelab_payload', payload: latestPayload }));
        els.p2pStatus.textContent = 'Enviado ao médico via P2P.';
      } catch (e) {
        els.p2pStatus.textContent = 'Falha ao enviar no canal de dados.';
      }
    };
    dataChannel.onclose = () => {
      els.p2pStatus.textContent = 'Canal encerrado.';
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        firebase.database().ref(`${pathRoot()}/caller/candidates`).push(JSON.stringify(e.candidate));
      }
    };

    // 2) escrever oferta no Firebase
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await firebase.database().ref(`${pathRoot()}/offer`).set(JSON.stringify(offer));
    els.p2pStatus.textContent = `Aguardando médico conectar com o código ${sessionCode}…`;

    // 3) esperar answer do médico
    firebase.database().ref(`${pathRoot()}/answer`).on('value', async (snap) => {
      const val = snap.val();
      if (!val) return;
      const answer = JSON.parse(val);
      if (!pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        els.p2pStatus.textContent = 'Médico conectado. Preparando envio…';
      }
    });

    // 4) escutar ICE do médico
    firebase.database().ref(`${pathRoot()}/callee/candidates`).on('child_added', async (snap) => {
      const cand = JSON.parse(snap.val());
      try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* noop */ }
    });

  } catch (err) {
    console.error(err);
    alert('Falha ao conectar: ' + err.message);
  }
}

els.connectBtn.addEventListener('click', connectAndSend);

// --------- UX inicial ----------
if (!sessionCode) {
  els.code.textContent = '— — —';
}
els.p2pStatus.textContent = '';
