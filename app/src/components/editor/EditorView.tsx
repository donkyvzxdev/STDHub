import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUp, FilePlus, FolderOpen, FolderPlus } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import CodeEditor, { type EditorHandle } from './CodeEditor'
import ExplorerTree, { type TreeDraft } from './ExplorerTree'
import FileTabs from './FileTabs'
import { getLanguageId, imageMime } from '@/lib/editorLanguages'
import {
  baseName,
  childPath,
  copyName,
  fsCode,
  parentDir,
  type FileNode,
  type FileProvider,
} from '@/lib/filesystem'
import { TauriFileProvider, isTauriRuntime } from '@/lib/tauriFs'
import {
  UnsupportedProvider,
  WebFileProvider,
  hasFileSystemAccess,
} from '@/lib/webFs'

interface OpenFile {
  path: string
  name: string
  kind: 'text' | 'image'
  content: string
  blobUrl: string | null
  dirty: boolean
  preview: boolean
}

interface EditorViewProps {
  provider?: FileProvider
  explorerHost?: HTMLElement | null
  onOpenFile?: (path: string) => void
}

type ConfirmState =
  | { kind: 'delete'; node: FileNode }
  | { kind: 'discard'; paths: string[] }

function defaultProvider(): FileProvider {
  if (isTauriRuntime()) return new TauriFileProvider()
  if (hasFileSystemAccess()) return new WebFileProvider()
  return new UnsupportedProvider()
}

function setChildren(
  nodes: FileNode[],
  dir: string,
  children: FileNode[],
): FileNode[] {
  return nodes.map((node) =>
    node.path === dir
      ? { ...node, children }
      : node.children
        ? { ...node, children: setChildren(node.children, dir, children) }
        : node,
  )
}

function EditorView({
  provider: providerProp,
  explorerHost,
  onOpenFile,
}: EditorViewProps) {
  const { t } = useTranslation()
  const [provider] = useState<FileProvider>(
    () => providerProp ?? defaultProvider(),
  )
  const [root, setRoot] = useState<string | null>(null)
  const [tree, setTree] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [draft, setDraft] = useState<TreeDraft | null>(null)
  const [dropTabIndex, setDropTabIndex] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const editorHandle = useRef<EditorHandle | null>(null)
  const blobUrls = useRef<Set<string>>(new Set())

  useEffect(() => {
    const owned = blobUrls.current
    return () => {
      for (const url of owned) URL.revokeObjectURL(url)
      owned.clear()
    }
  }, [])

  // The floating button hides while the terminal panel is visible.
  useEffect(() => {
    function onVisibility(e: Event): void {
      const detail = (e as CustomEvent<{ open?: unknown }>).detail
      setTerminalOpen(detail?.open === true)
    }
    window.addEventListener('stdhub:terminal-visibility', onVisibility)
    return () =>
      window.removeEventListener('stdhub:terminal-visibility', onVisibility)
  }, [])
  const saveActiveRef = useRef<() => Promise<void>>(async () => undefined)
  const openPickerRef = useRef<() => Promise<void>>(async () => undefined)
  const saveNoteRef = useRef<(detail: unknown) => Promise<void>>(async () => undefined)
  const resetRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    saveActiveRef.current = saveActive
    openPickerRef.current = openPicker
    saveNoteRef.current = saveNote
    resetRef.current = resetEditorFiles
  })

  function say(text: string): void {
    setNotice(text)
  }

  function fail(code: string): void {
    if (code === 'cancelled') return
    // Folder/file errors must ALSO surface in the sidebar explorer panel:
    // the main editor area starts hidden (Notebook tab closed), so a notice
    // rendered only there is invisible right when the user needs it most
    // (e.g. "needs the desktop app" when picking a folder).
    window.dispatchEvent(
      new CustomEvent('stdhub:fs-error', { detail: { code } }),
    )
    switch (code) {
      case 'too-large':
        say(t('explorer.tooLarge'))
        return
      case 'binary':
        say(t('explorer.binary'))
        return
      case 'invalid-name':
        say(t('explorer.invalidName'))
        return
      case 'exists':
        say(t('explorer.exists'))
        return
      case 'not-found':
        say(t('explorer.notFound'))
        return
      case 'unsupported':
        say(t('explorer.webUnsupported'))
        return
      default:
        say(t('explorer.opFailed'))
    }
  }

  async function refreshAll(
    currentRoot: string,
    keepExpanded: Set<string>,
  ): Promise<boolean> {
    const dirs = [currentRoot, ...keepExpanded]
    const settled = await Promise.all(
      dirs.map(async (dir) => {
        try {
          return { dir, ok: true as const, children: await provider.listDir(dir) }
        } catch (e) {
          return { dir, ok: false as const, error: fsCode(e) }
        }
      }),
    )
    const [rootRes, ...rest] = settled
    // Never blank the tree on a failed refresh: a root failure keeps the
    // previous tree (with an error), a subdir failure keeps old children.
    if (!rootRes || !rootRes.ok) {
      fail(rootRes && !rootRes.ok ? rootRes.error : 'failed')
      return false
    }
    setTree((prev) => {
      let next = rootRes.children
      for (const r of rest) {
        if (r.ok) {
          next = setChildren(next, r.dir, r.children)
        } else {
          const old = findNode(prev, r.dir)?.children
          if (old) next = setChildren(next, r.dir, old)
        }
      }
      return next
    })
    return true
  }

  async function openPicker(): Promise<void> {
    setNotice(null)
    let picked: string | null
    try {
      picked = await provider.openFolder()
    } catch (e) {
      fail(fsCode(e))
      return
    }
    if (!picked) return
    setRoot(picked)
    setTree([])
    setExpanded(new Set())
    setOpenFiles([])
    setActivePath(null)
    setDraft(null)
    try {
      setTree(await provider.listDir(picked))
      window.dispatchEvent(
        new CustomEvent('stdhub:root', { detail: { root: picked } }),
      )
      setNotice(null)
      // Auto-open the Notebook function tab (VSCode-style for studies):
      // picking a folder reveals the editor instead of staying hidden.
      onOpenFile?.(picked)
    } catch (e) {
      fail(fsCode(e))
    }
  }
  openPickerRef.current = openPicker

  async function saveActive(): Promise<void> {
    const file = openFiles.find((f) => f.path === activePath)
    if (!file || !file.dirty) return
    try {
      await provider.writeText(file.path, file.content)
      setOpenFiles((files) =>
        files.map((f) => (f.path === file.path ? { ...f, dirty: false } : f)),
      )
      setNotice(null)
    } catch (e) {
      fail(fsCode(e))
    }
  }
  saveActiveRef.current = saveActive

  useEffect(() => {
    function onOpenFolder(): void {
      void openPickerRef.current()
    }
    function onSave(): void {
      void saveActiveRef.current()
    }
    function onUndo(): void {
      editorHandle.current?.undo()
    }
    function onEditorClosed(): void {
      resetRef.current()
    }
    function onSaveNote(e: Event): void {
      void saveNoteRef.current(
        (e as CustomEvent<{ name?: unknown; content?: unknown }>).detail,
      )
    }
    function onRedo(): void {
      editorHandle.current?.redo()
    }
    function onKeys(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveActiveRef.current()
      }
    }
    window.addEventListener('stdhub:open-folder', onOpenFolder)
    window.addEventListener('stdhub:save', onSave)
    window.addEventListener('stdhub:editor-closed', onEditorClosed)
    window.addEventListener('stdhub:save-note', onSaveNote)
    window.addEventListener('stdhub:undo', onUndo)
    window.addEventListener('stdhub:redo', onRedo)
    window.addEventListener('keydown', onKeys)
    return () => {
      window.removeEventListener('stdhub:open-folder', onOpenFolder)
      window.removeEventListener('stdhub:save', onSave)
      window.removeEventListener('stdhub:editor-closed', onEditorClosed)
      window.removeEventListener('stdhub:save-note', onSaveNote)
      window.removeEventListener('stdhub:undo', onUndo)
      window.removeEventListener('stdhub:redo', onRedo)
      window.removeEventListener('keydown', onKeys)
    }
  }, [])

  async function toggleDir(node: FileNode): Promise<void> {
    if (expanded.has(node.path)) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.delete(node.path)
        return next
      })
      return
    }
    setExpanded((prev) => new Set(prev).add(node.path))
    if (!node.children) {
      try {
        const children = await provider.listDir(node.path)
        setTree((prev) => setChildren(prev, node.path, children))
      } catch (e) {
        fail(fsCode(e))
      }
    }
  }

  function revokeFor(paths: string[]): void {
    for (const f of openFiles) {
      if (paths.includes(f.path) && f.blobUrl) {
        URL.revokeObjectURL(f.blobUrl)
        blobUrls.current.delete(f.blobUrl)
      }
    }
  }

  /**
   * Loads a file from the provider without touching open state.
   * Returns null (with a notice) when it cannot be shown.
   */
  async function loadFile(node: FileNode): Promise<OpenFile | null> {
    try {
      const content = await provider.readText(node.path)
      return {
        path: node.path,
        name: node.name,
        kind: 'text',
        content,
        blobUrl: null,
        dirty: false,
        preview: false,
      }
    } catch (e) {
      if (!imageMime(node.name)) {
        fail(fsCode(e))
        return null
      }
    }
    try {
      const bytes = await provider.readBinary(node.path)
      const mime = imageMime(node.name) ?? 'application/octet-stream'
      const copy = new Uint8Array(bytes)
      const url = URL.createObjectURL(
        new Blob([copy.buffer as ArrayBuffer], { type: mime }),
      )
      blobUrls.current.add(url)
      return {
        path: node.path,
        name: node.name,
        kind: 'image',
        content: '',
        blobUrl: url,
        dirty: false,
        preview: false,
      }
    } catch (err) {
      fail(fsCode(err))
      return null
    }
  }

  /** Single click: open as preview (replaces the current preview). */
  async function openFileNode(node: FileNode): Promise<void> {
    const existing = openFiles.find((f) => f.path === node.path)
    if (existing) {
      setActivePath(node.path)
      onOpenFile?.(node.path)
      return
    }
    const loaded = await loadFile(node)
    if (!loaded) return
    setActivePath(node.path)
    setOpenFiles((files) => {
      if (files.some((f) => f.path === node.path)) return files
      // VSCode-style for studies: a single click reuses ONE preview tab.
      // Dirty previews were already pinned on edit, but never drop unsaved
      // work here — pin any dirty preview instead of discarding it.
      const kept = files.map((f) =>
        f.preview && f.dirty ? { ...f, preview: false } : f,
      ).filter((f) => !f.preview)
      return [...kept, { ...loaded, preview: true }]
    })
    setNotice(null)
    onOpenFile?.(node.path)
  }

  /** Pin a file into its own tab, optionally at an exact position. */
  async function openPinnedAt(path: string, index: number): Promise<void> {
    const existing = openFiles.find((f) => f.path === path)
    if (existing) {
      setOpenFiles((files) => {
        const rest = files.filter((f) => f.path !== path)
        const at = Math.max(0, Math.min(index, rest.length))
        return [
          ...rest.slice(0, at),
          { ...existing, preview: false },
          ...rest.slice(at),
        ]
      })
      setActivePath(path)
      onOpenFile?.(path)
      return
    }
    const name = path.split('/').pop() ?? path
    const loaded = await loadFile({ path, name, isDir: false })
    if (!loaded) return
    setOpenFiles((files) => {
      if (files.some((f) => f.path === path)) return files
      const at = Math.max(0, Math.min(index, files.length))
      return [
        ...files.slice(0, at),
        { ...loaded, preview: false },
        ...files.slice(at),
      ]
    })
    setActivePath(path)
    setNotice(null)
    onOpenFile?.(path)
  }

  function findNode(nodes: FileNode[], path: string): FileNode | null {
    for (const node of nodes) {
      if (node.path === path) return node
      if (node.children) {
        const hit = findNode(node.children, path)
        if (hit) return hit
      }
    }
    return null
  }

  async function moveFile(oldPath: string, targetDir: string): Promise<void> {
    if (!root) return
    const node = findNode(tree, oldPath)
    if (!node) return
    if (targetDir === oldPath || targetDir.startsWith(`${oldPath}/`)) {
      if (node.isDir) {
        say(t('explorer.invalidMove'))
        return
      }
    }
    const name = baseName(oldPath)
    if (parentDir(oldPath) === targetDir) return
    const full = childPath(targetDir, name)
    try {
      await provider.move(oldPath, full)
      const prefix = `${oldPath}/`
      setOpenFiles((files) =>
        files.map((f) => {
          if (f.path !== oldPath && !f.path.startsWith(prefix)) return f
          const next = full + f.path.slice(oldPath.length)
          const nextName = next.split('/').pop() ?? next
          return { ...f, path: next, name: nextName }
        }),
      )
      setActivePath((active) =>
        active === oldPath || (active && active.startsWith(prefix))
          ? full + active.slice(oldPath.length)
          : active,
      )
      if (await refreshAll(root, expanded)) setNotice(null)
    } catch (e) {
      fail(fsCode(e))
    }
  }

  function editContent(path: string, value: string): void {
    setOpenFiles((files) =>
      files.map((f) =>
        f.path === path
          ? { ...f, content: value, dirty: true, preview: false }
          : f,
      ),
    )
  }

  function activateFile(path: string): void {
    setActivePath(path)
  }

  function closePaths(paths: string[], force: boolean): void {
    const targets = openFiles.filter((f) => paths.includes(f.path))
    if (!force && targets.some((f) => f.dirty)) {
      setConfirm({ kind: 'discard', paths: targets.map((f) => f.path) })
      return
    }
    const doomed = new Set(paths)
    revokeFor(paths)
    setOpenFiles((files) => files.filter((f) => !doomed.has(f.path)))
    setActivePath((active) => {
      if (active && !doomed.has(active)) return active
      const rest = openFiles.filter((f) => !doomed.has(f.path))
      return rest.length > 0 ? rest[rest.length - 1].path : null
    })
  }

  function closeFile(path: string): void {
    closePaths([path], false)
  }

  function closeOthers(path: string): void {
    closePaths(
      openFiles.map((f) => f.path).filter((p) => p !== path),
      false,
    )
  }

  function closeAll(): void {
    closePaths(
      openFiles.map((f) => f.path),
      false,
    )
  }

  async function commitDraft(name: string): Promise<void> {
    if (!draft || !root) {
      setDraft(null)
      return
    }
    try {
      let refreshed = true
      if (draft.mode === 'create-file') {
        const full = await provider.createFile(draft.dir, name)
        setDraft(null)
        refreshed = await refreshAll(root, expanded)
        const created = { path: full, name: full.split('/').pop() ?? full }
        await openFileNode({ ...created, isDir: false })
      } else if (draft.mode === 'create-dir') {
        await provider.createDir(draft.dir, name)
        setDraft(null)
        refreshed = await refreshAll(root, expanded)
      } else {
        const oldPath = draft.dir
        const renamed = await provider.rename(oldPath, name)
        setDraft(null)
        setOpenFiles((files) =>
          files.map((f) =>
            f.path === oldPath
              ? { ...f, path: renamed, name: renamed.split('/').pop() ?? renamed }
              : f,
          ),
        )
        setActivePath((active) => (active === oldPath ? renamed : active))
        refreshed = await refreshAll(root, expanded)
      }
      if (refreshed) setNotice(null)
    } catch (e) {
      fail(fsCode(e))
    }
  }

  function startCreate(dir: string, kind: 'file' | 'folder'): void {
    setExpanded((prev) => new Set(prev).add(dir))
    setDraft({
      mode: kind === 'file' ? 'create-file' : 'create-dir',
      dir,
      initial: '',
    })
  }

  function onNodeAction(node: FileNode, action: string): void {
    switch (action) {
      case 'open':
        if (!node.isDir) void openFileNode(node)
        return
      case 'new-file':
        startCreate(node.path, 'file')
        return
      case 'new-dir':
        startCreate(node.path, 'folder')
        return
      case 'rename':
        setDraft({ mode: 'rename', dir: node.path, initial: node.name })
        return
      case 'delete':
        setConfirm({ kind: 'delete', node })
        return
      case 'duplicate':
        void duplicateFile(node)
        return
      case 'copy-path':
        void copyPath(node.path)
        return
      default:
        return
    }
  }

  async function duplicateFile(node: FileNode): Promise<void> {
    if (node.isDir || !root) return
    try {
      const bytes = await provider.readBinary(node.path)
      const dir = parentDir(node.path)
      const siblings = await provider.listDir(dir)
      const taken = new Set(siblings.map((s) => s.name))
      let candidate = copyName(node.name)
      for (let n = 2; taken.has(candidate) && n < 100; n++) {
        const dot = node.name.lastIndexOf('.')
        candidate =
          dot <= 0
            ? `${node.name} copy ${n}`
            : `${node.name.slice(0, dot)} copy ${n}${node.name.slice(dot)}`
      }
      if (taken.has(candidate)) {
        fail('exists')
        return
      }
      await provider.writeBinary(childPath(dir, candidate), bytes)
      if (await refreshAll(root, expanded)) setNotice(null)
    } catch (e) {
      fail(fsCode(e))
    }
  }

  async function copyPath(path: string): Promise<void> {    try {
      if (!navigator.clipboard) throw new Error('clipboard')
      await navigator.clipboard.writeText(path)
      say(t('explorer.copied'))
    } catch {
      say(t('explorer.copyFailed', { path }))
    }
  }

  /**
   * Saves an external note (e.g. from the chatbot) as a file in the open
   * folder and opens it. Needs a folder; otherwise shows how to proceed.
   */
  async function saveNote(detail: unknown): Promise<void> {
    const rec =
      typeof detail === 'object' && detail !== null
        ? (detail as Record<string, unknown>)
        : {}
    const name = typeof rec['name'] === 'string' ? rec['name'] : ''
    const content = typeof rec['content'] === 'string' ? rec['content'] : ''
    if (!root || name === '') {
      say(t('explorer.noteNoFolder'))
      onOpenFile?.('')
      return
    }
    try {
      const full = await provider.createFile(root, name)
      await provider.writeText(full, content)
      await refreshAll(root, expanded)
      const created = { path: full, name: full.split('/').pop() ?? full }
      await openFileNode({ ...created, isDir: false })
    } catch (e) {
      fail(fsCode(e))
    }
  }

  /**
   * The notebook never persists open tabs: closing the editor view drops
   * them (asking first when dirty). The explorer tree is untouched.
   */
  function resetEditorFiles(): void {
    if (openFiles.length === 0) return
    if (openFiles.some((f) => f.dirty)) {
      setConfirm({ kind: 'discard', paths: openFiles.map((f) => f.path) })
      return
    }
    setOpenFiles([])
    setActivePath(null)
  }

  async function confirmDelete(): Promise<void> {
    if (confirm?.kind !== 'delete' || !root) return
    const node = confirm.node
    setConfirm(null)
    try {
      await provider.remove(node.path, node.isDir)
      revokeFor([node.path])
      setOpenFiles((files) => files.filter((f) => f.path !== node.path))
      setActivePath((active) => (active === node.path ? null : active))
      if (await refreshAll(root, expanded)) setNotice(null)
    } catch (e) {
      fail(fsCode(e))
    }
  }

  function confirmDiscard(): void {    if (confirm?.kind !== 'discard') return
    const doomed = new Set(confirm.paths)
    setConfirm(null)
    revokeFor([...doomed])
    setOpenFiles((files) => files.filter((f) => !doomed.has(f.path)))
    setActivePath((active) =>
      active && !doomed.has(active) ? active : null,
    )
  }

  const activeFile = openFiles.find((f) => f.path === activePath) ?? null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {root ? (
        <>
        <FileTabs
          files={openFiles.map((f) => ({
            path: f.path,
            name: f.name,
            dirty: f.dirty,
            preview: f.preview,
          }))}
          active={activePath}
          canSave={activeFile !== null && activeFile.dirty}
          highlightIndex={dropTabIndex}
          onActivate={activateFile}
            onClose={closeFile}
            onCloseOthers={closeOthers}
            onCloseAll={closeAll}
            onSave={() => void saveActiveRef.current()}
          />
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeFile ? (
            activeFile.kind === 'image' && activeFile.blobUrl ? (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                <img
                  src={activeFile.blobUrl}
                  alt={activeFile.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <CodeEditor
                key={activeFile.path}
                language={getLanguageId(activeFile.name)}
                value={activeFile.content}
                onChange={(value) => editContent(activeFile.path, value)}
                onSave={() => void saveActiveRef.current()}
                handleRef={editorHandle}
              />
            )
          ) : null}
        </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <FolderOpen
            className="size-8 text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm font-medium">{t('explorer.noFolder')}</p>
          <p className="text-xs text-muted-foreground">
            {t('explorer.noFolderHint')}
          </p>
          <Button type="button" onClick={() => void openPickerRef.current()}>
            {t('explorer.openFolder')}
          </Button>
        </div>
      )}
      {notice ? (
        <p role="status" className="border-t px-4 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {terminalOpen ? null : (
        <button
          type="button"
          aria-label={t('explorer.terminal')}
          title={t('explorer.terminal')}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('stdhub:terminal-show'))
          }}
          className="absolute right-4 bottom-4 z-10 animate-in rounded-full bg-muted/70 p-2 text-muted-foreground opacity-60 shadow transition fade-in zoom-in-75 duration-200 hover:bg-accent hover:text-accent-foreground hover:opacity-100"
        >
          <ArrowUp className="size-3.5" aria-hidden />
        </button>
      )}
      {root && explorerHost
        ? createPortal(
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center gap-0.5 px-2 pb-1">
                <p className="min-w-0 flex-1 truncate px-1 text-[11px] text-muted-foreground">
                  {root}
                </p>
                <button
                  type="button"
                  aria-label={t('explorer.newFile')}
                  title={t('explorer.newFile')}
                  onClick={() => startCreate(root, 'file')}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <FilePlus className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t('explorer.newFolder')}
                  title={t('explorer.newFolder')}
                  onClick={() => startCreate(root, 'folder')}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <FolderPlus className="size-4" aria-hidden />
                </button>
              </div>
              <ExplorerTree
                nodes={tree}
                currentDir={root}
                expanded={expanded}
                activePath={activePath}
                draft={draft}
              onToggleDir={(node) => void toggleDir(node)}
              onOpenFile={(node) => void openFileNode(node)}
              onOpenPinned={(node) =>
                void openPinnedAt(node.path, Number.MAX_SAFE_INTEGER)
              }
              onNodeAction={onNodeAction}
              onDropTab={(path, index) => void openPinnedAt(path, index)}
              onTabDragOver={setDropTabIndex}
              onMoveFile={(oldPath, targetDir) => void moveFile(oldPath, targetDir)}
              onBlankAction={(kind) =>
                  startCreate(root, kind === 'file' ? 'file' : 'folder')
                }
                onDraftCommit={(name) => void commitDraft(name)}
                onDraftCancel={() => setDraft(null)}
              />
            </div>,
            explorerHost,
          )
        : null}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'delete'
                ? t('explorer.deleteTitle', { name: confirm.node.name })
                : t('explorer.unsavedTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'delete'
                ? confirm.node.isDir
                  ? t('explorer.deleteDirText')
                  : t('explorer.deleteFileText')
                : t('explorer.unsavedText')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm?.kind === 'delete') void confirmDelete()
                else confirmDiscard()
              }}
            >
              {confirm?.kind === 'delete'
                ? t('explorer.confirmDelete')
                : t('explorer.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default EditorView
