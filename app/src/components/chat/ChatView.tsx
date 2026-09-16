import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { chatCompletion } from '@/lib/ai'
import {
  appendMessage,
  createSession,
  deleteMessage,
  editMessage,
  loadSessions,
  messageAsNote,
  renameSession,
  storeSessions,
  truncateFrom,
  type ChatMessage,
  type ChatSession,
} from '@/lib/chat'
import { loadSettings } from '@/lib/settings'
import { cn } from 'cn'

async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const TUTOR_SYSTEM =
  'You are STDHub Tutor, a study assistant. Explain clearly and briefly, ' +
  'use the asker language, give examples and end with one practice question.'

function MessageActions({
  message,
  onCopy,
  onResend,
  onEdit,
  onDelete,
  onSave,
}: {
  message: ChatMessage
  onCopy: () => void
  onResend: () => void
  onEdit: () => void
  onDelete: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const item =
    'flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  return (
    <div className="flex flex-wrap items-center gap-0.5 pt-1">
      <button type="button" aria-label={t('chat.copy')} title={t('chat.copy')} onClick={onCopy} className={item}>
        <Copy className="size-3" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={message.role === 'user' ? t('chat.resend') : t('chat.regenerate')}
        title={message.role === 'user' ? t('chat.resend') : t('chat.regenerate')}
        onClick={onResend}
        className={item}
      >
        <RefreshCw className="size-3" aria-hidden />
      </button>
      {message.role === 'assistant' ? (
        <>
          <button type="button" aria-label={t('chat.edit')} title={t('chat.edit')} onClick={onEdit} className={item}>
            <Pencil className="size-3" aria-hidden />
          </button>
          <button type="button" aria-label={t('chat.saveNote')} title={t('chat.saveNote')} onClick={onSave} className={item}>
            <Save className="size-3" aria-hidden />
          </button>
        </>
      ) : (
        <button type="button" aria-label={t('chat.delete')} title={t('chat.delete')} onClick={onDelete} className={item}>
          <Trash2 className="size-3" aria-hidden />
        </button>
      )}
    </div>
  )
}

function ChatView() {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [activeId, setActiveId] = useState<string | null>(
    () => loadSessions()[0]?.id ?? null,
  )
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const active = sessions.find((s) => s.id === activeId) ?? null

  useEffect(() => {
    storeSessions(sessions)
  }, [sessions])

  useEffect(() => {
    const el = bottomRef.current
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'end' })
    }
  }, [active?.messages.length])

  function mutate(id: string, fn: (s: ChatSession) => ChatSession): void {
    setSessions((prev) => prev.map((s) => (s.id === id ? fn(s) : s)))
  }

  function newConversation(): void {
    const session = createSession()
    setSessions((prev) => [session, ...prev])
    setActiveId(session.id)
    setError(null)
  }

  function removeSession(id: string): void {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      setActiveId((active) =>
        active === id ? (next[0]?.id ?? null) : active,
      )
      return next
    })
  }

  async function ask(id: string, history: ChatMessage[]): Promise<void> {
    setPending(true)
    setError(null)
    try {
      const settings = await loadSettings()
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
      setError(e instanceof Error ? e.message : 'chat-failed')
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
    const outgoing: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    const history = [...active.messages, outgoing]
    setInput('')
    mutate(id, (s) => appendMessage(s, 'user', text))
    void ask(id, history)
  }

  function resendFrom(message: ChatMessage): void {
    if (!active || pending) return
    const truncated = truncateFrom(active, message.id)
    mutate(active.id, () => truncated)
    void ask(
      active.id,
      message.role === 'user'
        ? [...truncated.messages, message]
        : truncated.messages,
    )
  }

  async function onCopy(message: ChatMessage): Promise<void> {
    if (await copyText(message.content)) {
      setCopiedId(message.id)
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === message.id ? null : cur))
      }, 1500)
    }
  }

  function onSaveNote(message: ChatMessage): void {
    const note = messageAsNote(message)
    window.dispatchEvent(
      new CustomEvent('stdhub:save-note', {
        detail: { name: note.name, content: note.content },
      }),
    )
  }

  return (
    <div className="@container flex min-h-0 flex-1 animate-in flex-col fade-in duration-300">
      <div className="hidden items-center gap-2 border-b p-2 @max-[560px]:flex">
        <select
          aria-label={t('chat.sessions')}
          value={activeId ?? ''}
          onChange={(e) => setActiveId(e.target.value || null)}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={newConversation}
          aria-label={t('chat.new')}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-row">
      <div className="flex w-48 shrink-0 flex-col gap-1 border-r p-2 @max-[560px]:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={newConversation}
          aria-label={t('chat.new')}
        >
          <Plus aria-hidden />
          {t('chat.new')}
        </Button>
        <p className="px-1 pt-1 text-[11px] font-medium text-muted-foreground">
          {t('chat.sessions')}
        </p>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                'group flex items-center gap-1 rounded-md px-1 py-0.5',
                s.id === activeId ? 'bg-accent' : 'hover:bg-accent/60',
              )}
            >
              {renamingId === s.id ? (
                <Input
                  aria-label={t('chat.rename')}
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
                  className="h-7 text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className="min-w-0 flex-1 truncate px-1 py-1 text-left text-xs"
                >
                  {s.title}
                </button>
              )}
              <button
                type="button"
                aria-label={t('chat.rename')}
                title={t('chat.rename')}
                onClick={() => {
                  setRenameDraft(s.title)
                  setRenamingId(s.id)
                }}
                className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
              >
                <Pencil className="size-3" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t('chat.deleteSession', { title: s.title })}
                title={t('chat.deleteSession', { title: s.title })}
                onClick={() => removeSession(s.id)}
                className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {!active || active.messages.length === 0 ? (
            <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">
              {t('chat.empty')}
            </p>
          ) : null}
          {active?.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex max-w-[85%] flex-col rounded-xl border p-3',
                message.role === 'user'
                  ? 'self-end bg-muted'
                  : 'self-start bg-card',
              )}
            >
              {editingId === message.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    aria-label={t('chat.edit')}
                    value={editDraft}
                    rows={4}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="min-w-72 rounded-md border border-input bg-background p-2 text-sm outline-none focus-visible:border-ring"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (active) {
                          mutate(active.id, (s) =>
                            editMessage(s, message.id, editDraft),
                          )
                        }
                        setEditingId(null)
                      }}
                    >
                      <Check aria-hidden />
                      {t('chat.save')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X aria-hidden />
                      {t('chat.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {copiedId === message.id ? (
                    <p className="pt-1 text-[11px] text-muted-foreground">
                      {t('chat.copied')}
                    </p>
                  ) : null}
                  <MessageActions
                    message={message}
                    onCopy={() => void onCopy(message)}
                    onResend={() => resendFrom(message)}
                    onEdit={() => {
                      setEditDraft(message.content)
                      setEditingId(message.id)
                    }}
                    onDelete={() => {
                      if (active) mutate(active.id, (s) => deleteMessage(s, message.id))
                    }}
                    onSave={() => onSaveNote(message)}
                  />
                </>
              )}
            </div>
          ))}
          {pending ? (
            <div className="flex items-center gap-2 self-start text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('chat.thinking')}
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error !== null ? (
          <p role="alert" className="border-t px-4 pt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 border-t p-3">
          <Input
            aria-label={t('chat.input')}
            value={input}
            placeholder={t('chat.placeholder')}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <Button
            type="button"
            disabled={pending}
            onClick={send}
            aria-label={t('chat.send')}
          >
            <Send aria-hidden />
          </Button>
        </div>
      </div>
      </div>
    </div>
  )
}

export default ChatView
