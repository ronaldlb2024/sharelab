# Sharelab — Patch Unificado (DASA + Fleury + Fallback)
Arquivos:
- `public/js/worker.js` — pdf.js no próprio Web Worker (evita `document is not defined`); fallback sem fake worker.
- `public/js/parse/*` — normalização, regras (Dasa/Fleury genéricas, hemograma, qualitativos/hepatites), agregador e formatador.
- `public/paciente.html` / `public/js/pages/paciente.js` — upload, extração local e envio P2P.
- `public/medico.html` / `public/js/pages/medico.js` — recepção P2P e exibição da linha clínica.
- `public/favicon.svg`.

## Como aplicar
1. Copie a pasta `public/` sobre a sua `public/` (mantenha `firebase-config.js` e `utils/*` originais).
2. Publique no GitHub Pages. Abra `.../paciente.html`.
3. Faça **Hard Reload** se o navegador estiver servindo worker antigo.

## Observações
- Código de sessão: 4 dígitos (sem letras).
- Extração roda 100% no navegador (sem enviar PDF a servidor).
- Cobertura inicial: DASA (Delboni/Lavoisier/São Luiz Dasa), Fleury/A+ e fallback para qualitativos/hepatites + hemograma básico.
