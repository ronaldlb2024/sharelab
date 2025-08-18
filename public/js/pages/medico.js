// public/js/pages/medico.js

function initFirebase(){
  if (!window.firebase?.apps?.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
  return window.firebase.database();
}

const prof = document.getElementById('profissional');
const leg  = document.getElementById('legivel');
const jso  = document.getElementById('json');
const input = document.getElementById('sessCode');
const btn   = document.getElementById('btnConnect');

function setStatus(msg){
  // opcional: mostre status em algum lugar; aqui uso console
  console.log('[P2P]', msg);
}

function render(payload){
  if (prof) prof.textContent = payload?.profissional ?? '';
  if (leg){
    leg.innerHTML = '';
    for (const linha of payload?.paciente ?? []){
      const li = document.createElement('li');
      li.textContent = linha;   // evita XSS
      leg.appendChild(li);
    }
  }
  if (jso) jso.textContent = JSON.stringify(payload?.json ?? {}, null, 2);
}

// permite abrir com ?code=123456
(function autofillFromURL(){
  const u = new URL(location.href);
  const code = u.searchParams.get('code');
  if (code && input) input.value = code;
})();

btn?.addEventListener('click', async () => {
  const code = (input?.value || '').trim();
  if (!/^[0-9]{6}$/.test(code)){ setStatus('Código inválido'); return; }

  const db = initFirebase();
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  // receber DataChannel do paciente
  pc.ondatachannel = (ev) => {
    const ch = ev.channel;
    ch.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        render(payload);
        setStatus('Dados recebidos via P2P');
      } catch (e) {
        console.error(e);
        setStatus('Falha ao interpretar payload');
      }
    };
  };

  // enviar ICE do médico
  pc.onicecandidate = (ev) => {
    if (ev.candidate){
      db.ref(`webrtc/${code}/ice/medico`).push(JSON.stringify(ev.candidate));
    }
  };

  // receber ICE do paciente
  db.ref(`webrtc/${code}/ice/paciente`).on('child_added', (snap) => {
    try{
      const cand = JSON.parse(snap.val());
      pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
    }catch(e){ console.error(e); }
  });

  // pegar offer do paciente
  const offerSnap = await db.ref(`webrtc/${code}/offer`).get();
  const val = offerSnap.val();
  if (!val){ setStatus('Nenhuma offer para este código. Peça ao paciente para conectar.'); return; }

  const offer = JSON.parse(val);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await db.ref(`webrtc/${code}/answer`).set(JSON.stringify(answer));

  setStatus('Conectando…');
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected'){
      db.ref(`webrtc/${code}`).off(); // para de ouvir sinalização
      setStatus('Conectado');
    }
  };
});
