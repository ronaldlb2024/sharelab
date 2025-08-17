# ShareLab — Assessment & Suggestions

Your project, **sharelab**, aims to simplify the doctor’s workflow by extracting key lab‑test results from PDF or text reports, normalising the names and units and presenting them in a condensed format. Below is an overall assessment of the current approach, a summary of common laboratory formats and abbreviations, and pragmatic suggestions for improving the extraction logic and shaping a lean minimum‑viable product (MVP).

---

## 1. Assessment of the current project
* **Existing extraction logic**: your repository includes a JavaScript extractor that searches for fixed labels (e.g., “Hemoglobina”, “Plaquetas”) and grabs the number that follows. It also has logic for leucocyte counts specific to DASA (where “100 %” appears in the first column and the absolute count appears later). The script then builds an output string (e.g., “Hb 12.9; Ht 36.4; Leuco 9910; …”). A UI component lets the doctor paste raw text, see the clean extraction and add it to a compiled list.
* **Limitations**:
  * It assumes a small set of parameter names and therefore misses tests that appear under different headings (“Hemácias” versus “Eritrócitos”; “Creatinina sérica” versus “Creatinina”).
  * It uses simple regexes that may fail when a value appears on a different line or when the reference range is interleaved.
  * It does not normalise units; some labs express leucocytes as `10^3/µL`, others as `/mm³`.
  * It does not handle panels like iron studies, thyroid hormones, liver enzymes or tumour markers which many hospital labs include.
  * There is no abstraction for “complete” vs. “evolutive” (serial) reports; the current code grabs only the last numeric value when it finds multiple numbers.

## 2. Common laboratory formats, abbreviations and patterns
(abridged — full text can be expanded as needed)
- **Haemogram**: RBC/Erythrogram (“Eritrócitos”, “Hemácias”, “RBC”), Hb, Ht, MCV/VCM, MCH/HCM, MCHC/CHCM, RDW; leucogram with % and absolute values (Neutro/Seg, Basto, Linf, Mono, Eos, Baso).
- **Platelets**: “Plaquetas”, “Contagem de plaquetas”, “PLT”.
- **Metabolic panel**: eletrólitos (Na, K, Cl), ureia, creatinina, eGFR; AST, ALT, GGT, FA; bilirrubinas T/D/I; PCR; troponina; CK‑MB; LDH; gasometria A/V.
- **Coagulation**: INR/RNI, TP/TAP, TTPA (razão).
- **Lab formats**: DASA/Rede D’Or (tabelas com duas colunas %/absoluto), Fleury/A+ (linha narrativa), hospitais (laudo evolutivo por colunas).

## 3. Suggestions to improve the extraction logic
- **Dictionary of synonyms** mapped to canonical codes (see `normalizers.js`).
- **Flexible number extraction** after label; ignore dates; lide com múltiplas colunas.
- **Unit/exponent normalisation** para unificar contagens (ex.: 10^3/µL → multiplica por 1000).
- **Configurability** via listas de parâmetros/sinônimos.
- **Reference ranges & status** (baixo/normal/alto) quando a faixa for encontrada no texto.
- **Error handling parcial**: produza o que conseguir e sinalize faltantes.

## 4. Proposed lean MVP
- SPA client‑side (GitHub Pages), sem backend.
- Campos: CBC, painel metabólico, enzimas, inflamação, troponina, gasometrias.
- Evolutivo: detectar colunas com datas; usar a **última coluna** para a saída principal; manter JSON com histórico.
- Privacidade: local only; sem analytics.

---

*This document is included to guide iterations and is safe to publish inside the repository.*
