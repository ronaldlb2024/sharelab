// Sinalização via Firebase Firestore para WebRTC usando um código numérico de 4 dígitos.
// Requer firebase inicializado e 'db' = firebase.firestore()

export async function createSession(code, pc, db) {
  const roomRef = db.collection('sessions').doc(code);
  const snap = await roomRef.get();
  if (snap.exists) throw new Error('Código em uso. Gere outro.');

  // ICE (caller)
  const callerCandidates = roomRef.collection('callerCandidates');
  pc.onicecandidate = (event) => {
    if (event.candidate) callerCandidates.add(event.candidate.toJSON());
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await roomRef.set({
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    expireAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)) // TTL 10 min
  });

  // Acompanhar resposta (answer) do callee
  const unsubRoom = roomRef.onSnapshot(async (snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answer = new RTCSessionDescription(data.answer);
      await pc.setRemoteDescription(answer);
    }
  });

  // Candidatos do callee
  const unsubCallee = roomRef.collection('calleeCandidates').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  // Facilita limpeza
  pc.__signalingCleanup = async () => {
    unsubRoom();
    unsubCallee();
    try { (await callerCandidates.get()).forEach(d=>d.ref.delete()); } catch {}
    try { await roomRef.delete(); } catch {}
  };

  return code;
}

export async function joinSession(code, pc, db) {
  const roomRef = db.collection('sessions').doc(code);
  const roomSnapshot = await roomRef.get();
  if (!roomSnapshot.exists) throw new Error('Código inválido ou expirado.');

  const data = roomSnapshot.data();
  if (!data?.offer) throw new Error('Sessão sem oferta SDP.');

  // ICE (callee)
  const calleeCandidates = roomRef.collection('calleeCandidates');
  pc.onicecandidate = (event) => {
    if (event.candidate) calleeCandidates.add(event.candidate.toJSON());
  };

  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await roomRef.update({ answer: { type: answer.type, sdp: answer.sdp } });

  // Candidatos do caller
  const unsubCaller = roomRef.collection('callerCandidates').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  // Facilita limpeza
  pc.__signalingCleanup = async () => {
    unsubCaller();
    try { (await calleeCandidates.get()).forEach(d=>d.ref.delete()); } catch {}
    // não deletamos o roomRef aqui para permitir reconexões curtas se necessário
  };

  return code;
}
