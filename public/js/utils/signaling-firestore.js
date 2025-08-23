// Sinalização WebRTC usando Firebase **Realtime Database (RTDB)**.
// Requer firebase inicializado e 'db' = firebase.database()
// Estrutura: sessions/{code}/offer, answer, callerCandidates/{push}, calleeCandidates/{push}

function toJSONCandidate(cand) {
  // compat serialize
  return cand && typeof cand.toJSON === 'function' ? cand.toJSON() : cand;
}

export async function createSession(code, pc, db) {
  const roomRef = db.ref('sessions').child(code);

  // evita colisão: se já existir 'offer' recente, peça novo código
  const snapshot = await roomRef.child('offer').get();
  if (snapshot.exists()) {
    throw new Error('Código em uso. Gere outro.');
  }

  // ICE (caller)
  const callerCandsRef = roomRef.child('callerCandidates');
  pc.onicecandidate = (ev) => {
    if (ev.candidate) callerCandsRef.push(toJSONCandidate(ev.candidate));
  };

  // Offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await roomRef.update({
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    ttlAt: Date.now() + 10 * 60 * 1000 // 10 min (use Regras/TTL server-side depois)
  });

  // Answer listener
  const answerRef = roomRef.child('answer');
  const onAnswer = answerRef.on('value', async (snap) => {
    const ans = snap.val();
    if (ans && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(ans));
    }
  });

  // Callee ICE
  const calleeCandsRef = roomRef.child('calleeCandidates');
  const onCalleeCand = calleeCandsRef.on('child_added', (snap) => {
    const data = snap.val();
    if (data) pc.addIceCandidate(new RTCIceCandidate(data)).catch(()=>{});
  });

  // função de limpeza
  pc.__signalingCleanup = async () => {
    try { answerRef.off('value', onAnswer); } catch {}
    try { calleeCandsRef.off('child_added', onCalleeCand); } catch {}
    // limpeza suave: remove candidatos do caller e (opcional) a sala
    try { const s = await callerCandsRef.get(); s.forEach(d=>d.ref.remove()); } catch {}
    // opcional: roomRef.remove() (cuidado com reconexões)
  };

  return code;
}

export async function joinSession(code, pc, db) {
  const roomRef = db.ref('sessions').child(code);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists() || !roomSnap.child('offer').exists()) {
    throw new Error('Código inválido ou sessão expirada.');
  }

  // ICE (callee)
  const calleeCandsRef = roomRef.child('calleeCandidates');
  pc.onicecandidate = (ev) => {
    if (ev.candidate) calleeCandsRef.push(toJSONCandidate(ev.candidate));
  };

  // Apply offer
  const offer = roomSnap.child('offer').val();
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  // Create/send answer
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await roomRef.child('answer').set({ type: answer.type, sdp: answer.sdp });

  // Caller ICE listener
  const callerCandsRef = roomRef.child('callerCandidates');
  const onCallerCand = callerCandsRef.on('child_added', (snap) => {
    const data = snap.val();
    if (data) pc.addIceCandidate(new RTCIceCandidate(data)).catch(()=>{});
  });

  pc.__signalingCleanup = async () => {
    try { callerCandsRef.off('child_added', onCallerCand); } catch {}
    try { const s = await calleeCandsRef.get(); s.forEach(d=>d.ref.remove()); } catch {}
  };

  return code;
}
