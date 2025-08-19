window.addEventListener('DOMContentLoaded', () => {
  const prof   = document.getElementById('profissional');
  const input  = document.getElementById('sessionCodeInput');
  const btn    = document.getElementById('connectBtn');
  const statusEl=document.getElementById('p2pStatus');
  const setStatus=(m)=>{if(statusEl)statusEl.textContent=m;};

  function initFirebase(){
    if (!window.FIREBASE_CONFIG) throw new Error('firebase-config.js ausente');
    if (!window.firebase?.apps?.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
    return window.firebase.database();
  }

  function renderLinha(txt){ if(prof) prof.textContent=txt||'—'; }

  async function connect(code){
    const db=initFirebase();
    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    pc.ondatachannel=(ev)=>{ev.channel.onmessage=(msg)=>{try{renderLinha(JSON.parse(msg.data).profissional||'');setStatus('Dados recebidos.');}catch{setStatus('Falha ao interpretar.');}}};
    pc.onicecandidate=(ev)=>{if(ev.candidate)db.ref(`webrtc/${code}/ice/medico`).push(JSON.stringify(ev.candidate));};
    db.ref(`webrtc/${code}/ice/paciente`).on('child_added',(s)=>{try{pc.addIceCandidate(new RTCIceCandidate(JSON.parse(s.val())));}catch{}});
    const offerSnap=await db.ref(`webrtc/${code}/offer`).get();const val=offerSnap.val();if(!val){setStatus('Sem offer.');return;}
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(val)));
    const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
    await db.ref(`webrtc/${code}/answer`).set(JSON.stringify(answer));
    setStatus('Conectando…');
  }

  const url=new URL(location.href);const prefill=url.searchParams.get('code');if(prefill&&/^\d{6}$/.test(prefill))input.value=prefill;
  btn?.addEventListener('click',()=>{const code=(input?.value||'').trim();if(!/^\d{6}$/.test(code)){setStatus('Código inválido.');return;}connect(code).catch(()=>setStatus('Erro ao conectar.'));});
});
