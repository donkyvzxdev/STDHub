import type { Settings } from './settings'

/** Applies the theme to <html>: mode class, accent and density attributes. */
export function applyTheme(settings: Settings): void {
  const root = document.documentElement
  root.classList.toggle('dark', settings.theme.mode === 'dark')
  root.style.colorScheme = settings.theme.mode
  if (settings.theme.accent === 'neutral') {
    root.removeAttribute('data-accent')
  } else {
    root.setAttribute('data-accent', settings.theme.accent)
  }
  if (settings.theme.density === 'compact') {
    root.setAttribute('data-density', 'compact')
  } else {
    root.removeAttribute('data-density')
  }
}
