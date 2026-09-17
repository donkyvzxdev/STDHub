import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../state/i18n'
import { AppProvider } from '../state/app'
import { DEFAULT_SETTINGS } from '../lib/settings'
import { resetFs, getFs } from '../lib/fs'
import { createMemoryFs, writeNote } from '../lib/notes'
import { FilesScreen } from './Files'

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
  resetFs(createMemoryFs())
})

describe('files screen', () => {
  it('creates folders and lists notes', async () => {
    await writeNote(getFs(), '', 'Root note', 'x')
    shell(<FilesScreen />)
    expect(await screen.findByRole('button', { name: 'Open: Root note' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New folder' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'New folder' }), {
      target: { value: 'Math' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: 'Math' })).toBeTruthy()
  })

  it('deletes a note with confirmation', async () => {
    await writeNote(getFs(), '', 'Gone', 'x')
    shell(<FilesScreen />)
    await screen.findByRole('button', { name: 'Open: Gone' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Gone' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Open: Gone' })).toBeNull()
    })
  })
})
