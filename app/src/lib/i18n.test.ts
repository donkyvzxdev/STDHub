import { beforeEach, describe, expect, it } from 'vitest'
import i18n, {
  DEFAULT_LANGUAGE,
  detectLanguage,
  LANGUAGE_STORAGE_KEY,
  setLanguage,
} from './i18n'

function mockNavigatorLanguage(value: string): void {
  Object.defineProperty(window.navigator, 'language', {
    value,
    configurable: true,
  })
}

beforeEach(() => {
  window.localStorage.clear()
  mockNavigatorLanguage('en-US')
})

describe('i18n base', () => {
  it('falls back to English when the locale is unsupported', () => {
    mockNavigatorLanguage('fr-FR')
    expect(detectLanguage()).toBe(DEFAULT_LANGUAGE)
    expect(detectLanguage()).toBe('en')
  })

  it('detects Portuguese for pt-BR systems', () => {
    mockNavigatorLanguage('pt-BR')
    expect(detectLanguage()).toBe('pt')
  })

  it('stored choice wins over OS locale', () => {
    mockNavigatorLanguage('pt-BR')
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    expect(detectLanguage()).toBe('en')
  })

  it('setLanguage switches translations and persists', async () => {
    await setLanguage('pt')
    expect(i18n.language).toBe('pt')
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt')
    expect(i18n.t('common.cancel')).toBe('Cancelar')
    await setLanguage('en')
    expect(i18n.t('common.cancel')).toBe('Cancel')
  })
})
