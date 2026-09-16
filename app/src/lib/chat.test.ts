import { describe, expect, it } from 'vitest'
import {
  appendMessage,
  createSession,
  deleteMessage,
  editMessage,
  loadSessions,
  messageAsNote,
  renameSession,
  storeSessions,
  titleFor,
  truncateFrom,
} from './chat'

describe('T14 chat sessions', () => {
  it('titles from the first user message', () => {
    expect(titleFor('  explain   photosynthesis please  ')).toBe(
      'explain photosynthesis please',
    )
    expect(titleFor('')).toBe('New conversation')
    expect(titleFor('x'.repeat(100))).toHaveLength(42)
  })

  it('appends, edits, deletes and truncates', () => {
    let session = createSession()
    session = appendMessage(session, 'user', 'hi')
    expect(session.title).toBe('hi')
    session = appendMessage(session, 'assistant', 'hello')
    const [first, second] = session.messages
    session = editMessage(session, second.id, 'hello!')
    expect(session.messages[1].content).toBe('hello!')
    session = truncateFrom(session, second.id)
    expect(session.messages.map((m) => m.id)).toEqual([first.id])
    session = deleteMessage(session, first.id)
    expect(session.messages).toHaveLength(0)
  })

  it('renames safely', () => {
    const session = createSession()
    expect(renameSession(session, '  Physics  ').title).toBe('Physics')
    expect(renameSession(session, '   ').title).toBe('New conversation')
  })

  it('persists and sanitizes', () => {
    window.localStorage.clear()
    expect(loadSessions()).toEqual([])
    let session = createSession()
    session = appendMessage(session, 'user', 'q')
    storeSessions([session])
    expect(loadSessions()).toHaveLength(1)
    window.localStorage.setItem(
      'stdhub.chat.sessions',
      JSON.stringify([{ nope: true }, session]),
    )
    expect(loadSessions()).toHaveLength(1)
    window.localStorage.setItem('stdhub.chat.sessions', '[[broken')
    expect(loadSessions()).toEqual([])
  })

  it('exports a message as a study note', () => {
    const note = messageAsNote({
      id: 'm1',
      role: 'assistant',
      content: '# Topic\nBody',
      createdAt: 1700000000000,
    })
    expect(note.name).toMatch(/^note-.*\.md$/)
    expect(note.content).toContain('# Topic')
    expect(note.content).toContain('assistant')
  })
})
