import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri mobile serves from a custom protocol — keep assets relative.
  base: './',
  server: {
    host: true,
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Single source of truth: pure desktop logic (calculator, AI,
      // search, chat, provider schemas) is imported, never copied.
      '@shared': path.resolve(import.meta.dirname, '../app/src'),
    },
  },
})
