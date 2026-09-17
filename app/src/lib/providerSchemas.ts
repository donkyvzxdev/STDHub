/**
 * Provider sub-schemas shared by desktop and mobile (pure: zero imports).
 * The AI/search shapes are identical in both apps — single source of truth.
 * Desktop keeps its legacy `keys` migration in `settings.ts`; mobile
 * builds its own settings around these same blocks.
 */
export type AiPresetId =
  | 'pollinations'
  | 'openai'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'ollama'
  | 'custom'

export interface AiConfig {
  preset: AiPresetId
  baseUrl: string
  apiKey: string
  model: string
}

export type SearchProviderId = 'duckduckgo' | 'brave'

export interface SearchConfig {
  provider: SearchProviderId
  braveKey: string
}

export const AI_PRESET_IDS: readonly AiPresetId[] = [
  'pollinations',
  'openai',
  'openrouter',
  'deepseek',
  'groq',
  'ollama',
  'custom',
]

export const SEARCH_PROVIDER_IDS: readonly SearchProviderId[] = [
  'duckduckgo',
  'brave',
]

export const DEFAULT_AI_CONFIG: AiConfig = {
  preset: 'pollinations',
  baseUrl: 'https://text.pollinations.ai/openai',
  apiKey: '',
  model: 'openai',
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  provider: 'duckduckgo',
  braveKey: '',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Validate an AI block; unknown/corrupt input falls back field by field. */
export function sanitizeAiConfig(raw: unknown): AiConfig {
  const out: AiConfig = { ...DEFAULT_AI_CONFIG }
  if (!isRecord(raw)) return out
  if (
    typeof raw['preset'] === 'string' &&
    (AI_PRESET_IDS as readonly string[]).includes(raw['preset'])
  ) {
    out.preset = raw['preset'] as AiPresetId
  }
  if (typeof raw['baseUrl'] === 'string') out.baseUrl = raw['baseUrl']
  if (typeof raw['apiKey'] === 'string') out.apiKey = raw['apiKey']
  if (typeof raw['model'] === 'string') out.model = raw['model']
  return out
}

/** Validate a search block; unknown/corrupt input falls back field by field. */
export function sanitizeSearchConfig(raw: unknown): SearchConfig {
  const out: SearchConfig = { ...DEFAULT_SEARCH_CONFIG }
  if (!isRecord(raw)) return out
  if (
    typeof raw['provider'] === 'string' &&
    (SEARCH_PROVIDER_IDS as readonly string[]).includes(raw['provider'])
  ) {
    out.provider = raw['provider'] as SearchProviderId
  }
  if (typeof raw['braveKey'] === 'string') out.braveKey = raw['braveKey']
  return out
}
