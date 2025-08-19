// public/js/pages/medico.js
window.addEventListener('DOMContentLoaded', () => {
  const prof   = document.getElementById('profissional');
  const leg    = document.getElementById('legivel');
  const input  = document.getElementById('sessionCodeInput');
  const btn    = document.getElementById('connectBtn');
  const statusEl = document.getElementById('p2pStatus');
  const setStatus = (m) => { if (statusEl) statusEl.textContent = m; };

  function initFirebase(){
    if (!window.FIREBASE_CONFIG) { setStatus('firebase-config.js ausente'); throw new Error('FIREBASE_CONFIG missing'); }
    if (!window.firebase?.apps?.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
    return window.firebase.database();
  }

  function render(payload){
    if (prof) prof.textContent = payload?.profissional ?? '—';
    if (leg) {
      leg.innerHTML = '';
      for (const linha of (payload?.paciente ?? [])){
        const li = document.createElement('li');
        li.textContent = linha;
        leg.appendChild(li);
      }
    }
  }

  async function connect(code){
    const db = initFirebase();
    const pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });

    pc.ondatachannel = (ev) => {
      const ch = ev.channel;
      ch.onmessage = (msg) => {
        try { render(JSON.parse(msg.data)); setStatus('Dados recebidos via P2P.'); }
        catch(e){ console.error(e); setStatus('Falha ao interpretar dados.'); }
      };
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) db.ref(`webrtc/${code}/ice/medico`).push(JSON.stringify(ev.candidate));
    };
    db.ref(`webrtc/${code}/ice/paciente`).on('child_added', (snap) => {
      try { pc.addIceCandidate(new RTCIceCandidate(JSON.parse(snap.val()))).catch(console.error); }
      catch(e){ console.error(e); }
    });

    // Offer do paciente
    const offerSnap = await db.ref(`webrtc/${code}/offer`).get();
    const val = offerSnap.val();
    if (!val){ setStatus('Sem offer para este código. Peça para o paciente “Conectar & Enviar”.'); return; }

    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(val)));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await db.ref(`webrtc/${code}/answer`).set(JSON.stringify(answer));
    setStatus('Conectando…');

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') db.ref(`webrtc/${code}`).off();
    };
  }

  // Suporte a ?code=123456
  const url = new URL(location.href);
  const prefill = url.searchParams.get('code');
  if (prefill && /^\d{6}$/.test(prefill)) input.value = prefill;

  btn?.addEventListener('click', () => {
    const code = (input?.value || '').trim();
    if (!/^\d{6}$/.test(code)){ setStatus('Código inválido.'); return; }
    connect(code).catch(e=>{ console.error(e); setStatus('Erro ao conectar.'); });
  });
});
