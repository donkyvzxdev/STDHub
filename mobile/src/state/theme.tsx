import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type MobileTheme = 'system' | 'light' | 'dark'
export type MobileAccent = 'blue' | 'violet' | 'green' | 'amber' | 'red'
export type MobileBg = 'default' | 'soft' | 'oled' | 'light'
export type MobileDensity = 'compact' | 'normal' | 'comfortable'

export interface ThemePrefs {
  theme: MobileTheme
  accent: MobileAccent
  bg: MobileBg
  density: MobileDensity
  fontScale: number
}

export const DEFAULT_THEME_PREFS: ThemePrefs = {
  theme: 'system',
  accent: 'blue',
  bg: 'default',
  density: 'comfortable',
  fontScale: 1,
}

export function resolveDark(prefs: ThemePrefs): boolean {
  if (prefs.theme === 'light') return false
  if (prefs.theme === 'dark') return true
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return true
}

export function applyThemePrefs(prefs: ThemePrefs): void {
  const root = document.documentElement
  const dark = resolveDark(prefs)
  root.dataset['theme'] = dark ? 'dark' : 'light'
  root.dataset['accent'] = prefs.accent
  root.dataset['bg'] = dark ? prefs.bg : 'light'
  root.dataset['density'] = prefs.density
  root.style.setProperty('--font-scale', String(prefs.fontScale))
}

interface Theme {
  prefs: ThemePrefs
  setPrefs: (patch: Partial<ThemePrefs>) => void
}

const ThemeContext = createContext<Theme | null>(null)

export function ThemeProvider({
  initial,
  onChange,
  children,
}: {
  initial: ThemePrefs
  onChange: (prefs: ThemePrefs) => void
  children: ReactNode
}) {
  const [prefs, setPrefsState] = useState<ThemePrefs>(initial)

  useEffect(() => {
    applyThemePrefs(prefs)
  }, [prefs])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChangeMedia = (): void => {
      // Re-resolve only in system mode (state bump re-applies).
      setPrefsState((prev) => ({ ...prev }))
    }
    mq.addEventListener('change', onChangeMedia)
    return () => mq.removeEventListener('change', onChangeMedia)
  }, [])

  const setPrefs = (patch: Partial<ThemePrefs>): void => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch }
      onChange(next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme outside provider')
  return ctx
}
