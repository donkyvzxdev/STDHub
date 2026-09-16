# STDHub — Resumo completo do projeto (do zero até 2026-09-15)

> Documento de leitura para quem chega agora (ou para o GitHub).
> Fontes: `spec.md` (regras), `plan.md` (arquitetura/fases), `task.md`
> (histórico task a task com log), `feedback-prototipos.md` (prós/contras
> dos protótipos) e o código em `app/`, `website/`, `mobile/`, `e2e/`.

---

## 1. O que é

O **STDHub** é um workspace de estudos **local-first**: um app desktop
(janela própria) que funciona **100% offline como convidado**, com editor
estilo VSCode, calculadora, pesquisa com resumo de IA, chatbot tutor,
terminal integrado e configurações. Website de divulgação + scaffold de
app mobile acompanham no mesmo repositório.

**Dois perfis:**
- **Guest (convidado):** tudo local na máquina. Pode exportar via GitHub
  (futuro T15) ou Google Drive (futuro T16). Entrar não exige conta.
- **Logado:** tudo do guest + nuvem STDHub (servidor próprio) — **ainda
  não implementado**: o banco está TBD (SQL próprio ou Supabase, T11).

**Regra permanente (§11 do spec):** execução sequencial pelo `task.md`,
uma task por vez; só fecha task com teste 100% verde + revisão de
segurança (sem segredos no repo, sem comando destrutivo, deps auditadas).

---

## 2. Estrutura do repositório

```
STDHub/
├── app/                  # App desktop (React + Vite + Tauri)
│   ├── src/              # components/{calculator,chat,editor,login,onboarding,
│   │                     #   settings,shell,terminal,ui} + lib/ + locales/
│   ├── src-tauri/        # Backend Rust (fs scope, PTY, terminal externo)
│   └── dist/             # Build web (gerado)
├── website/              # Landing page (Vite estático)
├── mobile/               # Scaffold do app mobile (Tauri + React mínimo)
├── e2e/                  # Testes end-to-end (Playwright + Edge real)
├── spec.md               # Fonte da verdade (regras, v1.1)
├── plan.md               # Arquitetura e fases
├── task.md               # Execução sequencial + log de cada task
├── feedback-prototipos.md# Prós/contras dos protótipos p/ decisão
├── spec-resumo.md        # Resumo antigo do entendimento (v0.1)
├── .env.example          # Modelo de env (sem segredos; .env ignorado)
└── resumo.md             # Este arquivo
```

---

## 3. App desktop (`app/`) — módulo por módulo

### 3.1 Shell e navegação (T04–T06, T05a, T05d)
- Tela de login (Entrar / Criar conta / **Continuar como convidado**);
  login na nuvem **desabilitado honestamente** até a escolha do banco.
- Primeira abertura pergunta o **idioma** (1ª vez só), com sugestão pela
  região do SO; inglês padrão, português incluído, troca no Config.
- Sidebar esquerda (5 ícones fixos: Notebook, Calculadora, Pesquisa,
  Tutor, Config). **Clique abre a aba direto** (botão direito também abre).
- **Painel secundário só para o Editor** (explorador); demais funções não
  têm painel. Painel redimensionável por arrasto.
- **Tabs de funções docáveis à direita** (arrastar a aba ou menu
  "Ancorar à direita"; "Mover para a área principal" traz de volta).
  Views movem **via portais — sem remount, sem perder estado**
  (texto digitado, resultados, conversa). Notebook não doca (preserva o editor).
- **Config abre só o modal**, sem selecionar o botão.
- Menubar shadcn no topo (File/Edit/View/Settings, com atalhos).
- Rodapé da sidebar mostra `build YYYY-MM-DD` (diz qual versão está instalada).

### 3.2 Editor / Notebook (T07–T07o, T08)
- Explorador estilo VSCode no painel (via portal): abrir pasta local,
  árvore com ícone por extensão, botões ⊕ arquivo/pasta no header.
- Aba **preview única** (itálico, reutilizada no clique simples);
  double-click, menu ou **editar fixa** a aba; dirty nunca é descartado.
- Monaco self-hosted (sem CDN): syntax highlight + autocomplete por
  linguagem (`.md/.js/.ts`…), gancho futuro p/ autocomplete próprio.
- Preview de imagens; binário recusado com aviso; limite 1 MB.
- Context menu global (novo/renomear/excluir com confirmação/duplicar/
  copiar caminho/revelar), DnD interno por Pointer Events (pastas e
  arquivos, com fantasma e trava anti-clique-pós-arrasto).
- Ctrl+S / botão save / menubar salvam; fechar sujo pede confirmação.
- Erros de FS aparecem **na sidebar** (evento `stdhub:fs-error`), nunca
  em silêncio; refresh falho nunca apaga a árvore.

### 3.3 Terminal integrado + externo (T09–T09k)
- Painel inferior **escondido por padrão**; botão flutuante ↑ sutil no
  notebook revela (cria terminal só se não houver nenhum) e some com o
  painel aberto. Redimensionável (arrasta a borda, persiste).
- **Multi-abas** com numeração posicional (1..N na ordem, renumera ao
  fechar). Cada aba = PTY real (`portable-pty`): **PowerShell no Windows**,
  `$SHELL`/`sh` no Linux, cwd = pasta aberta **sem prefixo `\\?\`**
  (prompt limpo, não quebra ferramentas).
- **Grupos embaixo + direita independente**: arrasta a aba (pointer-drag
  com fantasma, igual ao explorer) ou menu Mover; sessão PTY sobrevive
  à mudança (só o scrollback recomeça). Último de baixo indo p/ direita
  recolhe o debaixo. Direita redimensionável (persiste). Botão ⬈ abre o
  **terminal externo** (Windows Terminal/PowerShell na pasta).
- ResizeObserver refita o xterm após animações (cura o "terminal em
  branco" do 1º spawn). Na web, aviso honesto (sem PTY no navegador).

### 3.4 Calculadora (T12, protótipo funcional)
- Engine própria (`lib/calculator.ts`): precedência, parênteses, `pi`/`e`,
  multiplicação implícita, trig + inversas (DEG/RAD), log/ln, raízes,
  fatorial, `%` como **módulo**, erros como `CalcError`.
- UI: toggle básica/científica, DEG/RAD, preview ao vivo, `=` com
  histórico persistido e clicável, copiar em 1 clique (botão ou valor),
  teclado (Enter/Escape). 100% local e offline.

### 3.5 Pesquisa com resumo de IA (T13, protótipo funcional)
- `lib/search.ts`: **DuckDuckGo** (grátis, sem chave) + **Brave** (com
  chave) → resposta instantânea + até 10 resultados (abrir/copiar link).
- Resumo estilo AI Overview com citações `[n]`, gerado pelo **modelo de
  IA escolhido no Config** (`lib/ai.ts`, OpenAI-compatible, sem streaming).

### 3.6 Chatbot Tutor (T14, protótipo funcional)
- `lib/chat.ts`: sessões (criar/renomear/excluir/alternar, título auto),
  tudo em localStorage. Editar resposta da IA, excluir própria mensagem,
  copiar, reenviar/regenerar, **salvar no Editor** (cria `.md` na pasta).
- Sem streaming e sem tools de agente (ainda) — ver decisões §7.

### 3.7 Configurações (T10, T10a + extensões)
- Tema escuro shadcn padrão; modo claro/escuro, 6 accents, densidade,
  idioma — tudo via variáveis CSS (qualquer tema aplica nos componentes).
- **Provedor de IA**: presets Pollinations (padrão, grátis, sem chave),
  OpenAI, OpenRouter, DeepSeek, Groq, Ollama local, Custom (URL+modelo
  livres) + **botão Testar conexão**. Chaves antigas migram sozinhas.
- **Pesquisa**: DuckDuckGo / Brave + chave.
- Salvo em arquivo escondido local (`AppConfig/stdhub/`, `localStorage`
  na web). Chaves **só** no cofre local — nunca no repo.

### 3.8 Internacionalização
- Inglês padrão, português completo; `react-i18next`, detecção
  local (nada sai do device), chaves tipadas (`app/src/locales/`).

---

## 4. Design

- **shadcn copiado como código-fonte** (`components/ui`), tema via
  variáveis semânticas; dark default, accents e densidades.
- **Animações suaves globais** (T05c): slide no terminal/painel (grid
  sempre montado), fade+slide nas abas, expandir animado no explorer,
  fade nas telas; `transition` desligada durante arrastos.
- **`prefers-reduced-motion` respeitado** (desliga tudo no SO que pede).
- Ícones Lucide; fonte Geist Variable; Tailwind v4 + `tw-animate-css`;
  container queries no chat (sessões viram seletor em telas estreitas).

---

## 5. Website (`website/`)

Landing estática: nav, hero com **demo interativa do app**, faixa de
confiança, features (6 cards), comparativo, pricing (Free/Pro planejado),
FAQ, CTA final e footer. Validada com screenshot 1440px no Edge
(0 pageerrors). Build estático em `website/dist`.

## 6. Mobile (`mobile/`)

Scaffold leve (T17): Tauri + React mínimo, 3 abas placeholder
(Study/Chat/Cal), sem shadcn/router/estado global de propósito.
Frontend compila (`vite build`), Rust passa (`cargo check`); ícones
reutilizados do desktop. **Build no celular exige Android SDK/Xcode**
(não feito aqui). Telas reais chegam com o futuro `spec-mobile.md`
(app só para estudantes). Detalhes em `mobile/README.md`.

## 7. Stack e decisões importantes

| Área | Escolha | Por quê |
|---|---|---|
| Desktop | Tauri 2 + React 19 + Vite 8 | Webview leve; Rust só no backend |
| Editor | Monaco self-hosted | VSCode de verdade, sem CDN |
| Terminal | `portable-pty` + xterm.js | PTY real (testado: PowerShell via ConPTY executa em 0,5s) |
| Banco/nuvem | **TBD (SQL próprio ou Supabase)** | Supabase **removido** (T11b) pelos preços; `lib/auth` virou provider-agnóstica com seam pronta (`getCloudAuthClient`) |
| IA padrão | Pollinations (grátis, sem chave) | Protótipo funciona out-of-the-box; presets p/ OpenAI/OpenRouter/DeepSeek/Groq/Ollama/Custom |
| Busca padrão | DuckDuckGo (sem chave) | Grátis; Brave opcional com chave |
| Chamadas IA/busca | `fetch` direto do frontend | Simples; **CORS varia** (OpenAI oficial bloqueia browser → futuro proxy Tauri) |
| Testes | Vitest 127→174 unit + Playwright/Edge e2e 3/3 (disco stubado, cliques/mouse reais) | Gate: lint 0 erros + build + `npm audit` 0 + `tauri build` |
| DnD | 100% Pointer Events | Sem quirks de DnD nativo; testável |
| Segredos | `.env` ignorado; chaves só no store local | Varreduras em todo gate |

**Limitações honestas do protótipo** (detalhes em `feedback-prototipos.md`):
sem streaming no chat; sem tools de agente; `%` = módulo; erros de IA
técnicos demais; chaves em texto puro; sem teto de custo; histórico só
local; excluir sessão sem confirmação; DDG limitado.

---

## 8. Histórico (resumo por fase)

- **F0 (06/09):** scaffold monorepo + shadcn + i18n + env/README.
- **F1 (12/09):** landing page completa (T03).
- **F2 shell:** login/guest/idioma (T04–T04a), sidebar+tabs+menubar
  (T05/T05a/T05d — clique abre aba, painel só explorer, dock direita),
  animações (T05c), coming-soon removido (T06→T12-14).
- **F3 editor:** explorer→notebook→Monaco→terminal (T07–T09k: 20+ iterações
  de preview, DnD, erros visíveis, PTY, multi-abas, docks, resizes).
- **F4 config:** tema/densidade/idioma/APIs (T10/T10a) + IA/pesquisa (T12-14).
- **F5 nuvem:** T11a (Supabase, superada) → **T11b removeu tudo** (TBD).
- **Fase 2 protótipos (15/09):** T12 calculadora, T13 pesquisa+IA,
  T14 chatbot — todos funcionais e testados.
- **Mobile (15/09):** T17 scaffold.
- **Aberto:** T11 (banco), T15/16 (GitHub/Drive), streaming, proxy IA,
  confirmação de exclusão, erros amigáveis, agent tools, sync.

---

## 9. Como rodar / testar / buildar

```sh
cd app && npm install && npm run dev        # http://localhost:5173
npx tauri dev                                # janela desktop (dev)
npm run lint && npm run test && npm run build
npm audit --omit=dev
npx tauri build  # msi + setup.exe em app/src-tauri/target/release/bundle/
cd ../e2e && npm install && npm test        # Playwright + Edge (sobe o vite sozinho)
cd ../website && npm install && npm run dev # :5174
cd ../mobile && npm install && npm run dev  # :5174 (placeholder; device: ver mobile/README.md)
```

Instaladores atuais (`bundle/msi` e `bundle/nsis`, build 2026-09-15) já
incluem os 3 protótipos — conferir o `build 2026-09-15` no rodapé da
sidebar após instalar. Versão do app: `0.1.0` (`com.stdhub.desktop`).
Nada foi commitado sem pedido: `git status` mostra tudo untracked.
