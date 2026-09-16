# STDHub Mobile (placeholder leve)

App mobile do STDHub: simples, leve, **só para estudantes**.
Ainda não há telas reais — este scaffold só prova que o shell Tauri +
frontend sobem no dispositivo. As telas chegam com o `spec-mobile.md`.

## O que já existe

- `src/` — React mínimo (3 abas placeholder: Study, Chat, Calc), sem
  shadcn, sem router, sem estado global. De propósito: leve.
- `src-tauri/` — shell Tauri com `mobile_entry_point`, permissão mínima
  (`core:default`) e log. Sem FS, sem PTY, sem plugins (adicionar com o spec).

## Pré-requisitos (só quando for rodar no celular)

- Android: Android Studio + SDK + NDK + `rustup target add aarch64-linux-android ...`
- iOS: macOS + Xcode
- Detalhes: https://v2.tauri.app/start/prerequisites/

## Comandos

```sh
cd mobile
npm install
npm run dev        # frontend no navegador (http://localhost:5174)

# No dispositivo/emulador (precisa do setup acima):
npx tauri android dev
npx tauri ios dev
```

## Antes do spec, decidir

1. Android primeiro, iOS depois, ou os dois?
2. O que entra no MVP: só Chat/Calc/Study? Editor entra?
3. Mesma conta do desktop (depende da decisão do banco — ver
   `feedback-prototipos.md`)? Offline-first com sync depois?
4. Ícones do app (`src-tauri/icons/`) — gerar com
   `npx tauri icon assets/icon.png` quando houver logo.
