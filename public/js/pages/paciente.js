/* public/js/pages/paciente.js */
import { newCode, isValidCode } from '../utils/sessionCode.js';
import { createSession } from '../utils/signaling-rtdb.js';
// Adicione a importação do Firebase se necessário
// import { database } from 'firebase/database';

const $        = (sel)=>document.querySelector(sel);
const elFile   = $('#pdfInput');
const elCode   = $('#sessionCodeDisplay');
const btnNew   = $('#generateCodeBtn');
const btnConn  = $('#connectBtn');
const elStatus = $('#p2pStatus');

// Versione o worker para forçar recarregamento quando atualizar:
const worker = new Worker('js/worker.js?v=9');

let extracted = null;
let currentCode = null;
let pc = null;

function setBusy(busy) {
  if (busy) {
    btnConn?.setAttribute('disabled', 'true');
    btnNew?.setAttribute('disabled', 'true');
  } else {
    btnConn?.removeAttribute('disabled');
    btnNew?.removeAttribute('disabled');
  }
}

function showCode(code) {
  elCode.textContent = String(code).replace(/(.)/g,'$1 ').trim();
}

worker.onmessage = (ev)=>{
  const d = ev.data||{};
  if (d._log) { 
    console.log('[worker]', d._log); 
    return; 
  }
  const { ok, error, profissional, paciente, json, diag } = d;
  if (!ok){
    console.error('[worker error]', error, diag);
    elStatus.textContent = 'Erro na extração: ' + (error || 'sem detalhes');
    return;
  }
  if (diag) console.log('[worker diag]', diag);
  extracted = { profissional, paciente, json };
  elStatus.textContent = 'Extração concluída. Pronto para compartilhar.';
};

worker.onerror = (e)=>{
  console.error('[worker onerror]', e.message, e.filename, e.lineno);
  elStatus.textContent = `Erro no worker: ${e.message} (${e.filename}:${e.lineno})`;
};

worker.onmessageerror = (e)=>{
  console.error('[worker onmessageerror]', e);
  elStatus.textContent = 'Erro de serialização na mensagem do worker.';
};

// Upload PDF → extrai localmente
elFile?.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  elStatus.textContent = 'Processando PDF...';
  extracted = null;
  worker.postMessage({ arrayBuffer: buf }, [buf]);
});

// Gera código de 4 dígitos
btnNew?.addEventListener('click', ()=>{
  currentCode = newCode(4);
  showCode(currentCode);
  elStatus.textContent = 'Código gerado. Clique em Conectar & Enviar para compartilhar.';
});

// Conectar & enviar
btnConn?.addEventListener('click', async ()=>{
  try {
    if (!extracted) {
      elStatus.textContent = 'Selecione um PDF e aguarde a extração.';
      return;
    }
    if (!currentCode || !isValidCode(currentCode)) {
      currentCode = newCode(4);
      showCode(currentCode);
    }

    setBusy(true);
    elStatus.textContent = `Conectando... informe o código ao médico: ${currentCode}`;

    pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });

    const dc = pc.createDataChannel('sharelab');
    dc.onopen = ()=>{
      try {
        dc.send(JSON.stringify(extracted));
        elStatus.textContent = 'Enviado ao médico. Sessão ativa.';
      } catch (e) {
        elStatus.textContent = 'Falha ao enviar.';
        console.error('[paciente] send error', e);
      }
    };
    
    dc.onerror = (e)=> {
      console.error('[paciente] datachannel error', e);
      elStatus.textContent = 'Erro no canal de dados.';
    };
    
    dc.onclose = ()=> {
      elStatus.textContent = 'Canal fechado.';
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        elStatus.textContent = 'Conectado ao médico.';
      } else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        elStatus.textContent = `Conexão encerrada (${st}).`;
        try { pc?.close(); } catch {}
        setBusy(false);
      }
    };

    // Certifique-se de que o Firebase está inicializado e disponível
    const db = firebase.database();
    await createSession(currentCode, pc, db);

    // cleanup na navegação
    window.addEventListener('beforeunload', ()=>{
      try { pc?.close(); } catch {}
      try { if (pc?.__signalingCleanup) pc.__signalingCleanup(); } catch {}
    }, { once:true });

  } catch (err) {
    elStatus.textContent = 'Erro: ' + (err?.message || err);
    console.error('[paciente] connect error', err);
    try { pc?.close(); } catch {}
    setBusy(false);
  }
});
