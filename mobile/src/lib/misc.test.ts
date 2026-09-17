import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSearchHistory,
  loadSearchHistory,
  pushSearchHistory,
} from './searchHistory'
import { copyText, shareText } from './share'
import { reminderAtSeconds, reminderIdFor } from '../services/notify'
import { applyThemePrefs, resolveDark } from '../state/theme'

beforeEach(() => {
  window.localStorage.clear()
})

describe('search history', () => {
  it('pushes, dedupes, caps and clears', () => {
    expect(loadSearchHistory()).toEqual([])
    pushSearchHistory('  cats  ')
    pushSearchHistory('dogs')
    pushSearchHistory('cats')
    expect(loadSearchHistory()).toEqual(['cats', 'dogs'])
    clearSearchHistory()
    expect(loadSearchHistory()).toEqual([])
  })
})

describe('share', () => {
  it('uses the OS sheet when available', async () => {
    const share = vi.fn(async () => undefined)
    Object.defineProperty(window.navigator, 'share', {
      value: share,
      configurable: true,
    })
    expect(await shareText('hello')).toBe('shared')
    expect(share).toHaveBeenCalledTimes(1)
    delete (window.navigator as unknown as Record<string, unknown>)['share']
  })

  it('falls back to the clipboard', async () => {
    const writes: string[] = []
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          writes.push(text)
          return Promise.resolve()
        },
      },
      configurable: true,
    })
    expect(await shareText('hello')).toBe('copied')
    expect(await copyText('x')).toBe(true)
    expect(writes).toEqual(['hello', 'x'])
  })
})

describe('reminders', () => {
  it('computes stable ids and fire times', () => {
    expect(reminderIdFor('abc')).toBe(reminderIdFor('abc'))
    expect(reminderAtSeconds('2026-09-20', '08:00', 30)).toBe(
      Math.floor(new Date(2026, 8, 20, 8, 0).getTime() / 1000) - 1800,
    )
    expect(reminderAtSeconds('2026-09-20', '', 30)).toBeNull()
    expect(reminderAtSeconds('2026-09-20', '08:00', -1)).toBeNull()
  })
})

describe('theme prefs', () => {
  it('resolves and applies', () => {
    expect(resolveDark({ theme: 'dark' } as never)).toBe(true)
    expect(resolveDark({ theme: 'light' } as never)).toBe(false)
    applyThemePrefs({
      theme: 'dark',
      accent: 'violet',
      bg: 'oled',
      density: 'comfortable',
      fontScale: 1,
    })
    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(document.documentElement.dataset['accent']).toBe('violet')
    expect(document.documentElement.dataset['bg']).toBe('oled')
    // light forces the light background preset off
    applyThemePrefs({
      theme: 'light',
      accent: 'blue',
      bg: 'oled',
      density: 'normal',
      fontScale: 1.1,
    })
    expect(document.documentElement.dataset['bg']).toBe('light')
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.1')
  })
})
