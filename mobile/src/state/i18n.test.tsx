import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { detectLanguage, I18nProvider, useI18n } from './i18n'

beforeEach(() => {
  window.localStorage.clear()
})

function Probe({ k, vars }: { k: string; vars?: Record<string, string> }) {
  const { t, tList, lang, setLang } = useI18n()
  return (
    <div>
      <p data-testid="out">{t(k, vars)}</p>
      <p data-testid="lang">{lang}</p>
      <p data-testid="list">{tList('onboarding.steps').length}</p>
      <button type="button" onClick={() => setLang('pt')}>
        to-pt
      </button>
    </div>
  )
}

describe('mobile i18n', () => {
  it('translates, interpolates and falls back', () => {
    render(
      <I18nProvider initial="en">
        <Probe k="common.save" />
      </I18nProvider>,
    )
    expect(screen.getByTestId('out')).toHaveTextContent('Save')
    expect(screen.getByTestId('list')).toHaveTextContent('7')
  })

  it('switches language and persists', () => {
    render(
      <I18nProvider initial="en">
        <Probe k="common.save" />
      </I18nProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'to-pt' }))
    expect(screen.getByTestId('out')).toHaveTextContent('Salvar')
    expect(window.localStorage.getItem('stdhub.mobile.lang')).toBe('pt')
  })

  it('returns the key for missing entries', () => {
    render(
      <I18nProvider initial="en">
        <Probe k="nope.missing" />
      </I18nProvider>,
    )
    expect(screen.getByTestId('out')).toHaveTextContent('nope.missing')
  })

  it('detects pt from the device', () => {
    Object.defineProperty(window.navigator, 'language', {
      value: 'pt-BR',
      configurable: true,
    })
    expect(detectLanguage()).toBe('pt')
    window.localStorage.setItem('stdhub.mobile.lang', 'en')
    expect(detectLanguage()).toBe('en')
  })
})
