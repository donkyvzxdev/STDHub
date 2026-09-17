import { useEffect, useState, type ReactNode } from 'react'
import { useApp, type SettingsSection } from '../state/app'
import { useI18n } from '../state/i18n'
import { useTheme } from '../state/theme'
import { AI_PRESETS } from '@shared/lib/ai'
import { chatCompletion } from '@shared/lib/ai'
import type { AiPresetId } from '@shared/lib/providerSchemas'
import { getFs } from '../lib/fs'
import { listNotes } from '../lib/notes'
import { loadEvents } from '../lib/calendar'
import { loadSessions } from '@shared/lib/chat'
import { TopBar, BackButton } from '../components/navigation'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Btn } from '../components/ui/primitives'

function Switch({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        background: 'none',
        border: 0,
        borderBottom: '1px solid var(--border)',
        padding: '10px 2px',
        textAlign: 'left',
        minHeight: 52,
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
        {desc && (
          <span className="m-muted" style={{ display: 'block', fontSize: 13 }}>
            {desc}
          </span>
        )}
      </span>
      <span
        aria-hidden
        style={{
          width: 50,
          height: 30,
          borderRadius: 15,
          background: checked ? 'var(--accent)' : 'var(--border)',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: '#fff',
          }}
        />
      </span>
    </button>
  )
}

function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>{label}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className="m-btn"
            style={{
              flex: '1 1 auto',
              minHeight: 44,
              borderColor: value === opt.value ? 'var(--accent)' : undefined,
              fontSize: 14,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const ACCENTS = [
  { id: 'blue', swatch: '#3b82f6' },
  { id: 'violet', swatch: '#8b5cf6' },
  { id: 'green', swatch: '#10b981' },
  { id: 'amber', swatch: '#f59e0b' },
  { id: 'red', swatch: '#ef4444' },
] as const

export function SettingsSectionScreen({ section }: { section: SettingsSection }) {
  const { t, lang, setLang } = useI18n()
  const { back, go, settings, patchSettings, showToast } = useApp()
  const { prefs, setPrefs } = useTheme()
  const [aiTest, setAiTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [aiTestMsg, setAiTestMsg] = useState('')
  const [storageInfo, setStorageInfo] = useState<string | null>(null)
  const [soon, setSoon] = useState<string | null>(null)
  const [version, setVersion] = useState('0.1.0')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const notes = await listNotes(getFs())
        const events = loadEvents()
        const chats = loadSessions()
        if (alive) {
          setStorageInfo(
            `${notes.length} notes • ${chats.length} chats • ${events.length} events`,
          )
      }
      } catch {
        // ignore
      }
    })()
    void import('@tauri-apps/api/app')
      .then((mod) => mod.getVersion().then((v) => alive && setVersion(v)))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  async function testAi(): Promise<void> {
    setAiTest('testing')
    try {
      await chatCompletion(
        {
          baseUrl: settings.ai.baseUrl,
          apiKey: settings.ai.apiKey,
          model: settings.ai.model,
        },
        [{ role: 'user', content: 'Reply with exactly: ok' }],
      )
      setAiTest('ok')
    } catch (e) {
      setAiTest('fail')
      setAiTestMsg(e instanceof Error ? e.message : 'error')
    }
  }

  function pickPreset(preset: AiPresetId): void {
    const defaults = AI_PRESETS[preset]
    patchSettings({
      ai: {
        ...settings.ai,
        preset,
        ...(preset === 'custom'
          ? {}
          : { baseUrl: defaults.baseUrl, model: defaults.model }),
      },
    })
  }

  const titles: Record<SettingsSection, string> = {
    appearance: t('settings.appearance'),
    language: t('settings.language'),
    ai: t('settings.ai'),
    search: t('settings.search'),
    notebook: t('settings.notebook'),
    calendar: t('settings.calendarSettings'),
    integrations: t('settings.integrations'),
    advanced: t('settings.advanced'),
    about: t('settings.about'),
  }

  return (
    <>
      <TopBar
        title={titles[section]}
        left={<BackButton onBack={back} label={t('common.back')} />}
      />
      <div className="m-content">
        {section === 'appearance' && (
          <>
            <Seg
              label={t('settings.theme')}
              value={prefs.theme}
              onChange={(theme) => setPrefs({ theme })}
              options={[
                { value: 'system', label: t('settings.themeSystem') },
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
              ]}
            />
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
              {t('settings.accent')}
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={a.id}
                  aria-pressed={prefs.accent === a.id}
                  onClick={() => setPrefs({ accent: a.id })}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    background: a.swatch,
                    border: prefs.accent === a.id ? '3px solid var(--text)' : 'none',
                  }}
                />
              ))}
            </div>
            <Seg
              label={t('settings.background')}
              value={prefs.bg}
              onChange={(bg) => setPrefs({ bg })}
              options={[
                { value: 'default', label: t('settings.bgDefault') },
                { value: 'soft', label: t('settings.bgSoft') },
                { value: 'oled', label: t('settings.bgOled') },
                { value: 'light', label: t('settings.bgLight') },
              ]}
            />
            <Seg
              label={t('settings.density')}
              value={prefs.density}
              onChange={(density) => setPrefs({ density })}
              options={[
                { value: 'compact', label: t('settings.densityCompact') },
                { value: 'normal', label: t('settings.densityNormal') },
                { value: 'comfortable', label: t('settings.densityComfortable') },
              ]}
            />
            <Seg
              label={t('settings.fontSize')}
              value={prefs.fontScale < 1 ? 's' : prefs.fontScale > 1 ? 'l' : 'm'}
              onChange={(size) =>
                setPrefs({ fontScale: size === 's' ? 0.9 : size === 'l' ? 1.15 : 1 })
              }
              options={[
                { value: 's', label: 'A-' },
                { value: 'm', label: 'A' },
                { value: 'l', label: 'A+' },
              ]}
            />
          </>
        )}

        {section === 'language' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['en', 'pt'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => {
                  setLang(l)
                  patchSettings({ lang: l })
                  showToast(t('common.saved'))
                }}
                className="m-card"
                style={{
                  textAlign: 'left',
                  borderColor: lang === l ? 'var(--accent)' : undefined,
                  fontSize: 17,
                }}
              >
                {l === 'en' ? '🇺🇸 English' : '🇧🇷 Português'}
              </button>
            ))}
          </div>
        )}

        {section === 'ai' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
              {t('settings.aiProvider')}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {(Object.keys(AI_PRESETS) as AiPresetId[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={settings.ai.preset === preset}
                  onClick={() => pickPreset(preset)}
                  className="m-btn"
                  style={{
                    minHeight: 44,
                    borderColor: settings.ai.preset === preset ? 'var(--accent)' : undefined,
                    fontSize: 14,
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Field label={t('settings.aiUrl')}>
              <input
                aria-label={t('settings.aiUrl')}
                value={settings.ai.baseUrl}
                onChange={(e) =>
                  patchSettings({ ai: { ...settings.ai, baseUrl: e.target.value } })
                }
                className="m-input"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </Field>
            <Field label={t('settings.aiModel')}>
              <input
                aria-label={t('settings.aiModel')}
                value={settings.ai.model}
                onChange={(e) =>
                  patchSettings({ ai: { ...settings.ai, model: e.target.value } })
                }
                className="m-input"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </Field>
            <Field label={t('settings.aiKey')}>
              <input
                aria-label={t('settings.aiKey')}
                type="password"
                value={settings.ai.apiKey}
                onChange={(e) =>
                  patchSettings({ ai: { ...settings.ai, apiKey: e.target.value } })
                }
                className="m-input"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </Field>
            <p className="m-muted" style={{ fontSize: 13 }}>
              {t('settings.aiFree')}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Btn
                primary
                onClick={() => void testAi()}
                style={{ flex: 1 }}
              >
                {t('settings.aiTest')}
              </Btn>
            </div>
            {aiTest === 'ok' && (
              <p role="status" style={{ color: 'var(--accent)' }}>{t('settings.aiTestOk')}</p>
            )}
            {aiTest === 'fail' && (
              <p role="alert" style={{ color: 'var(--danger)' }}>
                {t('settings.aiTestFail')}
                <span className="m-muted" style={{ display: 'block', fontSize: 12 }}>
                  {aiTestMsg}
                </span>
              </p>
            )}
          </>
        )}

        {section === 'search' && (
          <>
            <Seg
              label={t('settings.searchProvider')}
              value={settings.search.provider}
              onChange={(provider) =>
                patchSettings({ search: { ...settings.search, provider } })
              }
              options={[
                { value: 'duckduckgo', label: 'DuckDuckGo' },
                { value: 'brave', label: 'Brave' },
              ]}
            />
            <p className="m-muted" style={{ fontSize: 13, marginTop: -6, marginBottom: 12 }}>
              DuckDuckGo: {t('settings.duckduckgoDesc')} Brave: {t('settings.braveDesc')}
            </p>
            <Field label={t('settings.braveKey')}>
              <input
                aria-label={t('settings.braveKey')}
                type="password"
                value={settings.search.braveKey}
                onChange={(e) =>
                  patchSettings({
                    search: { ...settings.search, braveKey: e.target.value },
                  })
                }
                className="m-input"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </Field>
          </>
        )}

        {section === 'notebook' && (
          <>
            <Switch
              label={t('settings.autosave')}
              checked={settings.autosave}
              onChange={(autosave) => patchSettings({ autosave })}
            />
            <Seg
              label={t('settings.defaultView')}
              value={settings.defaultNoteView}
              onChange={(defaultNoteView) => patchSettings({ defaultNoteView })}
              options={[
                { value: 'edit', label: t('settings.viewEdit') },
                { value: 'preview', label: t('settings.viewPreview') },
              ]}
            />
          </>
        )}

        {section === 'calendar' && (
          <>
            <Switch
              label={t('settings.weekStart')}
              desc={t('settings.weekMonday')}
              checked={settings.weekStartsMonday}
              onChange={(weekStartsMonday) => patchSettings({ weekStartsMonday })}
            />
            <Field label={t('settings.defaultReminder')}>
              <select
                aria-label={t('settings.defaultReminder')}
                value={settings.defaultReminder}
                onChange={(e) => patchSettings({ defaultReminder: Number(e.target.value) })}
                className="m-select"
              >
                <option value={-1}>{t('calendar.remindNone')}</option>
                <option value={0}>{t('calendar.remindAt')}</option>
                <option value={5}>{t('calendar.remind5')}</option>
                <option value={30}>{t('calendar.remind30')}</option>
                <option value={1440}>{t('calendar.remindDay')}</option>
              </select>
            </Field>
          </>
        )}

        {section === 'integrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(
              [
                { id: 'drive', icon: '📂', name: 'Google Drive', desc: t('settings.driveDesc') },
                { id: 'onedrive', icon: '☁️', name: 'OneDrive', desc: t('settings.oneDriveDesc') },
                { id: 'github', icon: '🐙', name: 'GitHub', desc: t('settings.githubDesc') },
              ] as const
            ).map((item) => (
              <div key={item.id} className="m-card">
                <div style={{ fontWeight: 700 }}>
                  <span aria-hidden style={{ marginRight: 8 }}>{item.icon}</span>
                  {item.name}
                </div>
                <p className="m-muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>
                  {item.desc}
                </p>
                <Btn onClick={() => setSoon(item.name)} style={{ width: '100%' }}>
                  {t('settings.connect')}
                </Btn>
              </div>
            ))}
          </div>
        )}

        {section === 'advanced' && (
          <>
            <Switch
              label={t('settings.advancedMode')}
              desc={t('settings.advancedModeDesc')}
              checked={settings.advanced}
              onChange={(advanced) => patchSettings({ advanced })}
            />
            <Switch
              label={t('settings.advancedExplorer')}
              desc={t('settings.advancedExplorerDesc')}
              checked={settings.advanced}
              onChange={(advanced) => patchSettings({ advanced })}
            />
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
                {t('settings.quickActions')}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['note', 'search', 'tutor', 'calc'] as const).map((action) => {
                  const on = settings.quickActions.includes(action)
                  return (
                    <button
                      key={action}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        patchSettings({
                          quickActions: on
                            ? settings.quickActions.filter((a) => a !== action)
                            : [...settings.quickActions, action],
                        })
                      }
                      className="m-btn"
                      style={{
                        minHeight: 44,
                        borderColor: on ? 'var(--accent)' : undefined,
                      }}
                    >
                      {on ? '✓ ' : ''}{action}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
                {t('settings.customApi')}
              </p>
              <p className="m-muted" style={{ fontSize: 13, marginBottom: 6 }}>
                {t('settings.customApiDesc')}
              </p>
              <Btn onClick={() => go({ name: 'settingsSection', section: 'ai' })} style={{ width: '100%' }}>
                {t('settings.ai')}
              </Btn>
            </div>
            <div style={{ marginTop: 12 }} className="m-card">
              <strong>{t('settings.storage')}</strong>
              <p className="m-muted" style={{ fontSize: 13, margin: '4px 0' }}>
                {t('settings.storageDesc')}
              </p>
              <p style={{ fontSize: 14 }}>{storageInfo ?? '…'}</p>
            </div>
          </>
        )}

        {section === 'about' && (
          <div className="m-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }} aria-hidden>
              📚
            </div>
            <h2 style={{ margin: '8px 0 4px' }}>{t('settings.aboutTitle')}</h2>
            <p className="m-muted" style={{ fontSize: 14 }}>
              {t('settings.openSource')}
            </p>
            <p style={{ fontSize: 14 }}>
              {t('settings.version')}: {version}
            </p>
          </div>
        )}
      </div>

      {soon !== null && (
        <BottomSheet title={t('settings.soonTitle')} onClose={() => setSoon(null)}>
          <p className="m-muted" style={{ fontSize: 14 }}>
            {t('settings.soonText')}
          </p>
          <div style={{ marginTop: 12 }}>
            <Btn primary onClick={() => setSoon(null)} style={{ width: '100%' }}>
              {t('common.gotIt')}
            </Btn>
          </div>
        </BottomSheet>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="m-field">
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      {children}
    </div>
  )
}
