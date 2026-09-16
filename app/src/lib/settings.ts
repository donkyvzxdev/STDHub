import {
  mkdir,
  readTextFile,
  writeTextFile,
  BaseDirectory,
} from '@tauri-apps/plugin-fs'
import { isTauriRuntime } from './tauriFs'

export type ThemeMode = 'dark' | 'light'
export type AccentId =
  | 'neutral'
  | 'amber'
  | 'blue'
  | 'emerald'
  | 'violet'
  | 'rose'
export type Density = 'comfortable' | 'compact'
export type AiPresetId =
  | 'pollinations'
  | 'openai'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'ollama'
  | 'custom'
export type SearchProviderId = 'duckduckgo' | 'brave'

export interface Settings {
  theme: {
    mode: ThemeMode
    accent: AccentId
    density: Density
  }
  keys: {
    chatbot: string
    search: string
  }
  ai: {
    preset: AiPresetId
    baseUrl: string
    apiKey: string
    model: string
  }
  search: {
    provider: SearchProviderId
    braveKey: string
  }
}

export const DEFAULT_AI = {
  preset: 'pollinations',
  baseUrl: 'https://text.pollinations.ai/openai',
  apiKey: '',
  model: 'openai',
} as const

export const DEFAULT_SETTINGS: Settings = {
  theme: { mode: 'dark', accent: 'neutral', density: 'comfortable' },
  keys: { chatbot: '', search: '' },
  ai: { ...DEFAULT_AI },
  search: { provider: 'duckduckgo', braveKey: '' },
}

const ACCENTS: readonly AccentId[] = [
  'neutral',
  'amber',
  'blue',
  'emerald',
  'violet',
  'rose',
]

const AI_PRESETS: readonly AiPresetId[] = [
  'pollinations',
  'openai',
  'openrouter',
  'deepseek',
  'groq',
  'ollama',
  'custom',
]

const SEARCH_PROVIDERS: readonly SearchProviderId[] = [
  'duckduckgo',
  'brave',
]

const STORAGE_KEY = 'stdhub.settings'
const CONFIG_FILE = 'stdhub/config.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Deep-merge with validation: unknown/corrupt input always yields safe settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  if (!isRecord(raw)) return out
  const theme = raw['theme']
  if (isRecord(theme)) {
    if (theme['mode'] === 'dark' || theme['mode'] === 'light') {
      out.theme.mode = theme['mode']
    }
    if (
      typeof theme['accent'] === 'string' &&
      (ACCENTS as readonly string[]).includes(theme['accent'])
    ) {
      out.theme.accent = theme['accent'] as AccentId
    }
    if (theme['density'] === 'comfortable' || theme['density'] === 'compact') {
      out.theme.density = theme['density']
    }
  }
  const keys = raw['keys']
  if (isRecord(keys)) {
    if (typeof keys['chatbot'] === 'string') out.keys.chatbot = keys['chatbot']
    if (typeof keys['search'] === 'string') out.keys.search = keys['search']
  }
  const ai = raw['ai']
  if (isRecord(ai)) {
    if (
      typeof ai['preset'] === 'string' &&
      (AI_PRESETS as readonly string[]).includes(ai['preset'])
    ) {
      out.ai.preset = ai['preset'] as AiPresetId
    }
    if (typeof ai['baseUrl'] === 'string') out.ai.baseUrl = ai['baseUrl']
    if (typeof ai['apiKey'] === 'string') out.ai.apiKey = ai['apiKey']
    if (typeof ai['model'] === 'string') out.ai.model = ai['model']
  }
  const search = raw['search']
  if (isRecord(search)) {
    if (
      typeof search['provider'] === 'string' &&
      (SEARCH_PROVIDERS as readonly string[]).includes(search['provider'])
    ) {
      out.search.provider = search['provider'] as SearchProviderId
    }
    if (typeof search['braveKey'] === 'string') {
      out.search.braveKey = search['braveKey']
    }
  }
  // Migrate pre-prototype keys so saved values keep working.
  if (out.ai.apiKey === '' && out.keys.chatbot !== '') {
    out.ai.apiKey = out.keys.chatbot
  }
  if (out.search.braveKey === '' && out.keys.search !== '') {
    out.search.braveKey = out.keys.search
  }
  return out
}

export async function loadSettings(): Promise<Settings> {
  if (isTauriRuntime()) {
    try {
      const raw = await readTextFile(CONFIG_FILE, {
        baseDir: BaseDirectory.AppConfig,
      })
      return sanitizeSettings(JSON.parse(raw))
    } catch {
      return sanitizeSettings(undefined)
    }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeSettings(JSON.parse(raw)) : sanitizeSettings(undefined)
  } catch {
    return sanitizeSettings(undefined)
  }
}

/**
 * Persists settings to the hidden per-user store: `$APPCONFIG/stdhub/`
 * on desktop, localStorage on web. API keys live ONLY here — never logged,
 * never committed, never sent anywhere by this function.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const clean = sanitizeSettings(settings)
  if (isTauriRuntime()) {
    await mkdir('stdhub', {
      baseDir: BaseDirectory.AppConfig,
      recursive: true,
    })
    await writeTextFile(CONFIG_FILE, JSON.stringify(clean, null, 2), {
      baseDir: BaseDirectory.AppConfig,
    })
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  } catch {
    // Storage full or blocked — settings apply for this session only.
  }
}
