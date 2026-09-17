import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  type MobileSettings,
} from '../lib/settings'

export type MainTab = 'home' | 'notebook' | 'search' | 'tutor' | 'more'

export type SettingsSection =
  | 'appearance'
  | 'language'
  | 'ai'
  | 'search'
  | 'notebook'
  | 'calendar'
  | 'integrations'
  | 'advanced'
  | 'about'

export type Route =
  | { name: 'main'; tab: MainTab }
  | { name: 'note'; path: string | null }
  | { name: 'calc' }
  | { name: 'calendar' }
  | { name: 'files' }
  | { name: 'settings' }
  | { name: 'settingsSection'; section: SettingsSection }

interface AppState {
  settings: MobileSettings
  patchSettings: (patch: Partial<MobileSettings>) => void
  route: Route
  go: (route: Route) => void
  back: () => void
  goTab: (tab: MainTab) => void
  /** Prefilled Tutor context (from Search/Notebook), consumed once. */
  tutorDraft: string | null
  setTutorDraft: (draft: string | null) => void
  /** Prefilled search query (from Home). */
  searchDraft: string | null
  setSearchDraft: (query: string | null) => void
  toast: string | null
  showToast: (message: string) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({
  settings,
  patchSettings,
  children,
}: {
  settings: MobileSettings
  patchSettings: (patch: Partial<MobileSettings>) => void
  children: ReactNode
}) {
  const [stack, setStack] = useState<Route[]>([{ name: 'main', tab: 'home' }])
  const [tutorDraft, setTutorDraft] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  const value = useMemo<AppState>(() => {
    const route = stack[stack.length - 1] ?? { name: 'main', tab: 'home' as MainTab }
    return {
      settings,
      patchSettings,
      route,
      go: (next) => setStack((prev) => [...prev, next]),
      back: () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
      goTab: (tab) => setStack([{ name: 'main', tab }]),
      tutorDraft,
      setTutorDraft,
      searchDraft,
      setSearchDraft,
      toast,
      showToast,
    }
  }, [settings, patchSettings, stack, tutorDraft, searchDraft, toast, showToast])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
