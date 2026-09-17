import { useEffect, useState } from 'react'
import { useApp } from '../../state/app'
import { useI18n } from '../../state/i18n'
import { getFs } from '../../lib/fs'
import { listNotes, type NoteEntry } from '../../lib/notes'
import { TopBar } from '../../components/navigation'
import { EmptyState } from '../../components/ui/primitives'

export function NotebookHome() {
  const { t } = useI18n()
  const { go } = useApp()
  const [notes, setNotes] = useState<NoteEntry[] | null>(null)

  useEffect(() => {
    let alive = true
    void listNotes(getFs()).then((all) => {
      if (alive) setNotes(all)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <TopBar
        title={t('notebook.title')}
        right={
          <button
            type="button"
            onClick={() => go({ name: 'note', path: null })}
            aria-label={t('notebook.newNote')}
            data-tour="notebook-new"
            style={{
              minWidth: 44,
              minHeight: 44,
              background: 'var(--accent)',
              color: 'var(--accent-text)',
              border: 0,
              borderRadius: 12,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            +
          </button>
        }
      />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes === null ? (
          <p className="m-muted">{t('common.loading')}</p>
        ) : notes.length === 0 ? (
          <EmptyState
            title={t('notebook.emptyTitle')}
            text={t('notebook.emptyText')}
            action={
              <button
                type="button"
                onClick={() => go({ name: 'note', path: null })}
                className="m-btn m-btn-primary"
              >
                + {t('notebook.newNote')}
              </button>
            }
          />
        ) : (
          notes.map((note) => (
            <button
              key={note.path}
              type="button"
              onClick={() => go({ name: 'note', path: note.path })}
              aria-label={note.title}
              className="m-card"
              style={{ width: '100%', textAlign: 'left' }}
            >
              <div style={{ fontWeight: 600 }}>📄 {note.title}</div>
              <div className="m-muted" style={{ fontSize: 12 }}>
                {note.path}
              </div>
            </button>
          ))
        )}
      </div>
    </>
  )
}
