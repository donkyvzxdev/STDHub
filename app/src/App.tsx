import { useState } from 'react'
import LoginScreen from './components/login/LoginScreen'
import LanguageStep from './components/onboarding/LanguageStep'
import AppShell from './components/shell/AppShell'
import {
  clearProfile,
  loadProfile,
  saveGuestProfile,
  type Profile,
} from './lib/profile'
import { LANGUAGE_STORAGE_KEY } from './lib/i18n'
import type { Account } from './lib/auth'

function hasStoredLanguage(): boolean {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) !== null
  } catch {
    return true
  }
}

function App() {
  const [langReady, setLangReady] = useState<boolean>(() => hasStoredLanguage())
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  // No cloud provider yet (database TBD) — always local-first for now.
  // Cloud auth plugs back in here via getCloudAuthClient().
  const [account, setAccount] = useState<Account | null>(null)

  function logout(): void {
    clearProfile()
    setAccount(null)
    setProfile(null)
  }

  if (!langReady) {
    return <LanguageStep onDone={() => setLangReady(true)} />
  }

  if (account || profile) {
    return <AppShell account={account} onLogout={logout} />
  }

  return <LoginScreen onGuest={() => setProfile(saveGuestProfile())} />
}

export default App
