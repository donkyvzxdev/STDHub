import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsView from './SettingsView'
import '../../lib/i18n'
import { loadSettings } from '../../lib/settings'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.add('dark')
  document.documentElement.removeAttribute('data-accent')
  document.documentElement.removeAttribute('data-density')
})

describe('T10 settings screen', () => {
  it('switches theme mode and persists it', async () => {
    render(<SettingsView />)
    expect(await screen.findByText('Appearance')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect((await loadSettings()).theme.mode).toBe('light')
  })

  it('picks an accent and a density', async () => {
    render(<SettingsView />)
    expect(await screen.findByText('Appearance')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'amber' }))
    expect(document.documentElement.getAttribute('data-accent')).toBe('amber')
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(document.documentElement.getAttribute('data-density')).toBe('compact')
    expect((await loadSettings()).theme.accent).toBe('amber')
  })

  it('saves the AI provider and search settings', async () => {
    render(<SettingsView />)
    expect(await screen.findByText('AI provider')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'openai' }))
    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: 'sk-local' },
    })
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'gpt-4o-mini' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Brave' }))
    fireEvent.change(screen.getByLabelText('Brave API key'), {
      target: { value: 'brave-local' },
    })
    fireEvent.click(
      screen.getAllByRole('button', { name: /save providers/i })[0],
    )
    expect(await screen.findByText(/settings saved/i)).toBeTruthy()
    const saved = await loadSettings()
    expect(saved.ai).toEqual({
      preset: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-local',
      model: 'gpt-4o-mini',
    })
    expect(saved.search).toEqual({ provider: 'brave', braveKey: 'brave-local' })
  })

  it('tests the AI connection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    try {
      render(<SettingsView />)
      expect(await screen.findByText('AI provider')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /test connection/i }))
      expect(await screen.findByText(/connection works/i)).toBeTruthy()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('switches language from the Config screen', async () => {
    const { LANGUAGE_STORAGE_KEY } = await import('../../lib/i18n')
    render(<SettingsView />)
    expect(await screen.findByText('Appearance')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Português' }))
    expect(await screen.findByText('Aparência')).toBeTruthy()
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt')
  })
})
