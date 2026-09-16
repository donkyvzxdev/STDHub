import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AccentId,
  type AiPresetId,
  type Density,
  type SearchProviderId,
  type Settings,
  type ThemeMode,
} from '@/lib/settings'
import { AI_PRESETS, chatCompletion } from '@/lib/ai'
import {
  setLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/lib/i18n'
import { applyTheme } from '@/lib/theme'

const NATIVE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  pt: 'Português',
}

const ACCENTS: { id: AccentId; swatch: string }[] = [
  { id: 'neutral', swatch: '#737373' },
  { id: 'amber', swatch: '#f59e0b' },
  { id: 'blue', swatch: '#3b82f6' },
  { id: 'emerald', swatch: '#10b981' },
  { id: 'violet', swatch: '#8b5cf6' },
  { id: 'rose', swatch: '#f43f5e' },
]

function SettingsView() {
  const { t, i18n } = useTranslation()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  const [aiPreset, setAiPreset] = useState<AiPresetId>('pollinations')
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiKey, setAiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [searchProvider, setSearchProvider] =
    useState<SearchProviderId>('duckduckgo')
  const [braveKey, setBraveKey] = useState('')
  const [notice, setNotice] = useState('')
  const [testing, setTesting] = useState(false)
  const [lang, setLang] = useState<SupportedLanguage>(() => {
    const base = i18n.language.split('-')[0]
    return base === 'pt' ? 'pt' : 'en'
  })

  function changeLanguage(value: string[]): void {
    const next = value[0]
    if (next !== 'en' && next !== 'pt') return
    setLang(next)
    void setLanguage(next).catch(() => {
      // Active language already switched; persistence retried next save.
    })
  }

  useEffect(() => {
    let alive = true
    loadSettings().then((loaded) => {
      if (!alive) return
      setSettings(loaded)
      setAiPreset(loaded.ai.preset)
      setAiBaseUrl(loaded.ai.baseUrl)
      setAiKey(loaded.ai.apiKey)
      setAiModel(loaded.ai.model)
      setSearchProvider(loaded.search.provider)
      setBraveKey(loaded.search.braveKey)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  async function persist(next: Settings): Promise<void> {
    setSettings(next)
    applyTheme(next)
    try {
      await saveSettings(next)
      setNotice(t('settings.saved'))
    } catch {
      setNotice(t('settings.saveFailed'))
    }
  }

  async function setTheme(patch: Partial<Settings['theme']>): Promise<void> {
    await persist({ ...settings, theme: { ...settings.theme, ...patch } })
  }

  async function saveProviders(): Promise<void> {
    await persist({
      ...settings,
      keys: { chatbot: aiKey, search: braveKey },
      ai: { preset: aiPreset, baseUrl: aiBaseUrl, apiKey: aiKey, model: aiModel },
      search: { provider: searchProvider, braveKey },
    })
  }

  function pickPreset(preset: AiPresetId): void {
    setAiPreset(preset)
    const defaults = AI_PRESETS[preset]
    if (preset !== 'custom') {
      setAiBaseUrl(defaults.baseUrl)
      setAiModel(defaults.model)
    }
  }

  async function testConnection(): Promise<void> {
    setTesting(true)
    try {
      await chatCompletion(
        { baseUrl: aiBaseUrl, apiKey: aiKey, model: aiModel },
        [{ role: 'user', content: 'Reply with exactly: ok' }],
      )
      setNotice(t('settings.aiTestOk'))
    } catch (e) {
      setNotice(
        t('settings.aiTestFail', {
          message: e instanceof Error ? e.message : 'error',
        }),
      )
    } finally {
      setTesting(false)
    }
  }

  if (!ready) {
    return <p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  const { mode, accent, density } = settings.theme

  function setMode(value: string[]): void {
    const next = value[0]
    if (next === 'dark' || next === 'light') void setTheme({ mode: next })
  }

  function setDensity(value: string[]): void {
    const next = value[0]
    if (next === 'comfortable' || next === 'compact') {
      void setTheme({ density: next as Density })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 text-left">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearance')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('settings.mode')}</p>
            <ToggleGroup
              variant="outline"
              value={[mode satisfies ThemeMode]}
              onValueChange={setMode}
            >
              <ToggleGroupItem value="dark" aria-label={t('settings.dark')}>
                <Moon aria-hidden />
                {t('settings.dark')}
              </ToggleGroupItem>
              <ToggleGroupItem value="light" aria-label={t('settings.light')}>
                <Sun aria-hidden />
                {t('settings.light')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('settings.accent')}</p>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={a.id}
                  aria-pressed={accent === a.id}
                  title={a.id}
                  onClick={() => void setTheme({ accent: a.id })}
                  style={{ backgroundColor: a.swatch }}
                  className={
                    accent === a.id
                      ? 'size-8 rounded-full ring-2 ring-ring ring-offset-2 ring-offset-background'
                      : 'size-8 rounded-full opacity-70 hover:opacity-100'
                  }
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('settings.density')}</p>
            <ToggleGroup
              variant="outline"
              value={[density]}
              onValueChange={setDensity}
            >
              <ToggleGroupItem value="comfortable" aria-label={t('settings.comfortable')}>
                {t('settings.comfortable')}
              </ToggleGroupItem>
              <ToggleGroupItem value="compact" aria-label={t('settings.compact')}>
                {t('settings.compact')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('settings.language')}</p>
            <ToggleGroup
              variant="outline"
              value={[lang]}
              onValueChange={changeLanguage}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <ToggleGroupItem
                  key={l}
                  value={l}
                  aria-label={NATIVE_NAMES[l]}
                >
                  {NATIVE_NAMES[l]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.aiTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{t('settings.aiPreset')}</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                Object.keys(AI_PRESETS) as AiPresetId[]
              ).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={aiPreset === preset ? 'default' : 'outline'}
                  onClick={() => pickPreset(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stdhub-ai-url">{t('settings.aiBaseUrl')}</Label>
            <Input
              id="stdhub-ai-url"
              type="text"
              autoComplete="off"
              placeholder="https://…/v1"
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stdhub-ai-model">{t('settings.aiModel')}</Label>
            <Input
              id="stdhub-ai-model"
              type="text"
              autoComplete="off"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stdhub-ai-key">{t('settings.aiKey')}</Label>
            <Input
              id="stdhub-ai-key"
              type="password"
              autoComplete="off"
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.keysNote')} {t('settings.freeNote')}
          </p>
          {notice !== '' ? (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={testing}
              onClick={() => void testConnection()}
            >
              {t('settings.aiTest')}
            </Button>
            <Button type="button" variant="outline" onClick={() => void saveProviders()}>
              {t('settings.saveProviders')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.searchTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{t('settings.searchProvider')}</p>
            <ToggleGroup
              variant="outline"
              value={[searchProvider]}
              onValueChange={(v) => {
                if (v[0] === 'duckduckgo' || v[0] === 'brave') {
                  const next = v[0]
                  setSearchProvider(next)
                  void persist({
                    ...settings,
                    search: { provider: next, braveKey },
                  })
                }
              }}
            >
              <ToggleGroupItem value="duckduckgo" aria-label="DuckDuckGo">
                DuckDuckGo
              </ToggleGroupItem>
              <ToggleGroupItem value="brave" aria-label="Brave">
                Brave
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stdhub-key-brave">{t('settings.braveKey')}</Label>
            <Input
              id="stdhub-key-brave"
              type="password"
              autoComplete="off"
              value={braveKey}
              onChange={(e) => setBraveKey(e.target.value)}
            />
          </div>
          <div>
            <Button type="button" variant="outline" onClick={() => void saveProviders()}>
              {t('settings.saveProviders')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsView
