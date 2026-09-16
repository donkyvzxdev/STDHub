import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import { applyTheme } from './theme'

afterEach(() => {
  document.documentElement.classList.add('dark')
  document.documentElement.removeAttribute('data-accent')
  document.documentElement.removeAttribute('data-density')
})

describe('T10 theme', () => {
  it('applies dark mode by default', () => {
    applyTheme(DEFAULT_SETTINGS)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-accent')).toBeNull()
    expect(document.documentElement.getAttribute('data-density')).toBeNull()
  })

  it('switches mode, accent and density', () => {
    applyTheme({
      ...DEFAULT_SETTINGS,
      theme: { mode: 'light', accent: 'blue', density: 'compact' },
    })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-accent')).toBe('blue')
    expect(document.documentElement.getAttribute('data-density')).toBe('compact')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
