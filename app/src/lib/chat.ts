export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'stdhub.chat.sessions'
const TITLE_MAX = 42

let counter = 0

export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export function titleFor(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine === '') return 'New conversation'
  return oneLine.length > TITLE_MAX
    ? `${oneLine.slice(0, TITLE_MAX - 1)}…`
    : oneLine
}

export function createSession(firstMessage?: string): ChatSession {
  const now = Date.now()
  return {
    id: newId('chat'),
    title: firstMessage ? titleFor(firstMessage) : 'New conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function isMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const rec = value as Record<string, unknown>
  return (
    typeof rec['id'] === 'string' &&
    (rec['role'] === 'user' || rec['role'] === 'assistant') &&
    typeof rec['content'] === 'string' &&
    typeof rec['createdAt'] === 'number'
  )
}

function sanitizeSession(value: unknown): ChatSession | null {
  if (typeof value !== 'object' || value === null) return null
  const rec = value as Record<string, unknown>
  if (typeof rec['id'] !== 'string') return null
  const messages = Array.isArray(rec['messages'])
    ? rec['messages'].filter(isMessage)
    : []
  const createdAt =
    typeof rec['createdAt'] === 'number' ? rec['createdAt'] : Date.now()
  const updatedAt =
    typeof rec['updatedAt'] === 'number' ? rec['updatedAt'] : createdAt
  return {
    id: rec['id'] as string,
    title: typeof rec['title'] === 'string' ? (rec['title'] as string) : 'New conversation',
    messages,
    createdAt,
    updatedAt,
  }
}

export function loadSessions(): ChatSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(sanitizeSession)
      .filter((s): s is ChatSession => s !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export function storeSessions(sessions: ChatSession[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Storage full or blocked — sessions live for this session only.
  }
}

export function appendMessage(
  session: ChatSession,
  role: ChatRole,
  content: string,
): ChatSession {
  const message: ChatMessage = {
    id: newId('msg'),
    role,
    content,
    createdAt: Date.now(),
  }
  const messages = [...session.messages, message]
  return {
    ...session,
    messages,
    title:
      session.messages.length === 0 && role === 'user'
        ? titleFor(content)
        : session.title,
    updatedAt: Date.now(),
  }
}

export function editMessage(
  session: ChatSession,
  id: string,
  content: string,
): ChatSession {
  return {
    ...session,
    messages: session.messages.map((m) =>
      m.id === id ? { ...m, content } : m,
    ),
    updatedAt: Date.now(),
  }
}

export function deleteMessage(session: ChatSession, id: string): ChatSession {
  return {
    ...session,
    messages: session.messages.filter((m) => m.id !== id),
    updatedAt: Date.now(),
  }
}

/** Drop a message and everything after it (used to resend/regenerate). */
export function truncateFrom(session: ChatSession, id: string): ChatSession {
  const at = session.messages.findIndex((m) => m.id === id)
  if (at < 0) return session
  return {
    ...session,
    messages: session.messages.slice(0, at),
    updatedAt: Date.now(),
  }
}

export function renameSession(
  session: ChatSession,
  title: string,
): ChatSession {
  const clean = title.replace(/\s+/g, ' ').trim()
  return {
    ...session,
    title: clean === '' ? session.title : clean.slice(0, 60),
    updatedAt: Date.now(),
  }
}

/** A message exported as a study note for the editor. */
export function messageAsNote(message: ChatMessage): {
  name: string
  content: string
} {
  const stamp = new Date(message.createdAt).toISOString().slice(0, 10)
  return {
    name: `note-${stamp}.md`,
    content: `<!-- saved from STDHub Tutor (${message.role}) -->\n\n${message.content}\n`,
  }
}
