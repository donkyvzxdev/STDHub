# STDHub Web — clone estático (HTML + CSS + JS puros)

Landing + app do STDHub sem build, sem frameworks e sem CDN: qualquer
navegador moderno abre, online ou com duplo clique offline.

## Rodar

- **Duplo clique**: abra `index.html` (landing) — tudo funciona, inclusive `app.html`.
- **Servidor local**: `python -m http.server` (ou `npx serve`) dentro de `web/`.
- **Vercel**: importe o repositório com **Root Directory = `web`**, sem
  comando de build e sem output directory customizado (estático puro).

## Estrutura

```
index.html        landing (PT-BR)
app.html          login de visitante + shell do app
css/theme.css     variáveis dark/light estilo shadcn + base
css/landing.css   landing
css/app.css       shell, notebook, calculadora, chat, modais
assets/logo.svg   logo oficial
js/calculator.js  engine da calculadora (porte 1:1 do desktop)
js/stmd.js        parser + renderer StudyMD (porte 1:1, com escape de HTML)
js/i18n.js        PT/EN embutidos (sem fetch — funciona em file://)
js/store.js       tema/idioma/chaves em localStorage
js/ai.js          cliente OpenAI-compatível (fetch; só com rede)
js/notebook.js    arquivos demo/localStorage/pasta local, editor, toolbar,
                  caderno interativo, desenho à caneta
js/calcview.js    calculadora com histórico
js/chat.js        tutor (precisa de chave de API + rede)
js/search.js      pesquisa Brave (chave) + resumo por IA
js/settings.js    modal de configurações + teste de conexão
js/app.js         sidebar, abas, dock à direita
js/boot.js        registra as views no shell
js/landing.js     menu mobile + ano
```

## Diferenças honestas vs. o app desktop

- **Sem terminal** (navegador não tem pty) — removido por decisão.
- **IA só com sua chave + rede**: Pollinations sem chave responde 403 a
  `Origin` de navegador (testado); use um endpoint OpenAI-compatível.
  Sem rede, todo o resto funciona.
- **Editor é textarea** (Monaco exigiria bundler/CDN): sem live-collapse
  do `#std` ao digitar — o modo Caderno renderiza tudo.
- **Pastas locais** via File System Access API (Chrome/Edge); fora disso,
  arquivos de exemplo persistem em `localStorage` (sem saída para disco).
