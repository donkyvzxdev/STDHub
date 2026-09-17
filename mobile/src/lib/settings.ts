import {
  DEFAULT_AI_CONFIG,
  DEFAULT_SEARCH_CONFIG,
  sanitizeAiConfig,
  sanitizeSearchConfig,
  type AiConfig,
  type SearchConfig,
} from '@shared/lib/providerSchemas'
import type { MobileAccent, MobileBg, MobileDensity, MobileTheme } from '../state/theme'
import type { MobileLanguage } from '../state/i18n'

export interface MobileSettings {
  lang: MobileLanguage | null
  onboarded: boolean
  tourSeen: boolean
  advanced: boolean
  theme: MobileTheme
  accent: MobileAccent
  bg: MobileBg
  density: MobileDensity
  fontScale: number
  ai: AiConfig
  search: SearchConfig
  autosave: boolean
  defaultNoteView: 'edit' | 'preview'
  weekStartsMonday: boolean
  defaultReminder: number
  quickActions: string[]
}

export const DEFAULT_SETTINGS: MobileSettings = {
  lang: null,
  onboarded: false,
  tourSeen: false,
  advanced: false,
  theme: 'system',
  accent: 'blue',
  bg: 'default',
  density: 'comfortable',
  fontScale: 1,
  ai: { ...DEFAULT_AI_CONFIG },
  search: { ...DEFAULT_SEARCH_CONFIG },
  autosave: true,
  defaultNoteView: 'edit',
  weekStartsMonday: false,
  defaultReminder: 30,
  quickActions: ['note', 'search', 'tutor', 'calc'],
}

const STORAGE_KEY = 'stdhub.mobile.settings'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

/** Validate stored settings; unknown/corrupt input falls back field by field. */
export function sanitizeSettings(raw: unknown): MobileSettings {
  const out: MobileSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  if (!isRecord(raw)) return out
  if (raw['lang'] === 'en' || raw['lang'] === 'pt') out.lang = raw['lang']
  if (typeof raw['onboarded'] === 'boolean') out.onboarded = raw['onboarded']
  if (typeof raw['tourSeen'] === 'boolean') out.tourSeen = raw['tourSeen']
  if (typeof raw['advanced'] === 'boolean') out.advanced = raw['advanced']
  if (oneOf(raw['theme'], ['system', 'light', 'dark'])) out.theme = raw['theme']
  if (oneOf(raw['accent'], ['blue', 'violet', 'green', 'amber', 'red'])) {
    out.accent = raw['accent']
  }
  if (oneOf(raw['bg'], ['default', 'soft', 'oled', 'light'])) out.bg = raw['bg']
  if (oneOf(raw['density'], ['compact', 'normal', 'comfortable'])) {
    out.density = raw['density']
  }
  if (typeof raw['fontScale'] === 'number' && Number.isFinite(raw['fontScale'])) {
    out.fontScale = Math.min(1.3, Math.max(0.85, raw['fontScale']))
  }
  out.ai = sanitizeAiConfig(raw['ai'])
  out.search = sanitizeSearchConfig(raw['search'])
  if (typeof raw['autosave'] === 'boolean') out.autosave = raw['autosave']
  if (raw['defaultNoteView'] === 'edit' || raw['defaultNoteView'] === 'preview') {
    out.defaultNoteView = raw['defaultNoteView']
  }
  if (typeof raw['weekStartsMonday'] === 'boolean') {
    out.weekStartsMonday = raw['weekStartsMonday']
  }
  if (typeof raw['defaultReminder'] === 'number' && Number.isFinite(raw['defaultReminder'])) {
    out.defaultReminder = raw['defaultReminder']
  }
  if (Array.isArray(raw['quickActions'])) {
    const kept = raw['quickActions'].filter(
      (a): a is string =>
        typeof a === 'string' && ['note', 'search', 'tutor', 'calc'].includes(a),
    )
    if (kept.length > 0) out.quickActions = kept
  }
  return out
}

export function loadSettings(): MobileSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeSettings(JSON.parse(raw)) : sanitizeSettings(undefined)
  } catch {
    return sanitizeSettings(undefined)
  }
}

export function storeSettings(settings: MobileSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)))
  } catch {
    // Storage full or blocked — settings apply for this session only.
  }
}
