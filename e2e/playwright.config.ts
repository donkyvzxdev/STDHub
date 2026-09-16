import { defineConfig } from '@playwright/test'

const EDGE =
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: { executablePath: EDGE, args: ['--no-sandbox'] },
  },
})
