/* public/js/pages/paciente.js */
import { newCode, isValidCode } from '../utils/sessionCode.js';
import { createSession } from '../utils/signaling-rtdb.js';

const $        = (sel)=>document.querySelector(sel);
const elFile   = $('#pdfInput');
const elCode   = $('#sessionCodeDisplay');
const btnNew   = $('#generateCodeBtn');
const btnConn  = $('#connectBtn');
const elStatus = $('#p2pStatus');

// worker com cache-buster (?v=4) → evita rodar versão antiga no GitHub Pages
const worker = new Worker('js/worker.js?v=4');

let extracted=null, currentCode=null;

// mensagens do worker
worker.onmessage = (ev)=>{
  const d = ev.data||{};
  if (d._log){ console.log('[worker]', d._log); return; }
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

// captura erros não-interceptados do worker
worker.onerror = (e)=>{
  console.error('[worker onerror]', e.message, e.filename, e.lineno);
  elStatus.textContent = `Erro no worker: ${e.message} (${e.filename}:${e.lineno})`;
};
worker.onmessageerror = (e)=>{
  console.error('[worker onmessageerror]', e);
  elStatus.textContent = 'Erro de serialização na mensagem do worker.';
};

// upload PDF
elFile?.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  elStatus.textContent = 'Processando PDF...';
  worker.postMessage({ arrayBuffer: buf }, [buf]);
});

// gerar código
btnNew?.addEventListener('click', ()=>{
  currentCode = newCode(4);
  elCode.textContent = currentCode.replace(/(.)/g,'$1 ').trim();
  elStatus.textContent = 'Código gerado. Clique em Conectar & Enviar para compartilhar.';
});

// conectar & enviar
btnConn?.addEventListener('click', async ()=>{
  try{
    if(!extracted){ elStatus.textContent='Selecione um PDF e aguarde a extração.'; return; }
    if(!currentCode || !isValidCode(currentCode)){
      currentCode = newCode(4);
      elCode.textContent = currentCode.replace(/(.)/g,'$1 ').trim();
    }

    const pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });
    const dc = pc.createDataChannel('sharelab');
    dc.onopen = ()=>{
      try{ 
        dc.send(JSON.stringify(extracted)); 
        elStatus.textContent='Enviado ao médico. Sessão ativa.'; 
      }
      catch(e){ elStatus.textContent='Falha ao enviar: '+e; }
    };

    const db = firebase.database();
    await createSession(currentCode, pc, db);
    elStatus.textContent = `Conectando... informe o código ao médico: ${currentCode}`;

    window.addEventListener('beforeunload', ()=>{
      try{ pc.close(); }catch{}
      try{ pc.__signalingCleanup?.(); }catch{}
    }, { once:true });
  }catch(err){
    elStatus.textContent = 'Erro: ' + (err?.message || err);
  }
});
