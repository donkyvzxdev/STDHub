# STDHub

Local-first study app.

## Prereqs

- Node 24 + npm
- Rust stable (`x86_64-pc-windows-msvc`) + VS 2022 with MSVC + Windows SDK + WebView2 (for `tauri build`)

## Run

```sh
# App (Vite dev, http://localhost:5173)
cd app
npm install
npm run dev

# Desktop shell (needs app/ deps installed)
cd app
npx tauri dev

# Website (Vite dev, http://localhost:5174)
cd website
npm install
npm run dev

# Mobile placeholder (Vite dev, http://localhost:5174; device needs
# Android SDK/Xcode — see mobile/README.md)
cd mobile
npm install
npm run dev
```

## Env

```sh
cp .env.example .env   # root of the repo
```

Fill locally. `.env` is gitignored. Keys are intentionally NOT `VITE_`-prefixed
so they never leak into the client bundle.

## Checks (quality gate — every task)

```sh
cd app && npm run lint && npm run test && npm run build
cd website && npm run lint && npm run build
npm audit --omit=dev
```

One task at a time from `task.md`. A task only closes with tests green,
zero errors and a security review. Nothing is committed without asking.
