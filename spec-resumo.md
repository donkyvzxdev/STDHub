# STDHub — Resumo do entendimento (cópia de leitura, v0.1)

> Original em `spec.md`. Este arquivo é só o meu entendimento resumido. O completo vem depois.

## Visão
App local-first (Tauri + Web) com 2 modos: guest (só máquina local) e logado (local + nuvem STDHub, banco a definir: SQL próprio ou Supabase). Guest ainda pode salvar via GitHub (cria/atualiza repo) ou Google Drive (cria pasta ou escolhe pasta). Funções base: Editor, Calculadora, Pesquisa, Chatbot, Configurações.

## Perfis
- **Guest:** tudo local. Nuvem STDHub bloqueada; GitHub/Drive liberados como saída manual. Migra pra conta depois.
- **Logado:** tudo do guest + salvar/sincronizar na nuvem STDHub (banco a definir).

## Navegação
- Sidebar esquerda larga e confortável, ícones fáceis de clicar.
- Clicar numa categoria abre painel secundário à direita da sidebar (estilo VSCode activity bar + side panel).
- Sidebars móveis/redimensionáveis.
- Sistema de tabs duplo: (a) tabs de funções do app (ex.: botão direito na Calculadora → abrir em nova tab; tabs fecháveis/reordenáveis); (b) tabs de arquivos dentro do Editor.

## Editor (US-EDITOR)
- Explorer estilo VSCode à direita da sidebar: escolher origem (GitHub, Google Drive ou pasta local; + nuvem STDHub se logado).
- Árvore de pastas/arquivos, ícone por extensão (.md, .js, .ts...), syntax highlight + autocomplete por linguagem (estilo VSCode), com gancho futuro pra autocomplete próprio do STDHub.
- Explorador executável/expansível + botão de setinha pra cima ao lado do explorer que abre terminal na pasta (no Tauri; no futuro rodar via GCC, Python loader etc.).

## Calculadora (US-CALC)
- Simples, moderna, toggle normal/científica. Copiar resultado por botão ao lado ou clicando no valor.

## Pesquisa (US-SEARCH)
- Busca web via API do DuckDuckGo (gratuita) + resumo IA estilo Google AI Overview.

## Chatbot (US-CHAT)
- Focado em estudante/prática, com funções de agente no modo local (ler/criar arquivos do editor, resumir pesquisa). Chave gratuita configurável (detalhe no original — ver alerta abaixo).

## Config (US-CONFIG)
- Tema escuro padrão estilo shadcn. Configurar cores/tema, design/densidade, trocar API de pesquisa e API do chatbot/IA. Expansível no futuro.

## Local vs Nuvem
- Guest/local: só disco local + GitHub/Drive manuais. Logado: + nuvem STDHub.

## Pontos que precisam de decisão (achei no original)
1. **Contradição no §10 Não-escopo:** Calculadora, Pesquisa e Chatbot estão listados como não-escopo, mas têm seções próprias (§5–7) e são funções base do app. Provável engano — confirmar se saem do não-escopo.
2. **§2 incompleto:** frase corta em "aonde o usuario". Falta completar a experiência guest ("configure yourself").
3. **Chave de API exposta no §8:** tem uma `sk-...` escrita no spec. Remover do arquivo, usar `.env` local, e revogar/trocar essa chave (repo git já iniciado — chave em texto plano é vazamento).
4. **Faltam detalhes:** qual API gratuita de IA (OpenRouter? Pollinations? Ollama local? OpenAI-compatible BYOK?), como "rodar" no Editor web (só preview MD/JS ou runner real?), fluxo exato do GitHub/Drive (OAuth próprio ou token do usuário?).
