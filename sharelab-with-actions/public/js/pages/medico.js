export default function initMedico(){
  const btn = document.getElementById('connectBtn');
  const out = document.getElementById('output');
  btn.addEventListener('click', ()=>{
    out.textContent = "Conectado (simulação)";
  });
}
initMedico();
