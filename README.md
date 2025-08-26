ShareLab

ShareLab é uma demonstração de aplicativo web em que um paciente pode fazer upload de um laudo em PDF e, com todo o processamento ocorrendo localmente no navegador, extrair os principais dados laboratoriais.
A aplicação foi criada com foco em privacidade: nenhum dado clínico é enviado para servidores.
O objetivo futuro do projeto é permitir que o paciente compartilhe os resultados de forma peer-to-peer (P2P) com um médico utilizando WebRTC. Nesta fase inicial o foco é a extração do PDF e exibição das três saídas apenas no lado do paciente:

Profissional – linha corrida com parâmetros em ordem clínica.

Paciente – lista legível com nome completo, valor/unidade e classificação (baixo/normal/alto/indeterminado).

JSON – estrutura de dados integrável.

Estrutura do projeto
sharelab/
  public/
    paciente.html         # página do paciente (upload e extração local, envio opcional P2P)
    medico.html           # página do médico (recepção P2P, exibição da linha clínica)
    favicon.svg
    js/
      worker.js           # usa pdf.js no próprio Web Worker; fallback sem fake worker
      pages/
        paciente.js       # lógica da página do paciente
        medico.js         # lógica da página do médico
      parse/
        normalize.js      # mapa de normalização de nomes de parâmetros
        rules.js          # regras (DASA/Fleury, hemograma, qualitativos/hepatites)
        parse.js          # agregador das regras
        format.js         # gera saída Profissional, Paciente e JSON
      utils/
        sessionCode.js    # gera e valida códigos de sessão (4 dígitos)
        signaling-*.js    # sinalização via Firebase (para P2P)

Executando localmente

Clone este repositório ou baixe os arquivos.

Sirva a pasta public/ com um servidor estático, por exemplo:

cd sharelab
python3 -m http.server 8000 -d public


Abra http://localhost:8000/paciente.html
.

Selecione um PDF de laudo nativo (com texto selecionável).

O sistema exibirá três saídas: profissional, paciente e JSON.

Nada é enviado a servidores; todo o processamento ocorre no navegador.

Deploy no GitHub Pages

Ative o GitHub Actions.

Use o workflow em .github/workflows/pages.yml (já incluso).

O Pages publicará automaticamente a pasta public/ a cada push na branch main.

Acesse: https://<usuario>.github.io/<repo>/paciente.html.

Se o navegador servir uma versão antiga do worker, faça Hard Reload com cache desabilitado.

Pareamento P2P com código de 4 dígitos

O projeto já suporta um protótipo de compartilhamento Paciente ↔ Médico via WebRTC, usando códigos de 4 dígitos numéricos (sem letras).

No Paciente, clique em “Novo código” → é gerado um código de 4 dígitos → ao conectar, o resultado extraído é enviado ao médico.

No Médico, digite o mesmo código → a sessão é estabelecida → a linha clínica aparece.

Observações de segurança

4 dígitos têm baixa entropia → mitigar com expiração curta (ex.: 10 min) e encerramento automático após a conexão.

Nunca armazenar PII (dados pessoais) no documento de sessão; apenas resultados anonimizados.

Patch Unificado (DASA + Fleury + Fallback)

worker.js: usa pdf.js no próprio Web Worker (workerPort=self), evitando erros de “document is not defined”; fallback sem fake worker.

parse/: regras e normalizadores cobrindo laudos DASA (Delboni/Lavoisier/São Luiz), Fleury/A+, hemograma, qualitativos/hepatites e fallback genérico.

paciente.html / medico.html: com <!DOCTYPE html> (sem Quirks Mode), favicon incluído, integração ajustada.

Códigos de sessão: numéricos de 4 dígitos, simples de usar.

Extração: 100% local no navegador.

Roadmap

Regras específicas por laboratório (mais precisão nos intervalos de referência).

Tabela evolutiva (quando houver histórico em múltiplas datas).

Canal P2P final com criptografia ponta-a-ponta e expiração segura.



Este projeto está licenciado sob a licença MIT (veja LICENSE).
