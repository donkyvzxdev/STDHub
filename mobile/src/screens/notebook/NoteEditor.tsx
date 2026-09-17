import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Bold,
  Calculator,
  Code2,
  Image,
  Italic,
  Link2,
  List,
  ListChecks,
  Redo2,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import { useApp } from '../../state/app'
import { useI18n } from '../../state/i18n'
import { getFs } from '../../lib/fs'
import {
  deleteNote,
  readNote,
  titleFromContent,
  writeNote,
  saveNoteContent,
} from '../../lib/notes'
import { renderMarkdown } from '../../lib/markdown'
import { useUndo } from '../../lib/undo'
import { errorKey } from '../../lib/errors'
import { shareText } from '../../lib/share'
import { TopBar, BackButton } from '../../components/navigation'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Btn, EmptyState } from '../../components/ui/primitives'
import { CalcPad } from '../../components/calculator/CalcPad'

function stampName(): string {
  const now = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `Nota ${p(now.getDate())}/${p(now.getMonth() + 1)} ${p(now.getHours())}:${p(now.getMinutes())}`
}

export function NoteEditor({ path }: { path: string | null }) {
  const { t } = useI18n()
  const { back, goTab, setTutorDraft, settings, showToast } = useApp()
  const [ready, setReady] = useState(path === null)
  const [missing, setMissing] = useState(false)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [view, setView] = useState<'edit' | 'preview'>(settings.defaultNoteView)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [selection, setSelection] = useState('')
  const editor = useUndo('')
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<number | null>(null)
  const typeTimer = useRef<number | null>(null)
  const currentPath = useRef<string | null>(path)

  useEffect(() => {
    if (path === null) {
      setTitle(stampName())
      setReady(true)
      return
    }
    let alive = true
    void readNote(getFs(), path)
      .then((content) => {
        if (!alive) return
        editor.reset(content)
        setText(content)
        setTitle(titleFromContent(content, path.split('/').pop() ?? path))
        setReady(true)
      })
      .catch(() => {
        if (alive) {
          setMissing(true)
          setReady(true)
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  function fail(code: string): void {
    setError(t(errorKey(code)))
  }

  async function persist(content: string, titleText: string): Promise<boolean> {
    setSaveState('saving')
    try {
      const fs = getFs()
      if (currentPath.current === null) {
        const name = titleText.trim() === '' ? stampName() : titleText
        currentPath.current = await writeNote(fs, '', name, content)
      } else {
        await saveNoteContent(fs, currentPath.current, content)
      }
      setSaveState('saved')
      setError(null)
      return true
    } catch (e) {
      setSaveState('')
      fail(e instanceof Error ? e.message : 'generic')
      return false
    }
  }

  function scheduleAutosave(content: string, titleText: string): void {
    if (!settings.autosave) return
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void persist(content, titleText)
    }, 1200)
  }

  function onType(value: string): void {
    setText(value)
    // Coalesce fast typing into one undo step after a pause.
    if (typeTimer.current !== null) window.clearTimeout(typeTimer.current)
    typeTimer.current = window.setTimeout(() => editor.push(value), 800)
    scheduleAutosave(value, title)
  }

  function flushTyping(): void {
    if (typeTimer.current !== null) {
      window.clearTimeout(typeTimer.current)
      typeTimer.current = null
    }
    editor.push(text)
  }

  function wrapSelection(before: string, after = ''): void {
    flushTyping()
    const el = areaRef.current
    const value = text
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const selected = value.slice(start, end)
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    setText(next)
    editor.push(next)
    scheduleAutosave(next, title)
    requestAnimationFrame(() => {
      if (!areaRef.current) return
      const pos = start + before.length + selected.length + after.length
      areaRef.current.focus()
      areaRef.current.setSelectionRange(pos, pos)
    })
  }

  function insertAtCursor(insert: string): void {
    flushTyping()
    const el = areaRef.current
    const value = text
    const at = el?.selectionStart ?? value.length
    const next = `${value.slice(0, at)}${insert}${value.slice(at)}`
    setText(next)
    editor.push(next)
    scheduleAutosave(next, title)
  }

  function trackSelection(): void {
    const el = areaRef.current
    if (!el) {
      setSelection('')
      return
    }
    const selected = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0)
    setSelection(selected.trim() === '' ? '' : selected)
  }

  function askTutor(): void {
    if (selection === '') return
    setTutorDraft(
      `${t('tutor.contextFrom')}: "${selection.slice(0, 500)}"`,
    )
    goTab('tutor')
  }

  async function onShare(): Promise<void> {
    const content = `# ${title}\n\n${text}`
    const result = await shareText(content, title)
    if (result === 'copied') showToast(t('calc.copied'))
    if (result === 'failed') fail('generic')
  }

  async function onDelete(): Promise<void> {
    if (currentPath.current === null) {
      back()
      return
    }
    try {
      await deleteNote(getFs(), currentPath.current)
      back()
    } catch {
      fail('generic')
    }
  }

  if (!ready) {
    return (
      <>
        <TopBar title="" left={<BackButton onBack={back} label={t('common.back')} />} />
        <div className="m-content">
          <p className="m-muted">{t('common.loading')}</p>
        </div>
      </>
    )
  }

  if (missing) {
    return (
      <>
        <TopBar title="" left={<BackButton onBack={back} label={t('common.back')} />} />
        <div className="m-content">
          <EmptyState title={t('errors.notFound')} />
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar
        title={title === '' ? t('notebook.newNote') : title}
        left={<BackButton onBack={back} label={t('common.back')} />}
        right={
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={t('common.delete')}
            style={{ minWidth: 44, minHeight: 44, background: 'none', border: 0 }}
          >
            <Trash2 aria-hidden style={{ width: 22, height: 22 }} />
          </button>
        }
      />
      <div style={{ padding: '8px 16px 0' }}>
        <input
          aria-label={t('notebook.noteTitle')}
          value={title}
          placeholder={t('notebook.noteTitle')}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: '100%',
            background: 'none',
            border: 0,
            color: 'var(--text)',
            fontSize: 22,
            fontWeight: 700,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span className="m-muted" style={{ fontSize: 12 }}>
            {saveState === 'saving'
              ? t('common.saving')
              : saveState === 'saved'
                ? `✓ ${t('common.saved')}`
                : ''}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setView('edit')}
            aria-pressed={view === 'edit'}
            style={tabStyle(view === 'edit')}
          >
            {t('notebook.edit')}
          </button>
          <button
            type="button"
            onClick={() => setView('preview')}
            aria-pressed={view === 'preview'}
            style={tabStyle(view === 'preview')}
          >
            {t('notebook.preview')}
          </button>
        </div>
      </div>

      {error !== null ? (
        <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, padding: '4px 16px 0' }}>
          {error}
        </p>
      ) : null}

      <div className="m-content" style={{ paddingTop: 8 }}>
        {view === 'edit' ? (
          <>
            <div
              role="toolbar"
              aria-label="editor"
              style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '4px 0 8px' }}
            >
              <ToolBtn label={t('notebook.bold')} onTap={() => wrapSelection('**', '**')}>
                <Bold aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn label={t('notebook.italic')} onTap={() => wrapSelection('*', '*')}>
                <Italic aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn label={t('notebook.heading')} onTap={() => wrapSelection('## ')}>
                <Type aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn label={t('notebook.list')} onTap={() => wrapSelection('- ')}>
                <List aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn label={t('notebook.checklist')} onTap={() => wrapSelection('- [ ] ')}>
                <ListChecks aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn label={t('notebook.code')} onTap={() => wrapSelection('`', '`')}>
                <Code2 aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn
                label={t('notebook.link')}
                onTap={() => {
                  const url = window.prompt(t('notebook.imageUrl'), 'https://')
                  if (url) wrapSelection('[', `](${url})`)
                }}
              >
                <Link2 aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn
                label={t('notebook.image')}
                onTap={() => {
                  const url = window.prompt(t('notebook.imageUrl'), 'https://')
                  if (url) wrapSelection('![', `](${url})`)
                }}
              >
                <Image aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn
                label={t('notebook.undo')}
                onTap={() => {
                  flushTyping()
                  const next = editor.undo()
                  setText(next)
                  scheduleAutosave(next, title)
                }}
              >
                <Undo2 aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn
                label={t('notebook.redo')}
                onTap={() => {
                  flushTyping()
                  const next = editor.redo()
                  setText(next)
                  scheduleAutosave(next, title)
                }}
              >
                <Redo2 aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
              <ToolBtn label={t('notebook.calcTitle')} onTap={() => setShowCalc(true)}>
                <Calculator aria-hidden style={{ width: 18, height: 18 }} />
              </ToolBtn>
            </div>
            {selection !== '' ? (
              <button type="button" onClick={askTutor} className="m-btn" style={{ width: '100%', marginBottom: 8 }}>
                {t('notebook.askTutor')}
              </button>
            ) : null}
            <textarea
              ref={areaRef}
              aria-label={t('notebook.writePlaceholder')}
              value={text}
              rows={14}
              placeholder={t('notebook.writePlaceholder')}
              onChange={(e) => onType(e.target.value)}
              onBlur={flushTyping}
              onSelect={trackSelection}
              onKeyUp={trackSelection}
              className="m-textarea"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Btn
                primary
                onClick={() => {
                  flushTyping()
                  void persist(text, title)
                }}
                style={{ flex: 1 }}
              >
                {t('common.save')}
              </Btn>
              <Btn onClick={() => void onShare()} style={{ flex: 1 }}>
                {t('common.share')}
              </Btn>
            </div>
          </>
        ) : (
          <div>{renderMarkdown(text)}</div>
        )}
      </div>

      {showCalc && (
        <BottomSheet title={t('notebook.calcTitle')} onClose={() => setShowCalc(false)}>          <CalcPad
            onInsert={(text) => {
              insertAtCursor(text)
              setShowCalc(false)
            }}
          />
        </BottomSheet>
      )}

      {confirmDelete && (
        <BottomSheet title={t('files.deleteConfirm')} onClose={() => setConfirmDelete(false)}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setConfirmDelete(false)} style={{ flex: 1 }}>
              {t('common.cancel')}
            </Btn>
            <Btn
              onClick={() => {
                setConfirmDelete(false)
                void onDelete()
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

function tabStyle(active: boolean): CSSProperties {
  return {
    minHeight: 36,
    padding: '4px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--accent-text)' : 'var(--muted)',
    fontSize: 13,
  }
}

function ToolBtn({ label, onTap, children }: { label: string; onTap: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onTap}
      style={{
        minWidth: 44,
        minHeight: 44,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--card)',
        fontSize: 15,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
