/* public/js/worker.js */
const DIAG = { imports: [], mode: null };

function safeImport(src){
  try{ self.importScripts(src); DIAG.imports.push({src, ok:true}); }
  catch(e){ DIAG.imports.push({src, ok:false, error:String(e?.message||e)}); throw e; }
}

// Carrega pdf.js no próprio worker (CDN)
(() => {
  let ok = false;
  try { safeImport('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); ok = true; } catch {}
  if (!ok) { self.postMessage({ ok:false, error:'Falha ao carregar pdf.js', diag: DIAG }); return; }
})();

// (opcional) import dos módulos do parser
try{
  safeImport('parse/normalize.js');
  safeImport('parse/rules.js');
  safeImport('parse/parse.js');
  safeImport('parse/format.js');
}catch(e){
  self.postMessage({ ok:false, error:'Falha ao importar módulos parse/*.js', diag: DIAG });
}

let disable = false;
try{
  if (!self.pdfjsLib?.GlobalWorkerOptions) throw new Error('GlobalWorkerOptions ausente');
  self.pdfjsLib.GlobalWorkerOptions.workerPort = self;  // sem workerSrc
  DIAG.mode = 'workerPort=self';
}catch(e){
  disable = true;          // fallback
  DIAG.mode = 'disableWorker';
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
  return rows.map(r=>{
    r.runs.sort((a,b)=> a.x - b.x);
    let acc='';
    for(let i=0;i<r.runs.length;i++){
      const c=r.runs[i], p=r.runs[i-1];
      if(i>0) acc += (c.x - (p?.x ?? c.x) > GAP_AS_TAB) ? '\t' : ' ';
      acc += c.str;
    }
    return acc.replace(/\u00A0/g,' ').replace(/[ ]{2,}/g,' ').trim();
  }).filter(Boolean);
}

async function extractPdf(buf){
  if (!self.pdfjsLib) throw new Error('pdfjsLib não carregado');
  const params = { data: buf };
  if (disable) { params.disableWorker = true; params.isEvalSupported = false; }
  const pdf = await pdfjsLib.getDocument(params).promise;
  const lines=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const tc=await page.getTextContent();
    lines.push(...reconstructLines(tc));
  }
  return lines;
}

self.onmessage = async (ev)=>{
  try{
    const buf = ev.data?.arrayBuffer;
    if (!(buf instanceof ArrayBuffer)) throw new Error('ArrayBuffer do PDF não recebido');
    const lines = await extractPdf(buf);

    const parsed = (typeof self.parseLabReport==='function')
      ? self.parseLabReport(lines)
      : { items: [] };

    const out = (typeof self.formatOutputs==='function')
      ? self.formatOutputs(parsed)
      : { profissional: lines.join(' '), paciente: lines.join('\n'), json: { itens: [] } };

    self.postMessage({ ok:true, ...out, diag: DIAG });
  }catch(err){
    self.postMessage({ ok:false, error: String(err?.message||err) });
  }
};
