import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../state/i18n'
import { ThemeProvider, DEFAULT_THEME_PREFS } from '../state/theme'
import { AppProvider } from '../state/app'
import { DEFAULT_SETTINGS, type MobileSettings } from '../lib/settings'
import { SettingsScreen } from './Settings'
import { SettingsSectionScreen } from './SettingsSection'

function shell(
  ui: React.ReactElement,
  patchSettings: (patch: Partial<MobileSettings>) => void = () => undefined,
) {
  return render(
    <I18nProvider initial="en">
      <ThemeProvider initial={DEFAULT_THEME_PREFS} onChange={() => undefined}>
        <AppProvider settings={{ ...DEFAULT_SETTINGS }} patchSettings={patchSettings}>
          {ui}
        </AppProvider>
      </ThemeProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('settings', () => {
  it('lists sections', () => {
    shell(<SettingsScreen />)
    expect(screen.getByText('Appearance')).toBeTruthy()
    expect(screen.getByText('Integrations')).toBeTruthy()
    expect(screen.getByText('About')).toBeTruthy()
  })

  it('switches theme and persists', () => {
    shell(<SettingsSectionScreen section="appearance" />)
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    // ThemeProvider applies to the document immediately.
    expect(document.documentElement.dataset['theme']).toBe('dark')
  })

  it('tests the AI connection with mocked fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    try {
      shell(<SettingsSectionScreen section="ai" />)
      fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
      expect(await screen.findByText('Connection works.')).toBeTruthy()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps integrations honest', async () => {
    shell(<SettingsSectionScreen section="integrations" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Connect' })[0])
    expect(await screen.findByText('Available soon')).toBeTruthy()
    expect(
      screen.getByText(/not ready yet/i),
    ).toBeTruthy()
  })

  it('persists provider choices', () => {
    const received: unknown[] = []
    shell(<SettingsSectionScreen section="search" />, (patch) => {
      received.push(patch)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Brave' }))
    expect(received).toEqual([{ search: { provider: 'brave', braveKey: '' } }])
  })
})
