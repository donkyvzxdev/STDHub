import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatView from './ChatView'
import '../../lib/i18n'

function mockAi(reply: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function typeAndSend(text: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
}

describe('T14 chat view', () => {
  it('sends a message and shows the AI reply', async () => {
    mockAi('Reply here.')
    render(<ChatView />)
    typeAndSend('What is gravity?')
    expect(await screen.findByText('Reply here.')).toBeTruthy()
    // Bubble + sidebar button + narrow session picker.
    expect(screen.getAllByText('What is gravity?')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'What is gravity?' })).toBeTruthy()
  })

  it('creates, renames, switches and deletes sessions', async () => {
    mockAi('ok')
    render(<ChatView />)
    typeAndSend('first topic')
    expect(screen.getAllByText('first topic')).toHaveLength(3)
    await screen.findByText('ok')
    // Two "New" buttons exist (wide sidebar + narrow top bar); take the first.
    fireEvent.click(screen.getAllByRole('button', { name: /^new$/i })[0])
    typeAndSend('second topic')
    expect(screen.getAllByText('second topic')).toHaveLength(3)
    // Rename the second session.
    const renameButtons = screen.getAllByRole('button', { name: /rename/i })
    fireEvent.click(renameButtons[0])
    const nameInput = screen.getByRole('textbox', { name: /rename/i })
    fireEvent.change(nameInput, { target: { value: 'Physics' } })
    fireEvent.keyDown(nameInput, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Physics' })).toBeTruthy()
    // Back to the first session.
    fireEvent.click(screen.getByRole('button', { name: 'first topic' }))
    expect(screen.getAllByText('first topic')).toHaveLength(3)
    // Delete it.
    const row = screen
      .getByRole('button', { name: 'first topic' })
      .closest('div')
    if (!row) throw new Error('no session row')
    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Delete conversation first topic',
      }),
    )
    expect(screen.queryByRole('button', { name: 'first topic' })).toBeNull()
  })

  it('edits an AI message and deletes a user message', async () => {
    mockAi('original reply')
    render(<ChatView />)
    typeAndSend('question')
    await screen.findByText('original reply')
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    const editor = screen.getByRole('textbox', { name: /^edit$/i })
    fireEvent.change(editor, { target: { value: 'edited reply' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('edited reply')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    // Bubble gone; sidebar title and narrow picker keep the text.
    expect(screen.getAllByText('question')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'question' })).toBeTruthy()
    expect(screen.getByText('edited reply')).toBeTruthy()
  })

  it('emits save-note for the editor', async () => {
    mockAi('study this')
    render(<ChatView />)
    typeAndSend('topic')
    await screen.findByText('study this')
    const seen: unknown[] = []
    const onNote = (e: Event): void => {
      seen.push((e as CustomEvent).detail)
    }
    window.addEventListener('stdhub:save-note', onNote)
    try {
      fireEvent.click(screen.getByRole('button', { name: /save to editor/i }))
      expect(seen).toHaveLength(1)
      const detail = seen[0] as { name: string; content: string }
      expect(detail.name).toMatch(/\.md$/)
      expect(detail.content).toContain('study this')
    } finally {
      window.removeEventListener('stdhub:save-note', onNote)
    }
  })

  it('shows AI errors honestly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    render(<ChatView />)
    typeAndSend('hello?')
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
