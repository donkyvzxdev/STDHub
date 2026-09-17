import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../state/i18n'
import { AppProvider } from '../state/app'
import { DEFAULT_SETTINGS } from '../lib/settings'
import { CalcScreen } from './Calc'

function shell(ui: React.ReactElement) {
  return render(
    <I18nProvider initial="en">
      <AppProvider settings={{ ...DEFAULT_SETTINGS }} patchSettings={() => undefined}>
        {ui}
      </AppProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('calc screen', () => {
  it('computes, toggles scientific and records history', () => {
    shell(<CalcScreen />)
    for (const key of ['6', '*', '7']) {
      fireEvent.click(screen.getByRole('button', { name: key }))
    }
    expect(screen.getByText('= 42')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Scientific' }))
    expect(screen.getByRole('button', { name: 'sin(' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    expect(screen.getByText('6*7 = 42')).toBeTruthy()
    expect(
      window.localStorage.getItem('stdhub.calc.history'),
    ).toContain('6*7 = 42')
  })

  it('shows percent as divide-by-100', () => {
    shell(<CalcScreen />)
    for (const key of ['5', '0']) {
      fireEvent.click(screen.getByRole('button', { name: key }))
    }
    fireEvent.click(screen.getByRole('button', { name: '%' }))
    expect(screen.getByText('= 0.5')).toBeTruthy()
  })
})
