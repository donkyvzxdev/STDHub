import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import en from '../locales/en.json'
import pt from '../locales/pt.json'

export type MobileLanguage = 'en' | 'pt'

const RESOURCES = { en, pt } as const

type Nested = { [key: string]: string | string[] | Nested }

function lookup(lang: MobileLanguage, key: string): unknown {
  const parts = key.split('.')
  let node: unknown = RESOURCES[lang] as unknown as Nested
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Nested)[part]
  }
  return node
}

function fill(template: string, vars?: Record<string, string>): string {
  if (!vars) return template
  return template.replace(/{{(\w+)}}/g, (_, name: string) => vars[name] ?? '')
}

interface I18n {
  lang: MobileLanguage
  setLang: (lang: MobileLanguage) => void
  t: (key: string, vars?: Record<string, string>) => string
  tList: (key: string) => { title: string; text: string }[]
}

const I18nContext = createContext<I18n | null>(null)

export function detectLanguage(): MobileLanguage {
  try {
    const stored = window.localStorage.getItem('stdhub.mobile.lang')
    if (stored === 'en' || stored === 'pt') return stored
  } catch {
    // ignore
  }
  const nav =
    typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : ''
  return nav.startsWith('pt') ? 'pt' : 'en'
}

export function I18nProvider({
  initial,
  children,
}: {
  initial: MobileLanguage
  children: ReactNode
}) {
  const [lang, setLangState] = useState<MobileLanguage>(initial)

  const setLang = useCallback((next: MobileLanguage) => {
    setLangState(next)
    try {
      window.localStorage.setItem('stdhub.mobile.lang', next)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo<I18n>(() => {
    const t = (key: string, vars?: Record<string, string>): string => {
      const hit = lookup(lang, key) ?? lookup('en', key)
      return typeof hit === 'string' ? fill(hit, vars) : key
    }
    const tList = (key: string): { title: string; text: string }[] => {
      const hit = lookup(lang, key) ?? lookup('en', key)
      if (!Array.isArray(hit)) return []
      return hit.filter(
        (item): item is { title: string; text: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { title?: unknown }).title === 'string' &&
          typeof (item as { text?: unknown }).text === 'string',
      )
    }
    return { lang, setLang, t, tList }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n outside provider')
  return ctx
}
