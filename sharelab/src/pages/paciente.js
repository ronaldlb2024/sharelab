export default function initPaciente(){
  const input = document.getElementById('fileInput');
  const output = document.getElementById('output');

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const text = await file.text();
    output.textContent = text.slice(0,500) + "...";
  });
}
initPaciente();
