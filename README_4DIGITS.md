# Códigos de 4 dígitos (sem letras) — Setup rápido

Este pacote simplifica o pareamento Paciente ↔ Médico usando **código de 4 dígitos numéricos**.
Sem letras, fácil de ditar/digitar.

## Arquivos incluídos
- `public/js/utils/sessionCode.js` — Geração/validação do código (4 dígitos).
- `public/js/utils/signaling-firestore.js` — Pareamento via Firebase Firestore com TTL.
- `patches/paciente-example.js` — Exemplo de integração no lado Paciente.
- `patches/medico-example.js` — Exemplo de integração no lado Médico.
- `patches/firestore.rules` — Regras mínimas para Firestore (demo).

## Passo a passo
1. Copie `public/js/utils/sessionCode.js` e `public/js/utils/signaling-firestore.js` para dentro do projeto.
2. No **Paciente**, gere o código e crie a sessão (`createSession`):
   ```js
   import { newCode, isValidCode } from '/js/utils/sessionCode.js';
   import { createSession } from '/js/utils/signaling-firestore.js';

   const code = newCode(); // ex: "4821"
   showCodeOnUI(code);

   const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
   await createSession(code, pc, firebase.firestore());
   ```
3. No **Médico**, peça o código de 4 dígitos e entre na sessão (`joinSession`):
   ```js
   import { isValidCode } from '/js/utils/sessionCode.js';
   import { joinSession } from '/js/utils/signaling-firestore.js';

   const code = readCodeFromUI(); // string de 4 dígitos
   if (!isValidCode(code)) return alert('Código inválido');
   const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
   await joinSession(code, pc, firebase.firestore());
   ```
4. Habilite **TTL** em Firestore (campo `expireAt`) e use `patches/firestore.rules` como ponto de partida.

## Observações de segurança
- 4 dígitos têm baixa entropia. Mitigue com: expiração curta (ex.: 10 min), encerramento automático após conexão e monitoramento de tentativas.
- Não armazene PII no documento da sessão. Envie apenas os **resultados já anonimizados**.