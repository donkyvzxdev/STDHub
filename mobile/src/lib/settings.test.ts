import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, storeSettings } from './settings'

beforeEach(() => {
  window.localStorage.clear()
})

describe('mobile settings', () => {
  it('returns defaults when empty', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.lang).toBeNull()
    expect(DEFAULT_SETTINGS.onboarded).toBe(false)
  })

  it('sanitizes field by field', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    const out = sanitizeSettings({
      theme: 'neon',
      accent: 'green',
      bg: 'oled',
      density: 'normal',
      fontScale: 99,
      ai: { preset: 'nope', model: 'm' },
      search: { provider: 'nope' },
      quickActions: ['note', 'bogus', 42],
    })
    expect(out.theme).toBe('system')
    expect(out.accent).toBe('green')
    expect(out.bg).toBe('oled')
    expect(out.density).toBe('normal')
    expect(out.fontScale).toBe(1.3)
    expect(out.ai.preset).toBe('pollinations')
    expect(out.ai.model).toBe('m')
    expect(out.search.provider).toBe('duckduckgo')
    expect(out.quickActions).toEqual(['note'])
  })

  it('round-trips', () => {
    const next = {
      ...loadSettings(),
      onboarded: true,
      lang: 'pt' as const,
      ai: { preset: 'ollama' as const, baseUrl: 'u', apiKey: '', model: 'm' },
    }
    storeSettings(next)
    expect(loadSettings()).toEqual(next)
  })
})
