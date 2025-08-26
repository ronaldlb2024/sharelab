/* public/js/pages/medico.js */
import { joinSession } from '../utils/signaling-rtdb.js';

const $ = (sel)=>document.querySelector(sel);
const elInput  = $('#sessionCodeInput');
const btnConn  = $('#connectBtn');
const elStatus = $('#p2pStatus');
const elProf   = $('#profissional');

btnConn?.addEventListener('click', async ()=>{
  const code = (elInput.value||'').replace(/\D/g,'').slice(0,4);
  if (code.length!==4){ elStatus.textContent='Código inválido (4 dígitos).'; return; }
  try{
    const pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });
    pc.ondatachannel = (ev)=>{
      const dc = ev.channel;
      dc.onmessage = (mev)=>{
        try{
          const data = JSON.parse(mev.data);
          elProf.textContent = data?.profissional || '—';
          elStatus.textContent = 'Resultados recebidos.';
        }catch(e){ elStatus.textContent = 'Erro ao ler dados: '+e; }
      };
    };
    const db = firebase.database();
    await joinSession(code, pc, db);
    elStatus.textContent = 'Conectando...';
    window.addEventListener('beforeunload', ()=>{ try{ pc.close(); }catch{} try{ pc.__signalingCleanup?.(); }catch{} }, { once:true });
  }catch(err){ elStatus.textContent = 'Erro: ' + (err?.message || err); }
});
