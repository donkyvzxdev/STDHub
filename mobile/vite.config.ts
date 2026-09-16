import react from '@vitejs/plugin-react'
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
})
