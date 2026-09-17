import { useCallback, useEffect, useState } from 'react'
import { detectLanguage, I18nProvider, useI18n } from './state/i18n'
import { ThemeProvider } from './state/theme'
import { AppProvider, useApp, type MainTab } from './state/app'
import { loadSettings, storeSettings, type MobileSettings } from './lib/settings'
import type { TourStep } from './lib/tour'
import { BottomNav } from './components/navigation'
import { TourOverlay } from './components/TourOverlay'
import { Onboarding } from './screens/Onboarding'
import { HomeScreen } from './screens/Home'
import { NotebookHome } from './screens/notebook/NotebookHome'
import { NoteEditor } from './screens/notebook/NoteEditor'
import { SearchScreen } from './screens/Search'
import { TutorScreen } from './screens/Tutor'
import { MoreScreen } from './screens/More'
import { CalcScreen } from './screens/Calc'
import { CalendarScreen } from './screens/Calendar'
import { FilesScreen } from './screens/Files'
import { SettingsScreen } from './screens/Settings'
import { SettingsSectionScreen } from './screens/SettingsSection'

function Splash() {
  return (
    <div
      className="m-content"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 44 }} aria-hidden>
        📚
      </div>
      <strong style={{ fontSize: 24 }}>STDHub</strong>
    </div>
  )
}

function OfflinePill() {
  const { t } = useI18n()
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const update = (): void => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  if (online) return null
  return <div className="m-offline">{t('common.offline')}</div>
}

function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 96,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '10px 14px',
        textAlign: 'center',
        zIndex: 60,
      }}
    >
      {toast}
    </div>
  )
}

function Main() {
  const { route, goTab } = useApp()
  if (route.name !== 'main') return null
  const tab: MainTab = route.tab
  return (
    <>
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'notebook' && <NotebookHome />}
        {tab === 'search' && <SearchScreen />}
        {tab === 'tutor' && <TutorScreen />}
        {tab === 'more' && <MoreScreen />}
      </div>
      <BottomNav tab={tab} onTab={goTab} />
    </>
  )
}

function Pushed() {
  const { route } = useApp()
  if (route.name === 'main') return null
  return (
    <div className="m-content" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      {route.name === 'note' && <NoteEditor path={route.path} />}
      {route.name === 'calc' && <CalcScreen />}
      {route.name === 'calendar' && <CalendarScreen />}
      {route.name === 'files' && <FilesScreen />}
      {route.name === 'settings' && <SettingsScreen />}
      {route.name === 'settingsSection' && (
        <SettingsSectionScreen section={route.section} />
      )}
    </div>
  )
}

function Shell() {
  const { settings, patchSettings, goTab } = useApp()
  const { t, tList } = useI18n()
  const [splash, setSplash] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 700)
    return () => window.clearTimeout(timer)
  }, [])

  // Coach-mark steps reuse the tour microcopy; navigation happens on
  // arrival so every target exists when spotlighted.
  const tourSteps: TourStep[] = (() => {
    const steps = tList('onboarding.steps')
    const at = (i: number): { title: string; text: string } =>
      steps[i] ?? { title: '', text: '' }
    return [
      { id: 'welcome', title: at(0).title, text: at(0).text },
      { id: 'notebook', title: at(1).title, text: at(1).text, tab: 'notebook', target: 'notebook-new' },
      { id: 'search', title: at(2).title, text: at(2).text, tab: 'search', target: 'search-input' },
      { id: 'tutor', title: at(3).title, text: at(3).text, tab: 'tutor', target: 'tutor-input' },
      { id: 'pro', title: t('onboarding.proTitle'), text: t('onboarding.proText'), final: true },
    ]
  })()

  function finishTour(): void {
    patchSettings({ tourSeen: true })
    goTab('home')
  }

  if (splash) {
    return (
      <div className="m-shell">
        <Splash />
      </div>
    )
  }

  if (!settings.onboarded) {
    return (
      <div className="m-shell">
        <Onboarding
          onDone={(lang) => patchSettings({ lang, onboarded: true })}
        />
      </div>
    )
  }

  return (
    <div className="m-shell">
      <OfflinePill />
      <Main />
      <Pushed />
      {!settings.tourSeen && (
        <TourOverlay
          steps={tourSteps}
          onNavigate={(tab: MainTab) => goTab(tab)}
          onDone={finishTour}
        />
      )}
      <Toast />
    </div>
  )
}

function App() {
  const [settings, setSettings] = useState<MobileSettings>(loadSettings)

  const patchSettings = useCallback(
    (patch: Partial<MobileSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        storeSettings(next)
        return next
      })
    },
    [],
  )

  const lang = settings.lang ?? detectLanguage()

  return (
    <I18nProvider initial={lang} key={lang}>
      <ThemeProvider
        initial={{
          theme: settings.theme,
          accent: settings.accent,
          bg: settings.bg,
          density: settings.density,
          fontScale: settings.fontScale,
        }}
        onChange={(prefs) =>
          patchSettings({
            theme: prefs.theme,
            accent: prefs.accent,
            bg: prefs.bg,
            density: prefs.density,
            fontScale: prefs.fontScale,
          })
        }
      >
        <AppProvider settings={settings} patchSettings={patchSettings}>
          <Shell />
        </AppProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}

export default App
