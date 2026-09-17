import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../state/i18n'
import { AppProvider } from '../../state/app'
import { DEFAULT_SETTINGS } from '../../lib/settings'
import { resetFs, getFs } from '../../lib/fs'
import { createMemoryFs, writeNote } from '../../lib/notes'
import { NotebookHome } from './NotebookHome'
import { NoteEditor } from './NoteEditor'

function shell(ui: React.ReactElement) {
  return render(
    <I18nProvider initial="en">
      <AppProvider
        settings={{ ...DEFAULT_SETTINGS }}
        patchSettings={() => undefined}
      >
        {ui}
      </AppProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  resetFs(createMemoryFs())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('notebook home', () => {
  it('shows empty state then notes', async () => {
    const view = shell(<NotebookHome />)
    expect(await view.findByText('No notes yet')).toBeTruthy()
    await writeNote(getFs(), '', 'Hello', '# Hello')
    view.unmount()
    shell(<NotebookHome />)
    expect(await screen.findByRole('button', { name: 'Hello' })).toBeTruthy()
  })
})

describe('note editor', () => {
  it('creates, edits, previews and autosaves a note', async () => {
    vi.useFakeTimers()
    shell(<NoteEditor path={null} />)
    const title = screen.getByRole('textbox', { name: 'Title' })
    fireEvent.change(title, { target: { value: 'My note' } })
    const area = screen.getByRole('textbox', {
      name: /type or write/i,
    }) as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: '# Hi\n**bold**' } })
    await vi.advanceTimersByTimeAsync(1500)
    expect(screen.getByText(/saved/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByText('Hi')).toBeTruthy()
    expect(screen.getByText('bold')).toBeTruthy()
  })

  it('inserts bold markup around the selection', () => {
    shell(<NoteEditor path={null} />)
    const area = screen.getByRole('textbox', {
      name: /type or write/i,
    }) as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'hello' } })
    area.setSelectionRange(0, 5)
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(area.value).toBe('**hello**')
  })
})
