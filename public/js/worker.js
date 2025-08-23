/* public/js/worker.js
   Extrai texto de PDF com pdf.js rodando DENTRO deste Web Worker.
   - Usa pdf.js com disableWorker=true (nada de fake worker).
   - Importa js/parse/*.js relativo à URL do worker (funciona no GitHub Pages com /sharelab).
   - Loga erros com detalhes; manda um "ready" pra checagem rápida.
*/
// After loading pdfjsLib
pdfjsLib.GlobalWorkerOptions.workerPort = self;
pdfjsLib.GlobalWorkerOptions.workerSrc = null;
pdfjsLib.GlobalWorkerOptions.disableWorker = true;

function postLog(...args){ try { self.postMessage({ _log: args.join(' ') }); } catch {} }
function errStr(e){
  if (!e) return 'Erro desconhecido';
  if (typeof e === 'string') return e;
  const name=e.name||'Error', msg=e.message||String(e);
  return `${name}: ${msg}`;
}

const CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.10.111/build';

// ---------- Carregar pdf.js dentro do worker (sem fake worker) ----------
(() => {
  try {
    importScripts(`${CDN}/pdf.min.js`);
    if (!self.pdfjsLib) throw new Error('pdfjsLib não exposto');
    // rodando já no Worker → desativa criação de outro worker
    pdfjsLib.GlobalWorkerOptions.disableWorker = true;
    postLog('pdf.js carregado (jsDelivr) e disableWorker=true');
  } catch (e1) {
    try {
      importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.min.js');
      if (!self.pdfjsLib) throw e1;
      pdfjsLib.GlobalWorkerOptions.disableWorker = true;
      postLog('pdf.js carregado (cdnjs) e disableWorker=true');
    } catch (e2) {
      self._pdfLoadError = e2;
    }
  }
})();

// ---------- Importar módulos parse/format (caminho relativo ao worker) ----------
(() => {
  const BASE = self.location.href.replace(/\/worker\.js(?:\?.*)?$/, ''); // .../js
  const urls = [
    `${BASE}/parse/normalize.js`,
    `${BASE}/parse/ref.js`,
    `${BASE}/parse/rules.js`,
    `${BASE}/parse/parse.js`,
    `${BASE}/parse/format.js`,
  ];
  const failed = [];
  for (const u of urls) {
    try { importScripts(u); postLog('import OK:', u); }
    catch (e) { failed.push(`${u} -> ${errStr(e)}`); }
  }
  if (failed.length) self._parseLoadError = new Error('Falha ao importar módulos:\n' + failed.join('\n'));
})();

// ---------- Reconstrução de linhas ----------
const Y_TOL = 2.0, GAP_AS_TAB = 40;
function reconstructLines(textContent){
  const rows=[];
  for (const it of textContent.items||[]){
    const tr=it.transform||[1,0,0,1,0,0], x=tr[4], y=tr[5], s=it.str||'';
    let row=rows.find(r=>Math.abs(r.y-y)<=Y_TOL);
    if(!row){row={y, runs:[]}; rows.push(row);}
    row.runs.push({x, str:s});
  }
  rows.sort((a,b)=>b.y-a.y);
  const out=[];
  for (const r of rows){
    r.runs.sort((a,b)=>a.x-b.x);
    let acc='';
    for (let i=0;i<r.runs.length;i++){
      const cur=r.runs[i], prev=r.runs[i-1];
      if(i>0) acc += (cur.x - prev.x > GAP_AS_TAB) ? '\t' : ' ';
      acc += cur.str;
    }
    const clean=acc.replace(/\u00A0/g,' ').replace(/[ ]{2,}/g,' ').trim();
    if(clean) out.push(clean);
  }
  return out;
}

// ---------- Extração ----------
async function extractPdf(buf){
  if(!self.pdfjsLib) throw new Error('pdfjsLib não carregado: ' + errStr(self._pdfLoadError));
  const task = pdfjsLib.getDocument({
    data: buf,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true
  });
  const pdf = await task.promise;
  const lines=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    lines.push(...reconstructLines(tc));
  }
  return lines;
}

// ---------- Anonimização simples ----------
function anonymize(lines){
  return lines.map(l=>l
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,'[CPF]')
    .replace(/\b(\d{2}\/){2}\d{4}\b/g,'[DATA]')
    .replace(/(Paciente|Nome|Conv[eê]nio)\s*:.*$/i,'$1: [REMOVIDO]')
  );
}

// ---------- Mensagens ----------
self.onmessage = async (ev)=>{
  try{
    if(self._parseLoadError) throw self._parseLoadError;
    const { arrayBuffer } = ev.data||{};
    if(!(arrayBuffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer do PDF não recebido.');
    const raw = await extractPdf(arrayBuffer);
    postLog('linhas extraídas:', String(raw.length));
    if(!raw.length) throw new Error('PDF sem texto extraível (possivelmente escaneado).');

    if (typeof parseLabReport!=='function' || typeof formatOutputs!=='function')
      throw new Error('Parser/formatador não encontrado (verifique js/parse/*.js).');

    const parsed = parseLabReport(anonymize(raw));
    const out = formatOutputs(parsed);
    self.postMessage({ ok:true, ...out, avisos: parsed.avisos||[] });
  }catch(e){
    self.postMessage({ ok:false, error: errStr(e) });
  }
};

// Sinal de vida do worker
postLog('worker pronto');
