# STDHub — plan.md (derivado do spec.md v1.0)

## 1. Objetivo
App local-first (Tauri + Web) + website com landing page. Fase 1: shell, Editor, Config. Fase 2: Calculadora, Pesquisa, Chatbot.

## 2. Arquitetura
- `website/` — landing page estática (Vite). Recriada do zero inspirada na estrutura do HTML de referência do aqryl (hero, features, comparativo, pricing, FAQ, footer). O HTML salvo não é reutilizado (export Next.js).
- `app/` — React + Vite + shadcn/ui (regras da skill shadcn: `npx shadcn@latest`, cores semânticas, FieldGroup, etc.). Roda na web e dentro do Tauri.
- `app/src-tauri/` — shell desktop (filesystem real, terminal na pasta). Fica dentro de `app/` (layout padrão do Tauri).
- Dados locais: filesystem via Tauri; na web, OPFS + IndexedDB. Funciona 100% offline.
- Nuvem (a partir da F5): banco a definir (SQL próprio ou Supabase — Auth + dados + arquivos equivalentes). Guest migra para conta sem perder arquivos.
- Segredos: `.env` local (já no `.gitignore`). Nunca commitar chave.
- Design: tema escuro shadcn por padrão, desktop-first, mobile depois; componentes copiados como código-fonte e tematizados via variáveis CSS (tema do usuário = novo conjunto de variáveis/preset, aplicado globalmente).
- Idioma: inglês padrão; detecção de locale/região na entrada; i18n (`react-i18next` ou equivalente) com arquivos em `app/src/locales/`; troca no Config; cadastro pergunta o idioma primeiro.
- UI: React + shadcn (Rust/UI + Leptos avaliado e descartado: ecossistema menor, editor Monaco é JS-nativo). Rust fica no backend Tauri.

## 3. Fases
- **F0 Fundação:** scaffold monorepo (`website/`, `app/`, `src-tauri/`), `npx shadcn@latest init`, tema escuro, lint/build/test, `.env.example`.
- **F1 Website:** landing page (estrutura aqryl, conteúdo STDHub de estudos).
- **F2 Shell do app:** tela de login (Entrar/Criar conta/Guest) → plataforma; cadastro e primeira entrada como guest perguntam o idioma primeiro (só na primeira vez); sidebar esquerda (5 ícones, clique abre a aba) + painel secundário só para o Editor (móvel à direita); tabs de funções docáveis à direita (arrastar ou menu; Notebook não doca); Config abre só o modal sem selecionar; trio da Fase 2 funcional (T12–T14); menubar shadcn no topo (File: abrir pasta de origem, salvar mudanças; Edit; View; Settings).
- **F3 Editor:** explorer estilo VSCode (origem local na Fase 1; GitHub/Drive como origem na fase própria), árvore + ícone por extensão, syntax highlight + autocomplete por linguagem (Monaco self-hosted, sem CDN), tabs de arquivos, botão setinha → novo terminal integrado na pasta (painel inferior, múltiplas abas, PowerShell no Windows / shell padrão no Linux, só Tauri; web avisa); context menu shadcn como padrão global (explorer e tabs na Fase 1; Pesquisa, Chatbot e demais na Fase 2, cada um com ações próprias).
- **F4 Config:** tema/cores, densidade/design, troca de API de pesquisa e de IA (lendo `.env`), tela preparada para chaves futuras; persiste em arquivo escondido local (pasta de dados do app; IndexedDB na web).
- **F5 Nuvem (banco TBD):** Auth real, perfis, Storage de arquivos, sync + migração guest→conta; tabela de settings por usuário com sync local-first pelo mais recente. Auth email+senha foi adiantada em T11a (Supabase, removido em T11b — ver task.md); Storage/sync/migração seguem pendentes da escolha do banco.
- **F6–F8 (Fase 2):** Calculadora (toggle científica + copiar), Pesquisa (DuckDuckGo + resumo IA), Chatbot (agente local, sessões, editar/excluir mensagens; histórico exportável p/ Drive/GitHub + sync STDHub p/ logados).

## 4. Decisões em aberto (travar antes da F6)
1. Runner de código no Editor web: só preview MD/JS ou execução real?
2. Provedor gratuito de resumo IA (OpenRouter/Pollinations/Ollama/BYOK?).
3. OAuth GitHub/Drive: app OAuth próprio ou token do usuário?

## 5. Quality gate (regra permanente do usuário)
Uma task por vez, sequencial. Só avança após: teste executado e passando, funcionamento 100% sem erros e revisão de segurança (sem segredos no repo, sem comando destrutivo, deps verificadas). Evidência registrada no task.md.
