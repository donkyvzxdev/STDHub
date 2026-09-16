import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n'
import { loadSettings } from './lib/settings'
import { applyTheme } from './lib/theme'
import App from './App.tsx'

void loadSettings().then(applyTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
