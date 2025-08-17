# ShareLab

ShareLab é uma demonstração de aplicativo web em que um paciente pode fazer upload de um laudo em PDF e, com todo o processamento ocorrendo localmente no navegador, extrair os principais dados laboratoriais. A aplicação foi criada com foco em privacidade: nenhum dado clínico é enviado para servidores. O objetivo futuro do projeto é permitir que o paciente compartilhe os resultados de forma peer‑to‑peer (P2P) com um médico utilizando WebRTC, mas nesta fase inicial o foco é a extração do PDF e exibição das três saídas (linha profissional, lista legível e JSON) apenas no lado do paciente.

## Executando localmente

1. Clone este repositório ou baixe os arquivos na sua máquina.
2. Certifique‑se de ter um servidor estático para servir a pasta `public`. Você pode usar `python3 -m http.server` na raiz do projeto:

   ```bash
   cd sharelab
   python3 -m http.server 8000 -d public
   ```

3. Acesse `http://localhost:8000/paciente.html` no navegador. Selecione um arquivo PDF de laudo (nativo, com texto selecionável). O texto será extraído localmente com PDF.js e os dados serão apresentados em três formatos:

   - **Profissional** – uma linha corrida com os parâmetros em ordem clínica.
   - **Paciente** – uma lista legível com nome completo, valor/unidade e classificação (baixo/normal/alto/indeterminado).
   - **JSON** – estrutura de dados que pode ser usada para integração.

4. Nada é enviado para servidores; todo o processamento ocorre no navegador do paciente. A integração P2P será adicionada em versões futuras.

## Estrutura de pastas

```
sharelab/
  public/
    index.html            # redireciona para paciente.html
    paciente.html         # página do paciente com upload e extração de PDF
    medico.html           # página do médico (placeholder para futura integração P2P)
    js/
      pages/
        paciente.js       # lógica da página do paciente (extrai texto e formata saídas)
        medico.js         # lógica da página do médico (ainda não implementada)
      lib/
        parse/
          normalizers.js  # mapa de normalização de nomes de parâmetros
          report.js       # funções de parsing e formatação
  .github/
    workflows/
      pages.yml           # workflow para deploy no GitHub Pages
  README.md
  LICENSE
```

## Deploy no GitHub Pages

Para hospedar via GitHub Pages, ative o GitHub Actions no seu repositório e inclua o workflow em `.github/workflows/pages.yml` conforme fornecido neste projeto. O Pages publicará automaticamente a pasta `public/` após cada push na branch `main`.
