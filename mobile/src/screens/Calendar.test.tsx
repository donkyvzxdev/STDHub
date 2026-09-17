import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../state/i18n'
import { AppProvider } from '../state/app'
import { DEFAULT_SETTINGS } from '../lib/settings'
import { CalendarScreen } from './Calendar'

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

describe('calendar screen', () => {
  it('creates an event from the form', async () => {
    shell(<CalendarScreen />)
    expect(screen.getByText('No events yet.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'New event' })[0])
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Math test' },
    })
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-10-05' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByText('Math test')).toBeTruthy()
    expect(
      JSON.parse(window.localStorage.getItem('stdhub.mobile.calendar') ?? '[]'),
    ).toHaveLength(1)
  })

  it('validates empty titles', () => {
    shell(<CalendarScreen />)
    fireEvent.click(screen.getAllByRole('button', { name: 'New event' })[0])
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-10-05' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }))
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('deletes with confirmation', async () => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    window.localStorage.setItem(
      'stdhub.mobile.calendar',
      JSON.stringify([
        {
          id: 'e1',
          title: 'Gone',
          date: today,
          time: '',
          notes: '',
          remindMinutes: -1,
        },
      ]),
    )
    shell(<CalendarScreen />)
    fireEvent.click(screen.getByText('Gone'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.queryByText('Gone')).toBeNull()
    })
  })
})
