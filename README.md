ShareLab
========

ShareLab é uma demonstração de aplicativo web em que um paciente pode fazer upload
de um laudo em PDF e, com todo o processamento ocorrendo localmente no navegador,
extrair os principais dados laboratoriais. A aplicação foi criada com foco em
privacidade: nenhum dado clínico é enviado para servidores.

Esta versão contém ajustes de manutenção para corrigir problemas de
configuração do Firebase e restaurar a página do médico. Agora o componente
cliente inicializa corretamente a SDK do Firebase e uma nova página
`medico.html` permite que o profissional de saúde conecte‑se à sessão e receba
os dados extraídos.

### Estrutura do projeto

```
sharelab/
  public/
    index.html         # redireciona para paciente.html
    paciente.html       # página do paciente (upload e extração local, envio opcional P2P)
    medico.html         # página do médico (recepção P2P, exibição da linha clínica)
    firebase-config.js  # configurações públicas do Firebase
    js/
      worker.js         # usa pdf.js no próprio Web Worker
      pages/
        paciente.js      # lógica da página do paciente
        medico.js        # lógica da página do médico
      lib/
        anonimizador.js  # utilitário para anonimização de texto
      utils/
        sessionCode.js   # gera e valida códigos de sessão (4 dígitos)
        signaling-rtdb.js # sinalização via Firebase (para P2P)
  package.json
  tsconfig.json
  vite.config.ts
```

### Executando localmente

1. Garanta que você possui [Node.js](https://nodejs.org/) instalado.
2. Instale as dependências de desenvolvimento com `npm install` (apenas `vite`).
3. Sirva a pasta `public/` com um servidor estático. Você pode usar o próprio
   `python3`:

   ```bash
   cd sharelab_fixed
   python3 -m http.server 8000 -d public
   ```

4. Abra [http://localhost:8000/paciente.html](http://localhost:8000/paciente.html) para iniciar o fluxo do paciente.
5. Para acompanhar como médico, abra [http://localhost:8000/medico.html](http://localhost:8000/medico.html)
   em outra janela ou dispositivo e insira o código gerado na página do paciente.

### Deploy no GitHub Pages

Você pode publicar a pasta `public/` usando GitHub Pages. O arquivo
`vite.config.ts` já contém a configuração de `base` necessária. Basta habilitar
o GitHub Actions e utilizar o workflow em `.github/workflows/pages.yml` (não
incluso nesta versão, mas presente no repositório original).

### Observações de segurança

Os códigos de sessão são numéricos de 4 dígitos e têm baixa entropia. Considere
implementar expiração curta (por exemplo, 10 minutos) e encerramento automático
após a conexão. Nunca armazene informações pessoais identificáveis (PII) no
documento de sessão; apenas dados anonimizados devem ser transferidos.

Este projeto está licenciado sob a licença MIT. Consulte o arquivo `LICENSE`
para mais detalhes.
