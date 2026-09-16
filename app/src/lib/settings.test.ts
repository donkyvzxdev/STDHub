import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AI,
  DEFAULT_SETTINGS,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from './settings'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
  BaseDirectory: { AppConfig: 'AppConfig' },
}))

import {
  mkdir,
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'

const mockRead = vi.mocked(readTextFile)
const mockWrite = vi.mocked(writeTextFile)
const mockMkdir = vi.mocked(mkdir)

function setTauri(on: boolean): void {
  const w = window as unknown as Record<string, unknown>
  if (on) w['__TAURI_INTERNALS__'] = {}
  else delete w['__TAURI_INTERNALS__']
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  setTauri(false)
})

describe('T10 settings store', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('ignores corrupt or partial input', async () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings({ theme: { mode: 'neon' } })).toEqual(
      DEFAULT_SETTINGS,
    )
    expect(
      sanitizeSettings({ theme: { mode: 'light' }, keys: { chatbot: 'x' } }),
    ).toEqual({
      theme: { mode: 'light', accent: 'neutral', density: 'comfortable' },
      keys: { chatbot: 'x', search: '' },
      ai: { ...DEFAULT_AI, apiKey: 'x' },
      search: { provider: 'duckduckgo', braveKey: '' },
    })
  })

  it('validates AI and search sections', () => {
    expect(
      sanitizeSettings({
        ai: { preset: 'nope', baseUrl: 42, apiKey: 'k', model: 'm' },
        search: { provider: 'nope', braveKey: 'b' },
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      ai: { ...DEFAULT_AI, apiKey: 'k', model: 'm' },
      search: { provider: 'duckduckgo', braveKey: 'b' },
    })
    expect(
      sanitizeSettings({
        ai: { preset: 'ollama', baseUrl: 'http://x/v1', model: 'llama' },
      }).ai.preset,
    ).toBe('ollama')
  })

  it('migrates legacy keys', () => {
    const out = sanitizeSettings({ keys: { chatbot: 'old-k', search: 'old-s' } })
    expect(out.ai.apiKey).toBe('old-k')
    expect(out.search.braveKey).toBe('old-s')
    // Explicit new values win over legacy ones.
    const explicit = sanitizeSettings({
      keys: { chatbot: 'old-k', search: '' },
      ai: { preset: 'openai', baseUrl: 'u', apiKey: 'new-k', model: 'm' },
    })
    expect(explicit.ai.apiKey).toBe('new-k')
  })

  it('round-trips through localStorage on web', async () => {
    await saveSettings({
      theme: { mode: 'light', accent: 'blue', density: 'compact' },
      keys: { chatbot: 'sk-test', search: '' },
      ai: {
        preset: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
      },
      search: { provider: 'brave', braveKey: 'b-test' },
    })
    expect(await loadSettings()).toEqual({
      theme: { mode: 'light', accent: 'blue', density: 'compact' },
      keys: { chatbot: 'sk-test', search: '' },
      ai: {
        preset: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
      },
      search: { provider: 'brave', braveKey: 'b-test' },
    })
  })

  it('reads and writes the hidden file on Tauri', async () => {
    setTauri(true)
    mockRead.mockResolvedValue(
      JSON.stringify({
        theme: { mode: 'light', accent: 'rose', density: 'comfortable' },
        keys: { chatbot: '', search: '' },
        ai: { ...DEFAULT_AI },
        search: { provider: 'duckduckgo', braveKey: '' },
      }),
    )
    expect(await loadSettings()).toEqual({
      theme: { mode: 'light', accent: 'rose', density: 'comfortable' },
      keys: { chatbot: '', search: '' },
      ai: { ...DEFAULT_AI },
      search: { provider: 'duckduckgo', braveKey: '' },
    })
    expect(mockRead).toHaveBeenCalledWith('stdhub/config.json', {
      baseDir: 'AppConfig',
    })
    await saveSettings({
      theme: { mode: 'dark', accent: 'amber', density: 'compact' },
      keys: { chatbot: 'k', search: 's' },
      ai: { ...DEFAULT_AI },
      search: { provider: 'duckduckgo', braveKey: '' },
    })
    expect(mockMkdir).toHaveBeenCalledWith('stdhub', {
      baseDir: 'AppConfig',
      recursive: true,
    })
    expect(mockWrite).toHaveBeenCalledWith(
      'stdhub/config.json',
      expect.stringContaining('"amber"'),
      { baseDir: 'AppConfig' },
    )
  })
})
