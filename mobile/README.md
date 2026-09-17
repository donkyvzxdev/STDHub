# STDHub Mobile — workspace de estudos simples, rápido e leve

> Só para estudantes. Interface simples na superfície, potência por baixo.
> Lógica (calculadora, IA, pesquisa, chat) **reutilizada do desktop** via
> alias `@shared` — nunca copiada. Estado do projeto em `task.md` (T18).

## O que funciona (protótipo utilizável)

- **Onboarding:** splash → idioma (EN/PT, troca ao vivo) → tour 7 passos
  (pulável) → aviso de modo avançado → Home.
- **Home:** saudação, ações rápidas, continuar estudando (notas, conversa,
  pesquisas), próximos eventos, atalhos.
- **Notebook:** lista, editor Markdown simples (toolbar, undo/redo,
  edit/preview), autosave com indicador, **calculadora em bottom sheet
  com Inserir no cursor**, perguntar ao Tutor com trecho selecionado,
  compartilhar, excluir com confirmação.
- **Pesquisa:** DuckDuckGo/Brave, resposta instantânea, resumo de IA com
  fontes separadas, ações de estudo (explicar/tópicos/perguntas/salvar/
  perguntar), histórico local.
- **Tutor:** chat com sessões (drawer: nova/renomear/excluir **com
  confirmação**), editar resposta, salvar no Notebook, contexto vindo da
  pesquisa/notas. Mesma IA configurada no desktop (conceito).
- **Calculadora:** engine compartilhada, básica/científica, histórico
  (toque copia), `%` divide por 100 (amigável; engine mantém módulo).
- **Calendário:** grade mensal, criar/editar/excluir (com confirmação),
  lembretes locais (permissão só com contexto), Home mostra próximos.
- **Arquivos:** pastas + notas `.md` reais offline (AppData no device),
  criar/renomear/mover/excluir (pastas com confirmação), compartilhar,
  modo avançado mostra caminhos.
- **Config:** seções (Aparência/Idioma/IA/Pesquisa/Notebook/Calendário/
  Integrações/Avançado/Sobre), tema sistema/claro/escuro, accents,
  fundos (padrão/suave/OLED/claro), densidade, fonte, modo básico/
  avançado. Integrações (Drive/OneDrive/GitHub) honestas: "em breve".
- Offline-first: Notebook/calculadora/calendário/arquivos/settings
  funcionam sem rede; pílula "Offline" discreta; erros em linguagem
  humana (nunca códigos crus).

## Stack (cada dep tem um motivo)

- Tauri 2 + React + TS + Vite (igual ao desktop).
- `@tauri-apps/plugin-fs` — arquivos `.md` reais offline.
- `@tauri-apps/plugin-notification` — lembretes (com fallback).
- `lucide-react` — ícones consistentes (tree-shaken).
- `vitest/jsdom/testing-library` + `oxlint` — mesmo padrão de qualidade.
- Sem router (navegação por estado), sem i18next (i18n próprio de 60
  linhas), sem Tailwind/shadcn (tokens CSS próprios, ~leve), sem
  Monaco (editor simples + preview próprio, seguro por construção).

## Comandos

```sh
cd mobile
npm install
npm run dev      # navegador http://localhost:5174
npm run test     # vitest
npm run lint     # oxlint
npm run build    # tsc + vite

# No dispositivo (precisa do setup abaixo):
npx tauri android dev   # Android Studio + SDK + NDK + targets Rust
npx tauri ios dev       # macOS + Xcode
```

Pré-requisitos mobile: https://v2.tauri.app/start/prerequisites/

## Decisões que faltam (suas, quando voltar)

1. Streaming no chat agora ou depois?
2. Proxy Tauri p/ IA (resolve CORS + cofre de chaves)?
3. Banco/sync (vale pros dois apps)?
4. Upload de imagens locais (binário) vs só URL?
5. Android primeiro?
