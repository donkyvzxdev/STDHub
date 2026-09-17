import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowUp, Menu, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '../state/app'
import { useI18n } from '../state/i18n'
import { chatCompletion } from '@shared/lib/ai'
import {
  appendMessage,
  createSession,
  deleteMessage,
  editMessage,
  loadSessions,
  messageAsNote,
  renameSession,
  storeSessions,
  type ChatSession,
} from '@shared/lib/chat'
import { getFs } from '../lib/fs'
import { writeNote } from '../lib/notes'
import { errorKey } from '../lib/errors'
import { copyText } from '../lib/share'
import { TopBar } from '../components/navigation'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Btn, EmptyState } from '../components/ui/primitives'

const TUTOR_SYSTEM =
  'You are STDHub Tutor, a friendly study assistant for students. ' +
  'Explain briefly and simply in the asker language, give one example, ' +
  'and end with one practice question.'

export function TutorScreen() {
  const { t } = useI18n()
  const { go, settings, showToast, tutorDraft, setTutorDraft } = useApp()
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [activeId, setActiveId] = useState<string | null>(
    () => loadSessions()[0]?.id ?? null,
  )
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const active = sessions.find((s) => s.id === activeId) ?? null

  useEffect(() => {
    storeSessions(sessions)
  }, [sessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' })
  }, [active?.messages.length])

  // Context arriving from Search/Notebook (selected text, study actions).
  useEffect(() => {
    if (tutorDraft && tutorDraft.trim() !== '') {
      setInput(tutorDraft)
      setTutorDraft(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function mutate(id: string, fn: (s: ChatSession) => ChatSession): void {
    setSessions((prev) => prev.map((s) => (s.id === id ? fn(s) : s)))
  }

  async function ask(id: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<void> {
    setPending(true)
    setError(null)
    try {
      const text = await chatCompletion(
        {
          baseUrl: settings.ai.baseUrl,
          apiKey: settings.ai.apiKey,
          model: settings.ai.model,
        },
        [
          { role: 'system', content: TUTOR_SYSTEM },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
      )
      mutate(id, (s) => appendMessage(s, 'assistant', text))
    } catch (e) {
      setError(t(errorKey(e instanceof Error ? e.message : 'generic')))
    } finally {
      setPending(false)
    }
  }

  function send(): void {
    const text = input.trim()
    if (text === '' || pending) return
    if (!active) {
      const withUser = appendMessage(createSession(text), 'user', text)
      setSessions((prev) => [withUser, ...prev])
      setActiveId(withUser.id)
      setInput('')
      void ask(withUser.id, withUser.messages)
      return
    }
    const id = active.id
    const history = [...active.messages, { id: 'tmp', role: 'user' as const, content: text, createdAt: Date.now() }]
    setInput('')
    mutate(id, (s) => appendMessage(s, 'user', text))
    void ask(id, history)
  }

  async function saveToNotebook(content: string, role: string): Promise<void> {
    const note = messageAsNote({
      id: 'tmp',
      role: role as 'user' | 'assistant',
      content,
      createdAt: Date.now(),
    })
    try {
      const path = await writeNote(getFs(), '', note.name.replace(/\.md$/i, ''), note.content)
      showToast(t('common.saved'))
      go({ name: 'note', path })
    } catch (e) {
      setError(t(errorKey(e instanceof Error ? e.message : 'generic')))
    }
  }

  return (
    <>
      <TopBar
        title={t('tutor.title')}
        left={
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={t('tutor.conversations')}
            style={{ minWidth: 44, minHeight: 44, background: 'none', border: 0 }}
          >
            <Menu aria-hidden style={{ width: 24, height: 24 }} />
          </button>
        }
      />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!active || active.messages.length === 0 ? (
          <EmptyState title={active ? t('tutor.empty') : t('tutor.hello')} />
        ) : null}
        {active?.messages.map((message) => (
          <div
            key={message.id}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              background: message.role === 'user' ? 'var(--accent)' : 'var(--card)',
              color: message.role === 'user' ? 'var(--accent-text)' : 'var(--text)',
              border: message.role === 'user' ? 0 : '1px solid var(--border)',
              borderRadius: 16,
              padding: '10px 12px',
              fontSize: 15,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {editingId === message.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  aria-label={t('tutor.rename')}
                  value={editDraft}
                  rows={3}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="m-textarea"
                  style={{ minHeight: 80, color: 'var(--text)' }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn
                    onClick={() => {
                      if (active) mutate(active.id, (s) => editMessage(s, message.id, editDraft))
                      setEditingId(null)
                    }}
                    style={{ minHeight: 40 }}
                  >
                    {t('common.save')}
                  </Btn>
                  <Btn onClick={() => setEditingId(null)} style={{ minHeight: 40 }}>
                    {t('common.cancel')}
                  </Btn>
                </div>
              </div>
            ) : (
              <>
                <div>{message.content}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                  <button
                    type="button"
                    onClick={() => void copyText(message.content).then((ok) => ok && showToast(t('calc.copied')))}
                    style={linkStyle}
                  >
                    {t('tutor.copy')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditDraft(message.content)
                      setEditingId(message.id)
                    }}
                    style={linkStyle}
                  >
                    {t('tutor.editMessage')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveToNotebook(message.content, message.role)}
                    style={linkStyle}
                  >
                    {t('tutor.saveNotebook')}
                  </button>
                  {message.role === 'user' && (
                    <button
                      type="button"
                      onClick={() => active && mutate(active.id, (s) => deleteMessage(s, message.id))}
                      style={linkStyle}
                    >
                      {t('tutor.delete')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {pending && <p className="m-muted">⏳ {t('tutor.thinking')}</p>}
        {error !== null && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: 14 }}>
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
          <input
            aria-label={t('tutor.placeholder')}
            data-tour="tutor-input"
          value={input}
          placeholder={t('tutor.placeholder')}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
          className="m-input"
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={send}
          disabled={pending}
          aria-label={t('tutor.send')}
          style={{
            minWidth: 52,
            minHeight: 'var(--tap)',
            borderRadius: 10,
            border: 0,
            background: 'var(--accent)',
            color: 'var(--accent-text)',
          }}
        >
          <ArrowUp aria-hidden style={{ width: 22, height: 22 }} />
        </button>
      </div>

      {drawer && (
        <BottomSheet title={t('tutor.conversations')} onClose={() => setDrawer(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Btn
              primary
              onClick={() => {
                const s = createSession()
                setSessions((prev) => [s, ...prev])
                setActiveId(s.id)
                setDrawer(false)
              }}
            >
              + {t('tutor.newChat')}
            </Btn>
            {sessions.map((s) =>
              renamingId === s.id ? (
                <div key={s.id} style={{ display: 'flex', gap: 6 }}>
                  <input
                    aria-label={t('tutor.rename')}
                    value={renameDraft}
                    autoFocus
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        mutate(s.id, (prev) => renameSession(prev, renameDraft))
                        setRenamingId(null)
                      }
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="m-input"
                    style={{ flex: 1 }}
                  />
                  <Btn
                    onClick={() => {
                      mutate(s.id, (prev) => renameSession(prev, renameDraft))
                      setRenamingId(null)
                    }}
                  >
                    OK
                  </Btn>
                </div>
              ) : (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    border: s.id === activeId ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '2px 2px 2px 10px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(s.id)
                      setDrawer(false)
                    }}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 0,
                      textAlign: 'left',
                      padding: '10px 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.title}
                  </button>
                  <button
                    type="button"
                    aria-label={t('tutor.rename')}
                    onClick={() => {
                      setRenameDraft(s.title)
                      setRenamingId(s.id)
                    }}
                    style={iconBtn}
                  >
                    <Pencil aria-hidden style={{ width: 18, height: 18 }} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('tutor.delete')}
                    onClick={() => setConfirmDelete(s.id)}
                    style={iconBtn}
                  >
                    <Trash2 aria-hidden style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              ),
            )}
          </div>
        </BottomSheet>
      )}

      {confirmDelete !== null && (
        <BottomSheet title={t('tutor.deleteConfirm')} onClose={() => setConfirmDelete(null)}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setConfirmDelete(null)} style={{ flex: 1 }}>
              {t('common.cancel')}
            </Btn>
            <Btn
              onClick={() => {
                const id = confirmDelete
                setConfirmDelete(null)
                setSessions((prev) => {
                  const next = prev.filter((s) => s.id !== id)
                  if (activeId === id) setActiveId(next[0]?.id ?? null)
                  return next
                })
              }}
              style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              {t('common.delete')}
            </Btn>
          </div>
        </BottomSheet>
      )}
    </>
  )
}

const linkStyle: CSSProperties = {
  background: 'none',
  border: 0,
  padding: '6px 0',
  color: 'inherit',
  textDecoration: 'underline',
  fontSize: 12,
}

const iconBtn: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  background: 'none',
  border: 0,
  fontSize: 16,
}
