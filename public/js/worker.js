/* public/js/worker.js
   Estratégia robusta p/ pdf.js dentro do SEU Web Worker:
   1) Tenta usar este próprio worker como pdf worker (workerPort = self).
   2) Se falhar, usa disableWorker: true no getDocument (sem fake worker).
*/

const DIAG = { imports: [], mode: null, notes: [] };
function safeImport(src){
  try{ self.importScripts(src); DIAG.imports.push({src, ok:true}); }
  catch(e){ DIAG.imports.push({src, ok:false, error:String(e?.message||e)}); throw e; }
}

// 1) Carrega apenas pdf.min.js (NÃO carregue pdf.worker.min.js aqui)
(() => {
  let ok = false;
  try { safeImport('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); ok = true; } catch {}
  if (!ok) {
    try { safeImport('/vendor/pdfjs/pdf.min.js'); ok = true; } catch (e) {
      self.postMessage({ ok:false, error:'Falha ao carregar pdf.js', diag: DIAG }); return;
    }
  }
})();

// 2) Importa seus módulos (sem index.js)
try{
  safeImport('parse/normalize.js');
  safeImport('parse/ref.js');
  safeImport('parse/rules.js');
  safeImport('parse/parse.js');
  safeImport('parse/format.js');
  try { safeImport('lib/anonimizador.js'); } catch {}
}catch(e){
  self.postMessage({ ok:false, error:'Falha ao importar módulos parse/*.js', diag: DIAG });
  // não retornamos; deixamos seguir para mostrar diag completo no catch final
}

const Y_TOL = 2.0, GAP_AS_TAB = 40;

function reconstructLines(tc){
  const rows=[];
  for(const it of (tc.items||[])){
    const tr = it.transform || [1,0,0,1,0,0];
    const x=tr[4], y=tr[5], s=it.str||'';
    let row = rows.find(r => Math.abs(r.y - y) <= Y_TOL);
    if(!row) rows.push(row = { y, runs: [] });
    row.runs.push({ x, str: s });
  }
  rows.sort((a,b)=> b.y - a.y);
  const lines=[];
  for(const r of rows){
    r.runs.sort((a,b)=> a.x - b.x);
    let acc='';
    for(let i=0;i<r.runs.length;i++){
      const c=r.runs[i], p=r.runs[i-1];
      if(i>0) acc += (c.x - (p?.x ?? c.x) > GAP_AS_TAB) ? '\t' : ' ';
      acc += c.str;
    }
    const clean = acc.replace(/\u00A0/g,' ').replace(/[ ]{2,}/g,' ').trim();
    if(clean) lines.push(clean);
  }
  return lines;
}

// 3) Modo preferido: usar ESTE worker como pdf worker
let useDisableWorkerFallback = false;
try{
  if (!self.pdfjsLib) throw new Error('pdfjsLib não carregado');
  if (!self.pdfjsLib.GlobalWorkerOptions) throw new Error('GlobalWorkerOptions ausente');

  // chave: aponta a “porta” do worker para este próprio worker
  self.pdfjsLib.GlobalWorkerOptions.workerPort = self;
  // recomenda-se NÃO setar workerSrc quando se usa workerPort
  DIAG.mode = 'workerPort=self';
  DIAG.notes.push('Usando este Web Worker como pdf worker (workerPort=self).');
}catch(e){
  // Se der qualquer problema, caímos para o fallback
  useDisableWorkerFallback = true;
  DIAG.mode = 'disableWorker';
  DIAG.notes.push('Fallback: disableWorker=true (fake worker desativado). Motivo: ' + String(e?.message||e));
}

async function extractPdf(buf){
  if (!self.pdfjsLib) throw new Error('pdfjsLib não carregado');
  const params = { data: buf };

  // Fallback robusto: desliga completamente o worker interno
  if (useDisableWorkerFallback) {
    params.disableWorker     = true;
    params.isEvalSupported   = false;
    params.useWorkerFetch    = false;
  }

  const pdf = await pdfjsLib.getDocument(params).promise;

  const all=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const tc=await page.getTextContent();
    all.push(...reconstructLines(tc));
  }
  return all;
}

function anonymizeLinesFallback(lines){
  return lines.map(l=>l
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,'[CPF]')
    .replace(/\b(\d{2}\/){2}\d{4}\b/g,'[DATA]')
    .replace(/(Paciente|Nome|Conv[eê]nio)\s*:.*$/i,'$1: [REMOVIDO]')
  );
}

self.onmessage = async (ev)=>{
  try{
    const { arrayBuffer } = ev.data || {};
    if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer do PDF não recebido');

    const lines = await extractPdf(arrayBuffer);
    const anon  = (typeof self.anonimizeLines === 'function') ? self.anonimizeLines(lines) : anonymizeLinesFallback(lines);

    if (typeof self.parseLabReport !== 'function')
      throw new Error('parseLabReport ausente (confira parse/parse.js)');
    if (typeof self.formatOutputs !== 'function')
      throw new Error('formatOutputs ausente (confira parse/format.js)');

    const parsed = self.parseLabReport(anon);
    const out    = self.formatOutputs(parsed);

    self.postMessage({ ok:true, ...out, diag: DIAG, avisos: parsed.avisos || [] });
  }catch(err){
    self.postMessage({ ok:false, error: String(err?.message||err), diag: DIAG });
  }
};
