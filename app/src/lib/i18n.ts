import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import pt from '../locales/pt.json'

export const SUPPORTED_LANGUAGES = ['en', 'pt'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'
export const LANGUAGE_STORAGE_KEY = 'stdhub.language'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}

function normalize(
  code: string | undefined | null,
): SupportedLanguage | null {
  if (!code) return null
  const base = code.toLowerCase().split('-')[0]
  const supported: readonly string[] = SUPPORTED_LANGUAGES
  return supported.includes(base) ? (base as SupportedLanguage) : null
}

/**
 * Detected language: stored choice first, then OS/browser locale,
 * then English. Fully local — nothing leaves the device.
 */
export function detectLanguage(): SupportedLanguage {
  try {
    const fromStored = normalize(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
    if (fromStored) return fromStored
  } catch {
    // Storage unavailable (e.g. private mode) — fall through to locale.
  }
  const fromLocale =
    typeof navigator !== 'undefined' ? normalize(navigator.language) : null
  return fromLocale ?? DEFAULT_LANGUAGE
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch {
    // Storage unavailable — language still applies for this session.
  }
  await i18n.changeLanguage(lang)
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
})

export default i18n
