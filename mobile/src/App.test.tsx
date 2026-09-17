import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(async () => '0.1.0-test'),
}))

beforeEach(() => {
  window.localStorage.clear()
})

function skipSplash(): void {
  window.localStorage.setItem(
    'stdhub.mobile.settings',
    JSON.stringify({ onboarded: true, tourSeen: true, lang: 'en' }),
  )
}

describe('mobile shell', () => {
  it('runs splash, language and the in-app tour, then lands on home', async () => {
    render(<App />)
    expect(screen.getByText('STDHub')).toBeTruthy()
    expect(
      await screen.findByText('Choose your language', {}, { timeout: 3000 }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Português/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    // Coach marks spotlight the real UI, starting with welcome.
    expect(await screen.findByText(/Bem-vindo/)).toBeTruthy()
    // Notebook step (tab switches to Notebook).
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText(/anotações, trabalhos e ideias/)).toBeTruthy()
    // Search step.
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText(/use a IA para entender/)).toBeTruthy()
    // Tutor step.
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText(/tire suas dúvidas/)).toBeTruthy()
    // Final pro-notice step, then home.
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText('Quer mais controle?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(await screen.findByText('Olá 👋')).toBeTruthy()
    expect(window.localStorage.getItem('stdhub.mobile.lang')).toBe('pt')
    const stored = JSON.parse(
      window.localStorage.getItem('stdhub.mobile.settings') ?? '{}',
    ) as { tourSeen?: boolean }
    expect(stored.tourSeen).toBe(true)
  })

  it('skips the tour when asked', async () => {
    render(<App />)
    expect(
      await screen.findByText('Choose your language', {}, { timeout: 3000 }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /English/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/Welcome/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(await screen.findByText('Hi 👋')).toBeTruthy()
  })

  it('navigates tabs and More', async () => {
    skipSplash()
    render(<App />)
    expect(await screen.findByText('Hi 👋', {}, { timeout: 3000 })).toBeTruthy()
    const nav = () => within(screen.getByRole('navigation', { name: 'main' }))
    fireEvent.click(nav().getByRole('button', { name: 'Notebook' }))
    expect(await screen.findByText('No notes yet')).toBeTruthy()
    fireEvent.click(nav().getByRole('button', { name: 'Search' }))
    expect(await screen.findByRole('textbox', { name: /search the web/i })).toBeTruthy()
    fireEvent.click(nav().getByRole('button', { name: 'Tutor' }))
    expect(await screen.findByText(/What do you want to learn today/)).toBeTruthy()
    fireEvent.click(nav().getByRole('button', { name: 'More' }))
    expect(await screen.findByText('Calendar')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
    expect(await screen.findByText('New event', { exact: false })).toBeTruthy()
  })
})
