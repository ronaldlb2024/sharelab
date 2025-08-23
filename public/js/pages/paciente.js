/* Paciente: gera código (4–6 dígitos), extrai PDF no worker, conecta via RTDB e envia payload. */
import { newCode, isValidCode } from '../utils/sessionCode.js';
import { createSession } from '../utils/signaling-rtdb.js';

// ---- elementos da UI
const $ = (sel) => document.querySelector(sel);
const elFile = $('#pdfInput');
const elCode = $('#sessionCodeDisplay');
const btnNew = $('#generateCodeBtn');
const btnConn = $('#connectBtn');
const elStatus = $('#p2pStatus');

// ---- worker de extração (ajuste o caminho se necessário)
const worker = new Worker('/js/worker.js');

// buffers de resultado
let extracted = null;
let currentCode = null;

worker.onmessage = (ev) => {
  const { ok, error, profissional, paciente, json } = ev.data || {};
  if (!ok) {
    elStatus.textContent = 'Erro na extração: ' + error;
    return;
  }
  extracted = { profissional, paciente, json };
  elStatus.textContent = 'Extração concluída. Pronto para compartilhar.';
};

// depois de criar o worker:
worker.onmessage = (ev) => {
  const d = ev.data || {};
  if (d._log) { console.log('[worker]', d._log); return; }
  const { ok, error, profissional, paciente, json } = d;
  if (!ok) { document.querySelector('#p2pStatus').textContent = 'Erro: ' + error; return; }

// upload PDF
elFile?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  elStatus.textContent = 'Processando PDF...';
  worker.postMessage({ arrayBuffer: buf }, [buf]);
});

// gerar código
btnNew?.addEventListener('click', () => {
  currentCode = newCode(4); // você pode trocar para 6 se quiser: newCode(6)
  elCode.textContent = currentCode.replace(/(.)/g, '$1 ').trim();
  elStatus.textContent = 'Código gerado. Clique em Conectar & Enviar para compartilhar.';
});

// conectar & enviar
btnConn?.addEventListener('click', async () => {
  try {
    if (!extracted) {
      elStatus.textContent = 'Selecione um PDF e aguarde a extração.';
      return;
    }
    if (!currentCode || !isValidCode(currentCode)) {
      currentCode = newCode(4);
      elCode.textContent = currentCode.replace(/(.)/g, '$1 ').trim();
    }

    // RTC + DataChannel
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const dc = pc.createDataChannel('sharelab');
    dc.onopen = () => {
      try {
        dc.send(JSON.stringify(extracted));
        elStatus.textContent = 'Enviado ao médico. Sessão ativa.';
        // opcional: encerrar após enviar
        // pc.close();
      } catch (e) {
        elStatus.textContent = 'Falha ao enviar: ' + e;
      }
    };
    dc.onclose = () => { /* sessão encerrada pelo outro lado */ };

    const db = firebase.database();
    await createSession(currentCode, pc, db);
    elStatus.textContent = `Conectando... informe o código ao médico: ${currentCode}`;
    // limpeza quando sair
    window.addEventListener('beforeunload', () => { try { pc.close(); pc.__signalingCleanup?.(); } catch {} }, { once: true });

  } catch (err) {
    elStatus.textContent = 'Erro: ' + (err?.message || err);
  }
});
