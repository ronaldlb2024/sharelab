# sharelab_extractor.py
# -*- coding: utf-8 -*-
"""
Sharelab - Extrator Médico de Exames (protótipo)
------------------------------------------------
- Extração baseada em texto (pdfminer -> fallback PyPDF2).
- Normalização de nomes (mapa reduzido).
- Saídas: profissional, paciente, JSON.
- Parsers específicos:
  * ParserGeral: heurístico simples (múltiplos laboratórios).
  * ParserRedeDor: otimizado para blocos "Resultado:" e Hemograma.

IMPORTANTE: Protótipo com cobertura parcial. Alguns PDFs terão extração incompleta.
"""

from typing import Dict, Any, List, Optional, Tuple
import re, json, math, os

# ---------- PDF text extraction ----------

def extract_text_pdf(path: str) -> str:
    text = ""
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract_text
        text = pdfminer_extract_text(path)
    except Exception:
        pass
    if text and len(text.strip()) > 0:
        return text
    try:
        import PyPDF2
        with open(path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            pages = []
            for p in reader.pages:
                try:
                    pages.append(p.extract_text() or "")
                except Exception:
                    pages.append("")
            text = "\n".join(pages)
    except Exception:
        text = ""
    return text

# ---------- Utils ----------

def norm_num(s: str) -> Optional[float]:
    if s is None: return None
    s = s.strip().replace("\u00A0"," ")
    # remove thousands separators but preserve decimal comma
    # "216.000" -> remove dots then replace comma with dot; "1,11" -> "1.11"
    s = s.replace(" ", "")
    s = re.sub(r"(?<=\d)\.(?=\d{3}\b)", "", s)  # 216.000 -> 216000
    s = s.replace(",", ".")
    try:
        return float(s)
    except:
        m = re.search(r"[-+]?\d+(?:\.\d+)?", s)
        return float(m.group(0)) if m else None

def clean_unit(u: Optional[str]) -> Optional[str]:
    if not u: return None
    u = u.strip()
    u = u.replace("⁄", "/").replace("\\", "/").replace("uL", "µL").replace("mm3", "mm³")
    u = re.sub(r"\s+", " ", u)
    return u

def parse_ref(s: str) -> Tuple[Optional[float], Optional[float], str]:
    if not s: return (None, None, "unknown")
    t = s.lower().strip().replace("até","a").replace("–","-").replace("—","-")
    m = re.search(r"(?:de\s*)?([-+]?\d+[.,]?\d*)\s*a\s*([-+]?\d+[.,]?\d*)", t, re.I)
    if m:
        low = norm_num(m.group(1)); high = norm_num(m.group(2))
        if low and high and low>high: low, high = high, low
        return (low, high, "range")
    m = re.search(r"inferior\s+a\s+([-+]?\d+[.,]?\d*)", t, re.I)
    if m: return (None, norm_num(m.group(1)), "le")
    m = re.search(r"superior\s+a\s+([-+]?\d+[.,]?\d*)", t, re.I)
    if m: return (norm_num(m.group(1)), None, "ge")
    m = re.search(r"\ba\s+([-+]?\d+[.,]?\d*)\b", t)
    if m: return (None, norm_num(m.group(1)), "le")
    return (None, None, "unknown")

def classify_value(val: Optional[float], low: Optional[float], high: Optional[float], typ: str) -> str:
    if val is None: return "Indeterminado"
    if typ == "range":
        if low is not None and val < low: return "Baixo"
        if high is not None and val > high: return "Alto"
        return "Normal"
    if typ == "le":
        if high is not None and val > high: return "Alto"
        return "Normal"
    if typ == "ge":
        if low is not None and val < low: return "Baixo"
        return "Normal"
    return "Indeterminado"

# ---------- Normalization ----------

PARAMS = {
    "Hb": {"labels": ["Hemoglobina", r"\bHb\b"], "patient": "Hemoglobina"},
    "Ht": {"labels": ["Hematócrito", "Hematocrito", r"\bHt\b"], "patient": "Hematócrito"},
    "HEM": {"labels": ["Hemácias", "Eritrócitos", "Eritrocitos"], "patient": "Hemácias"},
    "RDW": {"labels": [r"\bRDW\b"], "patient": "RDW"},
    "Leuco": {"labels": ["Leucócitos", "Leucocitos"], "patient": "Leucócitos"},
    "Plaq": {"labels": ["Plaquetas", "Contagem de Plaquetas"], "patient": "Plaquetas"},
    "Neutro": {"labels": ["Neutrófilos", "Neutrofilos"], "patient": "Neutrófilos"},
    "Seg": {"labels": ["Segmentados"], "patient": "Neutrófilos segmentados"},
    "Linf": {"labels": ["Linfócitos", "Linfocitos"], "patient": "Linfócitos"},
    "Mono": {"labels": ["Monócitos", "Monocitos"], "patient": "Monócitos"},
    "Eos": {"labels": ["Eosinófilos", "Eosinofilos"], "patient": "Eosinófilos"},
    "Baso": {"labels": ["Basófilos", "Basofilos"], "patient": "Basófilos"},
    "URE": {"labels": ["Uréia", "Ureia"], "patient": "Ureia"},
    "CRE": {"labels": ["Creatinina"], "patient": "Creatinina"},
    "eGFR": {"labels": [r"\beGFR\b", r"\bTFG\b"], "patient": "Taxa de filtração glomerular (eGFR)"},
    "NA": {"labels": ["Sódio", "Sodio"], "patient": "Sódio"},
    "K": {"labels": ["Potássio", "Potassio"], "patient": "Potássio"},
    "MG": {"labels": ["Magnésio", "Magnesio"], "patient": "Magnésio"},
    "CAI": {"labels": ["Cálcio Iônico", "Calcio Iônico", "Cálcio Ionico", "Calcio Ionico"], "patient": "Cálcio iônico"},
    "GLI": {"labels": ["Glicose"], "patient": "Glicose"},
    "PCR": {"labels": ["Proteína C Reativa", "Proteina C Reativa", r"\bPCR\b"], "patient": "Proteína C Reativa"},
    "AST": {"labels": ["TGO", "AST", "Aspartato Aminotransferase", "Aspartato amino transferase"], "patient": "AST (TGO)"},
    "ALT": {"labels": ["TGP", "ALT", "Alanina Aminotransferase", "Alanina amino transferase"], "patient": "ALT (TGP)"},
    "FA": {"labels": ["Fosfatase Alcalina", r"\bFA\b", r"\bFAL\b"], "patient": "Fosfatase alcalina"},
    "GGT": {"labels": ["GGT", "Gama-Glutamil Transferase"], "patient": "Gama-GT (GGT)"},
    "BIL T": {"labels": ["Bilirrubina Total"], "patient": "Bilirrubina total"},
    "BIL D": {"labels": ["Bilirrubina Direta"], "patient": "Bilirrubina direta"},
    "BIL I": {"labels": ["Bilirrubina Indireta"], "patient": "Bilirrubina indireta"},
    "RNI": {"labels": ["RNI", "INR", "Razão Normatizada Internacional"], "patient": "Razão normatizada internacional (INR)"},
    "TTPA_rel": {"labels": ["Relação TTPA", "Relação do TTPA", "Relação:"], "patient": "TTPA (relação paciente/normal)"},
}

PROF_ORDER = ["Hb","Ht","Leuco","Plaq","URE","CRE","NA","K","MG","CAI",
              "pH(a)","pO2(a)","pCO2(a)","HCO3(a)","BE(a)","SatO2(a)",
              "pH(v)","pO2(v)","pCO2(v)","HCO3(v)","BE(v)","SatO2(v)",
              "LAC","PCR","TnI","RDW","Neutro","Seg","Linf","Mono","Eos","Baso",
              "RNI","TTPA_rel","AST","ALT","GGT","FA","BIL T","BIL D","BIL I","CPK","LDH"]

def _alias_patterns() -> List[Tuple[str,str]]:
    pat = []
    for code, meta in PARAMS.items():
        for lab in meta["labels"]:
            pat.append((code, lab))
    return pat

ALIAS_PATTERNS = _alias_patterns()

# ---------- Parsers ----------

class ParserBase:
    def parse(self, text: str) -> Dict[str, Any]:
        raise NotImplementedError

class ParserGeral(ParserBase):
    """Heurístico linha-a-linha para muitos laboratórios."""
    def parse(self, text: str) -> Dict[str, Any]:
        items: Dict[str, Dict[str, Any]] = {}

        lines = text.splitlines()
        # Simple per-line captures (value + unit on same line as alias)
        for code, alias in ALIAS_PATTERNS:
            for i, ln in enumerate(lines):
                if re.search(alias, ln, re.IGNORECASE):
                    ctx = " ".join(lines[i:i+2])
                    m = re.search(rf"{alias}.*?([-+]?\d+(?:[.,]\d+)*)\s*([%µA-Za-z/³^0-9\-\.]+)?", ctx, re.IGNORECASE)
                    if m:
                        val = norm_num(m.group(1))
                        unit = clean_unit((m.group(2) or "").strip())
                        # reference search in nearby lines
                        look = " ".join(lines[i:i+5])
                        mref = re.search(r"(?:INTERVALO DE REFER[ÊE]NCIA|Valores? de refer[êe]ncia|Valor(?:es)? de [Rr]efer[êe]ncia)[:\s]*([^\n]+)", look, re.IGNORECASE)
                        if not mref:
                            mref = re.search(r"((?:De|de)?\s*[-+]?\d+[.,]?\d*\s*(?:a|até)\s*[-+]?\d+[.,]?\d*|Inferior a\s*[-+]?\d+[.,]?\d*|Superior a\s*[-+]?\d+[.,]?\d*|Até\s*[-+]?\d+[.,]?\d*)", look, re.IGNORECASE)
                        ref = mref.group(1).strip() if mref else ""
                        if code not in items:
                            items[code] = {"value": val, "unit": unit or None, "ref_text": ref}
                        break  # stop at first match for this alias

        # Hemograma: tentar absolutos e RDW
        block = " ".join(lines)
        # Leucócitos total
        m = re.search(r"Leuc[óo]citos.*?(\d[\d\.,]*)\s*/\s*(?:µL|mm3|mm³)", block, re.IGNORECASE)
        if m: items["Leuco"] = {"value": norm_num(m.group(1)), "unit": "/µL", "ref_text": ""}
        # RDW
        m = re.search(r"\bRDW\b.*?([\d\.,]+)\s*%", block, re.IGNORECASE)
        if m: items["RDW"] = {"value": norm_num(m.group(1)), "unit": "%", "ref_text": ""}
        # Plaquetas (aceitar mil/mm3 e /µL)
        m = re.search(r"(?:Plaquetas|Contagem de\s+Plaquetas).*?([\d\.,]+)\s*(mil/mm3|mil/mm³|/µL|/mm3|/mm³)", block, re.IGNORECASE)
        if m:
            val = norm_num(m.group(1)); unit = m.group(2).lower()
            if "mil/mm" in unit and val is not None:
                val *= 1000; unit = "/mm³"
            items["Plaq"] = {"value": val, "unit": unit.replace("mil/mm3","/mm³").replace("mil/mm³","/mm³"), "ref_text": ""}
        # Hb e Ht
        m = re.search(r"Hemoglobina.*?([\d\.,]+)\s*g/dL", block, re.IGNORECASE)
        if m: items["Hb"] = {"value": norm_num(m.group(1)), "unit": "g/dL", "ref_text": ""}
        m = re.search(r"Hemat[óo]crito.*?([\d\.,]+)\s*%", block, re.IGNORECASE)
        if m: items["Ht"] = {"value": norm_num(m.group(1)), "unit": "%", "ref_text": ""}

        # Build structure
        out = []
        for code, data in items.items():
            low, high, typ = parse_ref(data.get("ref_text",""))
            status = classify_value(data.get("value"), low, high, typ)
            patient_label = next((meta["patient"] for c, meta in PARAMS.items() if c==code), code)
            out.append({
                "parametro_norm": code, "rotulo": patient_label,
                "valor": data.get("value"), "unidade": data.get("unit"),
                "ref": data.get("ref_text") or None, "status": status
            })
        return {"itens": out}

class ParserRedeDor(ParserBase):
    """Parser otimizado para estrutura Rede D'Or (Resultado:, Hemograma, Bilirrubinas)."""
    def parse(self, text: str) -> Dict[str, Any]:
        items: Dict[str, Dict[str, Any]] = {}

        lines = [l.strip() for l in text.splitlines()]
        # 1) Blocos "Resultado:"
        for i, ln in enumerate(lines):
            m = re.search(r"Resultado:\s*([-+]?\d+(?:[.,]\d+)*)\s*([%µA-Za-z/³^0-9\-\.]+)?", ln, re.IGNORECASE)
            if m:
                val = norm_num(m.group(1)); unit = clean_unit(m.group(2) or None)
                # Look backward for the analyte name (up to 3 lines)
                label = None
                for j in range(max(0,i-3), i):
                    s = lines[j]
                    if "Valor" in s or "Material" in s or "Método" in s or "Metodo" in s: 
                        continue
                    if len(s) >= 3:
                        label = s
                if label:
                    # normalize label
                    code = None
                    for c, meta in PARAMS.items():
                        for lb in meta["labels"]:
                            if re.search(rf"\b{lb}\b", label, re.IGNORECASE):
                                code = c; break
                        if code: break
                    if code:
                        # reference nearby
                        look = " ".join(lines[i:i+4])
                        mref = re.search(r"(?:Valores? de refer[êe]ncia|Valor de refer[êe]ncia)[:\s]*([^\n]+)", look, re.IGNORECASE)
                        ref = mref.group(1).strip() if mref else ""
                        items[code] = {"value": val, "unit": unit, "ref_text": ref}

        # 2) Bilirrubinas linhas com "Bilirrubina Total  : 0.61 mg/dL"
        for i, ln in enumerate(lines):
            m = re.search(r"(Bilirrubina (?:Total|Direta|Indireta))\s*:?\s*([-+]?\d+(?:[.,]\d+)*)\s*([%µA-Za-z/³^0-9\-\.]+)?", ln, re.IGNORECASE)
            if m:
                label = m.group(1); val = norm_num(m.group(2)); unit = clean_unit(m.group(3) or None)
                code_map = {"Total": "BIL T", "Direta": "BIL D", "Indireta": "BIL I"}
                key = next((code_map[k] for k in code_map if k.lower() in label.lower()), None)
                if key:
                    # reference: check next lines
                    look = " ".join(lines[i:i+3])
                    mref = re.search(r"(?:Valores? de refer[êe]ncia|Valor de refer[êe]ncia)[:\s]*([^\n]+)", look, re.IGNORECASE)
                    if not mref:
                        # Or explicit ranges on top of section
                        head = " ".join(lines[max(0, i-3):i+1])
                        mref = re.search(r"(?:De\s*[-+]?\d+[.,]?\d*\s*a\s*[-+]?\d+[.,]?\d*\s*[A-Za-z/µ³%]+)", head, re.IGNORECASE)
                    ref = mref.group(1).strip() if mref else ""
                    items[key] = {"value": val, "unit": unit, "ref_text": ref}

        # 3) Hemograma blocado
        block = " ".join(lines)
        # Totais
        m = re.search(r"Leuc[óo]citos.*?(\d[\d\.,]*)\s*/\s*(?:µL|mm3|mm³)", block, re.IGNORECASE)
        if m: items["Leuco"] = {"value": norm_num(m.group(1)), "unit": "/µL", "ref_text": ""}
        m = re.search(r"(?:Plaquetas|Plaquetas).*?([\d\.,]+)\s*(mil/mm3|mil/mm³|/µL|/mm3|/mm³)", block, re.IGNORECASE)
        if m:
            val = norm_num(m.group(1)); unit = m.group(2).lower()
            if "mil/mm" in unit and val is not None:
                val *= 1000; unit = "/mm³"
            items["Plaq"] = {"value": val, "unit": unit.replace("mil/mm3","/mm³").replace("mil/mm³","/mm³"), "ref_text": ""}
        # Hb, Ht, RDW
        m = re.search(r"Hemoglobina.*?([\d\.,]+)\s*g/dL", block, re.IGNORECASE)
        if m: items["Hb"] = {"value": norm_num(m.group(1)), "unit": "g/dL", "ref_text": ""}
        m = re.search(r"Hemat[óo]crito.*?([\d\.,]+)\s*%", block, re.IGNORECASE)
        if m: items["Ht"] = {"value": norm_num(m.group(1)), "unit": "%", "ref_text": ""}
        m = re.search(r"\bRDW\b.*?([\d\.,]+)\s*%", block, re.IGNORECASE)
        if m: items["RDW"] = {"value": norm_num(m.group(1)), "unit": "%", "ref_text": ""}

        # Build
        out = []
        for code, data in items.items():
            low, high, typ = parse_ref(data.get("ref_text",""))
            status = classify_value(data.get("value"), low, high, typ)
            patient_label = next((meta["patient"] for c, meta in PARAMS.items() if c==code), code)
            out.append({
                "parametro_norm": code, "rotulo": patient_label,
                "valor": data.get("value"), "unidade": data.get("unit"),
                "ref": data.get("ref_text") or None, "status": status
            })
        return {"itens": out}

# ---------- Public API ----------

def find_exam_metadata(text: str) -> Dict[str, Any]:
    title = None; lab = None; dt = None
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if lines:
        title = lines[0][:120]
    m = re.search(r"(Rede D[’']?Or|DASA|Sabin|Fleury|Delboni|Hermes Pardini|Albert Einstein)", text, re.I)
    if m: lab = m.group(1)
    m = re.search(r"DATA COLETA/RECEBIMENTO:\s*(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})", text, re.I)
    if m: dt = m.group(1)
    if not dt:
        m = re.search(r"Coletado em\(?(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})\)?", text, re.I)
        if m: dt = m.group(1)
    return {"titulo": title, "laboratorio": lab, "data": dt}

def choose_parser(text: str) -> ParserBase:
    if "Rede D’Or" in text or "Rede D'Or" in text or "HOSPITAL SÃO LUIZ" in text.upper():
        return ParserRedeDor()
    return ParserGeral()

def extract(path: str) -> Dict[str, Any]:
    text = extract_text_pdf(path)
    if not text or len(text.strip()) < 30:
        return {"erro": "PDF não contém texto extraível (talvez digitalizado). Peça a versão nativa.", "arquivo": os.path.basename(path)}
    meta = find_exam_metadata(text)
    parser = choose_parser(text)
    parsed = parser.parse(text)
    # Build outputs
    items = {it["parametro_norm"]: it for it in parsed["itens"]}
    order = PROF_ORDER
    parts = []
    for code in order:
        it = items.get(code)
        if not it or it.get("valor") is None: continue
        v = it["valor"]; u = it.get("unidade") or ""
        if isinstance(v, (int,float)):
            if u in ["%"]: s = f"{v:.1f}"
            elif u in ["/µL","/mm³"]: s = f"{int(round(v))}"
            else: s = f"{v:.2f}".rstrip("0").rstrip(".")
        else:
            s = str(v)
        parts.append(f"{code} {s}{(' '+u) if u else ''}".strip())
    prof = "; ".join(parts)

    # paciente view
    lines = []
    for it in sorted(parsed["itens"], key=lambda x: x["rotulo"]):
        if it.get("valor") is None: continue
        v = it["valor"]; u = it.get("unidade") or ""
        if isinstance(v, float) and not v.is_integer():
            val_s = f"{v:.2f}".rstrip("0").rstrip(".")
        else:
            val_s = f"{int(v) if isinstance(v,(int,float)) and float(v).is_integer() else v}"
        val_s = str(val_s).replace(".", ",")
        status = it.get("status","Indeterminado").lower()
        lines.append(f"{it['rotulo']}: {val_s} {u}".strip() + f" — {status}")
    header = " • ".join([s for s in [meta.get('titulo'), meta.get('laboratorio'), meta.get('data')] if s])
    patient = (header + "\n\n" if header else "") + "\n".join(lines)

    return {
        "paciente": {"nome": None, "data_nascimento": None},
        "exame": meta,
        "itens": parsed["itens"],
        "evolutivo": {},  # TODO: implementar para tabelas evolutivas
        "saida_profissional": prof,
        "saida_paciente": patient,
    }

# CLI
if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Extrator de exames (protótipo Sharelab)")
    ap.add_argument("pdf", help="Caminho do PDF do laudo")
    ap.add_argument("--json", help="Salvar saída JSON em caminho", default=None)
    args = ap.parse_args()
    res = extract(args.pdf)
    print("=== Saída Profissional ===")
    print(res.get("saida_profissional",""))
    print("\n=== Saída Paciente ===")
    print(res.get("saida_paciente",""))
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=2)
        print(f"\nJSON salvo em: {args.json}")
