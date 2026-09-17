import { useEffect, useState, type CSSProperties } from 'react'
import { Folder, FileText, Pencil, Trash2, Package, Share2 } from 'lucide-react'
import { useApp } from '../state/app'
import { useI18n } from '../state/i18n'
import { getFs } from '../lib/fs'
import {
  deleteFolder,
  deleteNote,
  listFolders,
  listNotes,
  readNote,
  renameNote,
  sanitizeFolder,
  saveNoteContent,
  type FolderEntry,
  type NoteEntry,
} from '../lib/notes'
import { errorKey } from '../lib/errors'
import { shareText } from '../lib/share'
import { TopBar, BackButton } from '../components/navigation'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Btn, EmptyState, Field } from '../components/ui/primitives'

export function FilesScreen() {
  const { t } = useI18n()
  const { go, back, settings } = useApp()
  const [notes, setNotes] = useState<NoteEntry[] | null>(null)
  const [folders, setFolders] = useState<FolderEntry[]>([])
  const [dir, setDir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<
    | null
    | { kind: 'newFolder' }
    | { kind: 'rename'; path: string; isDir: boolean; current: string }
    | { kind: 'move'; path: string }
    | { kind: 'confirm'; path: string; isDir: boolean }
  >(null)
  const [nameDraft, setNameDraft] = useState('')
  const [moveTarget, setMoveTarget] = useState('')

  async function refresh(): Promise<void> {
    try {
      const fs = getFs()
      setNotes(await listNotes(fs))
      setFolders(await listFolders(fs))
      setError(null)
    } catch {
      setError(t('errors.generic'))
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function fail(e: unknown): void {
    setError(t(errorKey(e instanceof Error ? e.message : 'generic')))
  }

  const visibleNotes = (notes ?? []).filter(
    (n) => n.path.split('/').slice(0, -1).join('/') === dir,
  )
  const visibleFolders = folders.filter(
    (f) => f.path !== '' && f.path.split('/').slice(0, -1).join('/') === dir,
  )
  const crumbs = dir === '' ? [] : dir.split('/')

  async function submitSheet(): Promise<void> {
    const fs = getFs()
    try {
      if (sheet?.kind === 'newFolder') {
        const clean = sanitizeFolder(nameDraft)
        if (!clean) throw new Error('invalid-name')
        const full = dir === '' ? clean : `${dir}/${clean}`
        if (folders.some((f) => f.path === full)) throw new Error('exists')
        await getFs().mkdir(`notes/${full}`)
        setError(null)
      } else if (sheet?.kind === 'rename') {
        if (sheet.isDir) {
          // Folder rename is a move in this flat model.
          const parent = sheet.path.split('/').slice(0, -1).join('/')
          const clean = nameDraft.trim()
          if (clean === '' || /[/\\:*?"<>|]/.test(clean)) throw new Error('invalid-name')
          const target = parent === '' ? clean : `${parent}/${clean}`
          const all = await listNotes(fs)
          for (const note of all.filter((n) => n.path === sheet.path || n.path.startsWith(`${sheet.path}/`))) {
            const rest = note.path.slice(sheet.path.length)
            const content = await readNote(fs, note.path)
            await saveNoteContent(fs, `${target}${rest}`, content)
            await deleteNote(fs, note.path)
          }
          if (dir === sheet.path || dir.startsWith(`${sheet.path}/`)) {
            setDir(target === sheet.path ? target : dir.replace(sheet.path, target))
          }
        } else {
          await renameNote(fs, sheet.path, nameDraft)
        }
        setError(null)
      } else if (sheet?.kind === 'move') {
        const fileName = sheet.path.split('/').pop() ?? sheet.path
        const content = await readNote(fs, sheet.path)
        const targetDir = moveTarget
        const target = targetDir === '' ? fileName : `${targetDir}/${fileName}`
        if (target !== sheet.path) {
          await saveNoteContent(fs, target, content)
          await deleteNote(fs, sheet.path)
        }
        setError(null)
      }
      setSheet(null)
      setNameDraft('')
      await refresh()
    } catch (e) {
      fail(e)
    }
  }

  async function shareNote(path: string, title: string): Promise<void> {
    try {
      const content = await readNote(getFs(), path)
      await shareText(`# ${title}\n\n${content}`, title)
    } catch {
      setError(t('errors.generic'))
    }
  }

  async function confirmDelete(): Promise<void> {
    if (sheet?.kind !== 'confirm') return
    try {
      if (sheet.isDir) await deleteFolder(getFs(), sheet.path)
      else await deleteNote(getFs(), sheet.path)
      if (dir === sheet.path) setDir('')
      setSheet(null)
      await refresh()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <>
      <TopBar
        title={dir === '' ? t('files.title') : dir.split('/').pop() ?? dir}
        left={<BackButton onBack={back} label={t('common.back')} />}
        right={
          <button
            type="button"
            onClick={() => {
              setNameDraft('')
              setSheet({ kind: 'newFolder' })
            }}
            aria-label={t('files.newFolder')}
            style={{ minWidth: 44, minHeight: 44, background: 'none', border: 0, fontSize: 20 }}
          >
            📁+
          </button>
        }
      />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {crumbs.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setDir('')}
              style={{ background: 'none', border: 0, color: 'var(--accent)', fontSize: 14 }}
            >
              {t('files.rootFolder')}
            </button>
            {crumbs.map((part, i) => (
              <span key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span className="m-muted">/</span>
                <button
                  type="button"
                  onClick={() => setDir(crumbs.slice(0, i + 1).join('/'))}
                  style={{ background: 'none', border: 0, color: 'var(--accent)', fontSize: 14 }}
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
        )}

        {error !== null && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: 14 }}>
            {error}
          </p>
        )}

        {notes === null ? (
          <p className="m-muted">{t('common.loading')}</p>
        ) : visibleNotes.length === 0 && visibleFolders.length === 0 ? (
          <EmptyState
            title={t('files.empty')}
            action={
              <button
                type="button"
                onClick={() => go({ name: 'note', path: null })}
                className="m-btn m-btn-primary"
              >
                + {t('files.newNote')}
              </button>
            }
          />
        ) : (
          <>
            {visibleFolders.map((folder) => (
              <div key={folder.path} className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setDir(folder.path)}
                  style={{ flex: 1, background: 'none', border: 0, textAlign: 'left', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}
                  aria-label={folder.name}
                >
                  <Folder aria-hidden style={{ width: 20, height: 20, flexShrink: 0 }} />
                  {folder.name}
                </button>
                <button
                  type="button"
                  aria-label={`${t('files.rename')}: ${folder.name}`}
                  onClick={() => {
                    setNameDraft(folder.name)
                    setSheet({ kind: 'rename', path: folder.path, isDir: true, current: folder.name })
                  }}
                  style={iconBtn}
                >
                  <Pencil aria-hidden style={{ width: 18, height: 18 }} />
                </button>
                <button
                  type="button"
                  aria-label={`${t('files.delete')}: ${folder.name}`}
                  onClick={() => setSheet({ kind: 'confirm', path: folder.path, isDir: true })}
                  style={iconBtn}
                >
                  <Trash2 aria-hidden style={{ width: 18, height: 18 }} />
                </button>
              </div>
            ))}
            {visibleNotes.map((note) => (
              <div key={note.path} className="m-card">
                <button
                  type="button"
                  onClick={() => go({ name: 'note', path: note.path })}
                  style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}
                  aria-label={`${t('files.open')}: ${note.title}`}
                >
                  <FileText aria-hidden style={{ width: 20, height: 20, flexShrink: 0 }} />
                  {note.title}
                </button>
                {settings.advanced && (
                  <div className="m-muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {t('files.advancedPath')}: {note.path}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                  <button
                    type="button"
                    aria-label={`${t('files.rename')}: ${note.title}`}
                    onClick={() => {
                      setNameDraft(note.title)
                      setSheet({ kind: 'rename', path: note.path, isDir: false, current: note.title })
                    }}
                    style={iconBtn}
                  >
                    <Pencil aria-hidden style={{ width: 18, height: 18 }} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t('files.move')}: ${note.title}`}
                    onClick={() => {
                      setMoveTarget(dir)
                      setSheet({ kind: 'move', path: note.path })
                    }}
                    style={iconBtn}
                  >
                    <Package aria-hidden style={{ width: 18, height: 18 }} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t('files.share')}: ${note.title}`}
                    onClick={() => void shareNote(note.path, note.title)}
                    style={iconBtn}
                  >
                    <Share2 aria-hidden style={{ width: 18, height: 18 }} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t('files.delete')}: ${note.title}`}
                    onClick={() => setSheet({ kind: 'confirm', path: note.path, isDir: false })}
                    style={iconBtn}
                  >
                    <Trash2 aria-hidden style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {sheet?.kind === 'newFolder' && (
        <BottomSheet title={t('files.newFolder')} onClose={() => setSheet(null)}>
          <Field label={t('files.newFolder')}>
            <input
              aria-label={t('files.newFolder')}
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitSheet()
              }}
              className="m-input"
            />
          </Field>
          <Btn primary onClick={() => void submitSheet()} style={{ width: '100%' }}>
            {t('common.save')}
          </Btn>
        </BottomSheet>
      )}

      {sheet?.kind === 'rename' && (
        <BottomSheet title={t('files.rename')} onClose={() => setSheet(null)}>
          <Field label={t('files.rename')}>
            <input
              aria-label={t('files.rename')}
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitSheet()
              }}
              className="m-input"
            />
          </Field>
          <Btn primary onClick={() => void submitSheet()} style={{ width: '100%' }}>
            {t('common.save')}
          </Btn>
        </BottomSheet>
      )}

      {sheet?.kind === 'move' && (
        <BottomSheet title={t('files.moveTo')} onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setMoveTarget('')}
              aria-pressed={moveTarget === ''}
              className="m-card"
              style={{ textAlign: 'left', borderColor: moveTarget === '' ? 'var(--accent)' : undefined }}
            >
              📁 {t('files.rootFolder')}
            </button>
            {folders
              .filter((f) => f.path !== '')
              .map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  onClick={() => setMoveTarget(folder.path)}
                  aria-pressed={moveTarget === folder.path}
                  className="m-card"
                  style={{ textAlign: 'left', borderColor: moveTarget === folder.path ? 'var(--accent)' : undefined }}
                >
                  📁 {folder.path}
                </button>
              ))}
          </div>
          <Btn primary onClick={() => void submitSheet()} style={{ width: '100%' }}>
            {t('files.move')}
          </Btn>
        </BottomSheet>
      )}

      {sheet?.kind === 'confirm' && (
        <BottomSheet title={t('files.deleteConfirm')} onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setSheet(null)} style={{ flex: 1 }}>
              {t('common.cancel')}
            </Btn>
            <Btn
              onClick={() => void confirmDelete()}
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

const iconBtn: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  background: 'none',
  border: 0,
  fontSize: 16,
}
