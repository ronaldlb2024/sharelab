// public/js/lib/anonimizador.js
// Remove ou mascara CPFs, datas de nascimento e identificadores pessoais do texto.

export function anonimizar(texto) {
  // Remove CPFs no formato xxx.xxx.xxx-xx (com ou sem pontos/hífen)
  let t = texto.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[REMOVIDO]');
  // Mascara datas no formato dd/mm/aaaa ou dd-mm-aaaa
  t = t.replace(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/g, '[DATA]');
  // Mascara linhas que começam com “Paciente:”, “Nome:” ou “Convênio:”
  t = t.replace(/(Paciente|Nome|Conv[êe]nio)\s*[:\-]\s*([^\n]+)/gi, (match, rotulo) => {
    return `${rotulo}: [REMOVIDO]`;
  });
  return t;
}
