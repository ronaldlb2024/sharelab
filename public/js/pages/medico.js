// public/js/pages/medico.js
window.addEventListener('DOMContentLoaded', () => {
  function initFirebase() {
    if (!window.FIREBASE_CONFIG) { setStatus('firebase-config.js ausente'); throw new Error('FIREBASE_CONFIG missing'); }
    if (!window.firebase?.apps?.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
    return window.firebase.database();
  }
  const prof    = document.getElementById('profissional');
  const leg     = document.getElementById('legivel');
  const jso     = document.getElementById('json');
  const input   = document.getElementById('sessionCodeInput');
  const btn     = document.getElementById('connectBtn');
  const statusEl = document.getElementById('p2pStatus');
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; console.log('[P2P]', msg); };

  function render(payload) {
    if (prof) prof.textContent = payload?.profissional ?? '—';
    if (leg) {
      leg.innerHTML = '';
      for (const linha of (payload?.paciente ?? [])) {
        const li = document.createElement('li');
        li.textContent = linha;
        leg.appendChild(li);
      }
    }
    if (jso) jso.textContent = JSON.stringify(payload?.json ?? {}, null, 2);
  }

  async function connect(code) {
    const db = initFirebase();
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.ondatachannel = (ev) => {
      const ch = ev.channel;
      ch.onmessage = (msg) => {
        try { render(JSON.parse(msg.data)); setStatus('Dados recebidos via P2P.'); }
        catch (e) { console.error(e); setStatus('Falha ao interpretar payload.'); }
      };
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) db.ref(`webrtc/${code}/ice/medico`).push(JSON.stringify(ev.candidate));
    };
    db.ref(`webrtc/${code}/ice/paciente`).on('child_added', (snap) => {
      try {
        const cand = JSON.parse(snap.val());
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
      } catch (e) { console.error(e); }
    });
    const offerSnap = await db.ref(`webrtc/${code}/offer`).get();
    const val = offerSnap.val();
    if (!val) { setStatus('Nenhuma offer para este código. Peça ao paciente para conectar.'); return; }
    const offer = JSON.parse(val);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await db.ref(`webrtc/${code}/answer`).set(JSON.stringify(answer));
    setStatus('Conectando…');
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') db.ref(`webrtc/${code}`).off();
    };
  }

  // Permite pre-preencher code via ?code=123456
  const url = new URL(location.href);
  const prefill = url.searchParams.get('code');
  if (prefill && /^\d{6}$/.test(prefill)) { if (input) input.value = prefill; }

  btn?.addEventListener('click', () => {
    const code = (input?.value || '').trim();
    if (!/^\d{6}$/.test(code)) { setStatus('Código inválido.'); return; }
    connect(code).catch((e) => { console.error(e); setStatus('Erro ao conectar. Veja console.'); });
  });
});
