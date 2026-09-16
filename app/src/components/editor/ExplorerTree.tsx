import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileCode2,
  FileJson,
  FileTerminal,
  FileText,
  Folder,
  FolderOpen,
  Image,
  X,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { insertionIndex } from '@/lib/dragFile'
import { iconKind } from '@/lib/editorLanguages'
import { parentDir, type FileNode } from '@/lib/filesystem'

export type NodeAction =
  | 'open'
  | 'new-file'
  | 'new-dir'
  | 'rename'
  | 'delete'
  | 'duplicate'
  | 'copy-path'

export interface TreeDraft {
  mode: 'create-file' | 'create-dir' | 'rename'
  dir: string
  initial: string
}

const DRAG_THRESHOLD = 6

function NodeIcon({ node, open }: { node: FileNode; open: boolean }) {
  const cls = 'size-4 shrink-0'
  if (node.isDir) {
    return open ? (
      <FolderOpen className={`${cls} text-sky-300`} aria-hidden />
    ) : (
      <Folder className={`${cls} text-sky-300`} aria-hidden />
    )
  }
  switch (iconKind(node.name)) {
    case 'md':
      return <FileText className={`${cls} text-zinc-200`} aria-hidden />
    case 'ts':
      return <FileCode2 className={`${cls} text-[#3178c6]`} aria-hidden />
    case 'json':
      return <FileJson className={`${cls} text-amber-300`} aria-hidden />
    case 'terminal':
      return <FileTerminal className={`${cls} text-emerald-300`} aria-hidden />
    case 'image':
      return <Image className={`${cls} text-violet-300`} aria-hidden />
    case 'code':
      return <FileCode className={`${cls} text-zinc-300`} aria-hidden />
    default:
      return <File className={`${cls} text-muted-foreground`} aria-hidden />
  }
}

interface DraftInputProps {
  initial: string
  confirmLabel: string
  onCommit: (name: string) => void
  onCancel: () => void
}

function DraftInput({
  initial,
  confirmLabel,
  onCommit,
  onCancel,
}: DraftInputProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initial)
  return (
    <div className="flex items-center gap-1 px-2 py-0.5">
      <input
        autoFocus
        value={value}
        aria-label={t('explorer.fileName')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(value)
          if (e.key === 'Escape') onCancel()
        }}
        className="h-6 min-w-0 flex-1 rounded border border-input bg-background px-1 text-xs outline-none focus-visible:border-ring"
      />
      <button
        type="button"
        aria-label={confirmLabel}
        onClick={() => onCommit(value)}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <Check className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t('common.cancel')}
        onClick={onCancel}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}

interface RowProps {
  node: FileNode
  depth: number
  expanded: boolean
  active: boolean
  highlighted: boolean
  draft: TreeDraft | null
  onToggleDir: (node: FileNode) => void
  onOpenFile: (node: FileNode) => void
  onOpenPinned: (node: FileNode) => void
  onNodeAction: (node: FileNode, action: NodeAction) => void
  onPointerDownRow: (e: React.PointerEvent, node: FileNode) => void
  claimClick: () => boolean
  onDraftCommit: (name: string) => void
  onDraftCancel: () => void
}

function Row({
  node,
  depth,
  expanded,
  active,
  highlighted,
  draft,
  onToggleDir,
  onOpenFile,
  onOpenPinned,
  onNodeAction,
  onPointerDownRow,
  claimClick,
  onDraftCommit,
  onDraftCancel,
}: RowProps) {
  const { t } = useTranslation()
  const renaming = draft?.mode === 'rename' && draft.dir === node.path

  return (
    <div
      data-drop-dir={node.isDir ? node.path : parentDir(node.path)}
      onPointerDown={(e) => onPointerDownRow(e, node)}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <ContextMenu>
        <ContextMenuTrigger>
          {renaming ? (
            <DraftInput
              initial={draft.initial}
              confirmLabel={t('explorer.rename')}
              onCommit={onDraftCommit}
              onCancel={onDraftCancel}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (claimClick()) return
                if (node.isDir) onToggleDir(node)
                else onOpenFile(node)
              }}
              onDoubleClick={() => {
                if (claimClick()) return
                if (!node.isDir) onOpenPinned(node)
              }}
              aria-expanded={node.isDir ? expanded : undefined}
              className={
                highlighted || active
                  ? 'flex w-full items-center gap-1 rounded bg-accent px-2 py-1 text-left text-xs text-accent-foreground'
                  : 'flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground'
              }
              style={{ paddingLeft: depth * 12 + 8 }}
            >
              {node.isDir ? (
                expanded ? (
                  <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                )
              ) : null}
              <NodeIcon node={node} open={expanded} />
              <span className="truncate">{node.name}</span>
            </button>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            {!node.isDir ? (
              <ContextMenuItem onClick={() => onOpenPinned(node)}>
                {t('explorer.openInNewTab')}
              </ContextMenuItem>
            ) : null}
            {node.isDir ? (
              <>
                <ContextMenuItem onClick={() => onNodeAction(node, 'new-file')}>
                  {t('explorer.newFile')}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onNodeAction(node, 'new-dir')}>
                  {t('explorer.newFolder')}
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            ) : null}
            <ContextMenuItem onClick={() => onNodeAction(node, 'rename')}>
              {t('explorer.rename')}
            </ContextMenuItem>
            {!node.isDir ? (
              <ContextMenuItem onClick={() => onNodeAction(node, 'duplicate')}>
                {t('explorer.duplicate')}
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem onClick={() => onNodeAction(node, 'copy-path')}>
              {t('explorer.copyPath')}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onNodeAction(node, 'delete')}>
              {t('explorer.delete')}
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

interface ExplorerTreeProps {
  nodes: FileNode[]
  currentDir: string
  expanded: Set<string>
  activePath: string | null
  draft: TreeDraft | null
  onToggleDir: (node: FileNode) => void
  onOpenFile: (node: FileNode) => void
  onOpenPinned: (node: FileNode) => void
  onNodeAction: (node: FileNode, action: NodeAction) => void
  onBlankAction: (kind: 'file' | 'folder') => void
  onMoveFile: (oldPath: string, targetDir: string) => void
  onDropTab: (path: string, index: number) => void
  onTabDragOver: (index: number | null) => void
  onDraftCommit: (name: string) => void
  onDraftCancel: () => void
}

function safeElementFromPoint(x: number, y: number): Element | null {
  try {
    if (typeof document.elementFromPoint !== 'function') return null
    return document.elementFromPoint(x, y)
  } catch {
    return null
  }
}

function tabCenters(tabbar: Element): number[] {
  return Array.from(tabbar.querySelectorAll('[role="tab"]')).map((tab) => {
    const rect = tab.getBoundingClientRect()
    return rect.left + rect.width / 2
  })
}

function ExplorerTree({
  nodes,
  currentDir,
  expanded,
  activePath,
  draft,
  onToggleDir,
  onOpenFile,
  onOpenPinned,
  onNodeAction,
  onBlankAction,
  onMoveFile,
  onDropTab,
  onTabDragOver,
  onDraftCommit,
  onDraftCancel,
}: ExplorerTreeProps) {
  const { t } = useTranslation()
  const [drag, setDrag] = useState<{
    path: string
    name: string
    isDir: boolean
    x: number
    y: number
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const gestureRef = useRef<{
    path: string
    name: string
    isDir: boolean
    startX: number
    startY: number
    active: boolean
    lastTabIndex: number | null
  } | null>(null)
  const suppressClick = useRef(false)

  function claimClick(): boolean {
    if (suppressClick.current) {
      suppressClick.current = false
      return true
    }
    return false
  }

  function moveGhost(x: number, y: number): void {
    const ghost = ghostRef.current
    if (ghost) ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`
  }

  function onPointerDownRow(e: React.PointerEvent, node: FileNode): void {
    // A fresh press is a fresh intent: never let a previous drag eat it.
    suppressClick.current = false
    if (e.button !== 0) return
    if (e.pointerType && e.pointerType !== 'mouse') return
    gestureRef.current = {
      path: node.path,
      name: node.name,
      isDir: node.isDir,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      lastTabIndex: null,
    }
    // Window-level tracking: releases anywhere (other panel, tab bar,
    // off-window) must still settle the gesture. Never strand a ghost.
    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerCancel)
  }

  function detachWindowGesture(): void {
    window.removeEventListener('pointermove', onWindowPointerMove)
    window.removeEventListener('pointerup', onWindowPointerUp)
    window.removeEventListener('pointercancel', onWindowPointerCancel)
  }

  useEffect(() => detachWindowGesture, [])

  function onWindowPointerMove(e: PointerEvent): void {
    const g = gestureRef.current
    if (!g) return
    if (!g.active) {
      if (
        Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD
      ) {
        return
      }
      g.active = true
      suppressClick.current = true
      setDrag({ path: g.path, name: g.name, isDir: g.isDir, x: e.clientX, y: e.clientY })
    }
    moveGhost(e.clientX, e.clientY)
    const hit = safeElementFromPoint(e.clientX, e.clientY)
    const dirElement = hit?.closest?.('[data-drop-dir]') as HTMLElement | null
    const tabbar = hit?.closest?.('[data-tabbar]')
    if (tabbar) {
      const index = insertionIndex(e.clientX, tabCenters(tabbar))
      if (index !== g.lastTabIndex) {
        g.lastTabIndex = index
        onTabDragOver(index)
      }
      setDropTarget(null)
      return
    }
    if (g.lastTabIndex !== null) {
      g.lastTabIndex = null
      onTabDragOver(null)
    }
    const dir = dirElement?.dataset.dropDir ?? null
    setDropTarget((prev) => (prev === dir ? prev : dir))
  }

  function endGestureAt(clientX: number, clientY: number): void {
    const g = gestureRef.current
    gestureRef.current = null
    detachWindowGesture()
    if (!g || !g.active) return
    setDrag(null)
    setDropTarget(null)
    onTabDragOver(null)
    const hit = safeElementFromPoint(clientX, clientY)
    const tabbar = hit?.closest?.('[data-tabbar]')
    if (tabbar) {
      onDropTab(g.path, insertionIndex(clientX, tabCenters(tabbar)))
      return
    }
    const dirElement = hit?.closest?.('[data-drop-dir]') as HTMLElement | null
    const dir = dirElement?.dataset.dropDir
    if (dir) onMoveFile(g.path, dir)
  }

  function onWindowPointerUp(e: PointerEvent): void {
    endGestureAt(e.clientX, e.clientY)
  }

  function onWindowPointerCancel(): void {
    const g = gestureRef.current
    gestureRef.current = null
    detachWindowGesture()
    if (!g || !g.active) return
    setDrag(null)
    setDropTarget(null)
    onTabDragOver(null)
  }

  function renderNodes(list: FileNode[], depth: number) {
    return list.map((node) => (
      <div key={node.path}>
        <Row
          node={node}
          depth={depth}
          expanded={expanded.has(node.path)}
          active={activePath === node.path}
          highlighted={dropTarget === node.path}
          draft={draft}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
          onOpenPinned={onOpenPinned}
          onNodeAction={onNodeAction}
          onPointerDownRow={onPointerDownRow}
          claimClick={claimClick}
          onDraftCommit={onDraftCommit}
          onDraftCancel={onDraftCancel}
        />
        {node.isDir ? (
          <div
            data-expand={node.path}
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              expanded.has(node.path) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              {node.children?.length
                ? renderNodes(node.children, depth + 1)
                : node.children && node.children.length === 0 ? (
                  <p
                    className="truncate text-[11px] text-muted-foreground"
                    style={{ paddingLeft: (depth + 1) * 12 + 8 }}
                  >
                    {t('explorer.emptyFolder')}
                  </p>
                ) : null}
              {draft &&
              (draft.mode === 'create-file' || draft.mode === 'create-dir') &&
              draft.dir === node.path ? (
                <div style={{ paddingLeft: (depth + 1) * 12 + 8 }}>
                  <DraftInput
                    initial={draft.initial}
                    confirmLabel={t('explorer.create')}
                    onCommit={onDraftCommit}
                    onCancel={onDraftCancel}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    ))
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="flex min-h-0 flex-1 flex-col select-none"
        data-drop-dir={currentDir}
      >
        <div className="flex-1 overflow-y-auto py-1">
          {nodes.length === 0 ? (
            <p className="px-3 py-1 text-xs text-muted-foreground">
              {t('explorer.emptyFolder')}
            </p>
          ) : (
            renderNodes(nodes, 0)
          )}
          {draft &&
          (draft.mode === 'create-file' || draft.mode === 'create-dir') &&
          draft.dir === currentDir ? (
            <DraftInput
              initial={draft.initial}
              confirmLabel={t('explorer.create')}
              onCommit={onDraftCommit}
              onCancel={onDraftCancel}
            />
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuItem onClick={() => onBlankAction('file')}>
            {t('explorer.newFile')}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onBlankAction('folder')}>
            {t('explorer.newFolder')}
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
      {drag ? (
        <div
          ref={ghostRef}
          aria-hidden
          style={{ transform: `translate(${drag.x + 12}px, ${drag.y + 12}px)` }}
          className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-48 items-center gap-1.5 rounded-md border bg-popover px-2 py-1 text-xs shadow-lg"
        >
          <NodeIcon
            node={{ path: drag.path, name: drag.name, isDir: drag.isDir }}
            open={false}
          />
          <span className="truncate">{drag.name}</span>
        </div>
      ) : null}
    </ContextMenu>
  )
}

export default ExplorerTree
