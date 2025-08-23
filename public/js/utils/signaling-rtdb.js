// Sinalização WebRTC usando Firebase Realtime Database (RTDB)
function toJSONCandidate(c) { return c && c.toJSON ? c.toJSON() : c; }

export async function createSession(code, pc, db) {
  const roomRef = db.ref('sessions').child(code);
  const offerSnap = await roomRef.child('offer').get();
  if (offerSnap.exists()) throw new Error('Código em uso. Gere outro.');

  const callerCandsRef = roomRef.child('callerCandidates');
  pc.onicecandidate = (ev) => { if (ev.candidate) callerCandsRef.push(toJSONCandidate(ev.candidate)); };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await roomRef.update({
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    ttlAt: Date.now() + 10*60*1000
  });

  const answerRef = roomRef.child('answer');
  const onAnswer = answerRef.on('value', async (snap) => {
    const ans = snap.val();
    if (ans && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(ans));
    }
  });

  const calleeCandsRef = roomRef.child('calleeCandidates');
  const onCallee = calleeCandsRef.on('child_added', (snap) => {
    const data = snap.val();
    if (data) pc.addIceCandidate(new RTCIceCandidate(data)).catch(()=>{});
  });

  pc.__signalingCleanup = async () => {
    try { answerRef.off('value', onAnswer); } catch {}
    try { calleeCandsRef.off('child_added', onCallee); } catch {}
    try { const s = await callerCandsRef.get(); s.forEach(d=>d.ref.remove()); } catch {}
  };

  return code;
}

export async function joinSession(code, pc, db) {
  const roomRef = db.ref('sessions').child(code);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists() || !roomSnap.child('offer').exists())
    throw new Error('Código inválido ou sessão expirada.');

  const calleeCandsRef = roomRef.child('calleeCandidates');
  pc.onicecandidate = (ev) => { if (ev.candidate) calleeCandsRef.push(toJSONCandidate(ev.candidate)); };

  const offer = roomSnap.child('offer').val();
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await roomRef.child('answer').set({ type: answer.type, sdp: answer.sdp });

  const callerCandsRef = roomRef.child('callerCandidates');
  const onCaller = callerCandsRef.on('child_added', (snap) => {
    const data = snap.val();
    if (data) pc.addIceCandidate(new RTCIceCandidate(data)).catch(()=>{});
  });

  pc.__signalingCleanup = async () => {
    try { callerCandsRef.off('child_added', onCaller); } catch {}
    try { const s = await calleeCandsRef.get(); s.forEach(d=>d.ref.remove()); } catch {}
  };

  return code;
}
