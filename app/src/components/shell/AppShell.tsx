import { Fragment, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Bot,
  Calculator,
  ChevronsLeft,
  ChevronsRight,
  FileCode2,
  Globe,
  LogOut,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import type { Account } from '@/lib/auth'
import { DRAG_THRESHOLD, safeElementFromPoint } from '@/lib/dragFile'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppMenubar from './AppMenubar'
import EditorPanel from './EditorPanel'
import TerminalPanel from '../terminal/TerminalPanel'
import CalculatorView from '../calculator/CalculatorView'
import ChatView from '../chat/ChatView'
import SearchView from '../search/SearchView'
import EditorView from '../editor/EditorView'
import SettingsView from '../settings/SettingsView'

export type FunctionId =
  | 'editor'
  | 'calculator'
  | 'research'
  | 'chatbot'
  | 'settings'

const FUNCTIONS: { id: FunctionId; icon: LucideIcon }[] = [
  { id: 'editor', icon: FileCode2 },
  { id: 'calculator', icon: Calculator },
  { id: 'research', icon: Globe },
  { id: 'chatbot', icon: Bot },
  { id: 'settings', icon: Settings },
]

const PANEL_MIN = 180
const PANEL_MAX = 480

/** Function tabs that can dock on the right (the editor stays put). */
const DOCKABLE: FunctionId[] = ['calculator', 'research', 'chatbot']

const TRIO: FunctionId[] = ['calculator', 'research', 'chatbot']

interface TabsState {
  open: FunctionId[]
  active: FunctionId | null
}

interface AppShellProps {
  account: Account | null
  onLogout: () => void
}

function AppShell({ account, onLogout }: AppShellProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<FunctionId | null>('editor')
  const [tabs, setTabs] = useState<TabsState>({ open: [], active: null })
  const [rightDock, setRightDock] = useState<FunctionId[]>([])
  const [draggingTab, setDraggingTab] = useState(false)
  const [tabGhost, setTabGhost] = useState<{
    id: FunctionId
    x: number
    y: number
  } | null>(null)
  const tabGestureRef = useRef<{
    id: FunctionId
    startX: number
    startY: number
    active: boolean
  } | null>(null)
  const [mainHost, setMainHost] = useState<HTMLDivElement | null>(null)
  const [funcRightHost, setFuncRightHost] = useState<HTMLDivElement | null>(null)
  const [panelWidth, setPanelWidth] = useState(240)
  const [panelOpen, setPanelOpen] = useState(true)
  const [resizing, setResizing] = useState(false)
  const [termOpen, setTermOpen] = useState(false)
  const [termRightCount, setTermRightCount] = useState(0)
  const [draggingTerm, setDraggingTerm] = useState(false)
  const [resizingRight, setResizingRight] = useState(false)
  const [termRightWidth, setTermRightWidth] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem('stdhub.terminal-right-width')
      const parsed = raw ? Number.parseInt(raw, 10) : NaN
      if (Number.isFinite(parsed)) return Math.min(720, Math.max(240, parsed))
    } catch {
      // Storage unavailable — fall back to the default width.
    }
    return 384
  })
  const [bottomHost, setBottomHost] = useState<HTMLDivElement | null>(null)
  const [rightHost, setRightHost] = useState<HTMLDivElement | null>(null)
  const [explorerHost, setExplorerHost] = useState<HTMLDivElement | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  const rightDragRef = useRef<{
    startX: number
    startW: number
    latest: number
  } | null>(null)

  // Mirror the terminal panel's state so the shell lays out its bottom
  // and right-hand docks (and the right drop strip while dragging).
  useEffect(() => {
    function onTermVisibility(e: Event): void {
      const detail = (e as CustomEvent<{ open?: unknown; rightCount?: unknown }>).detail
      if (typeof detail?.open === 'boolean') setTermOpen(detail.open)
      if (typeof detail?.rightCount === 'number')
        setTermRightCount(detail.rightCount)
    }
    function onTermDrag(e: Event): void {
      const detail = (e as CustomEvent<{ dragging?: unknown }>).detail
      setDraggingTerm(detail?.dragging === true)
    }
    window.addEventListener('stdhub:terminal-visibility', onTermVisibility)
    window.addEventListener('stdhub:terminal-drag', onTermDrag)
    return () => {
      window.removeEventListener('stdhub:terminal-visibility', onTermVisibility)
      window.removeEventListener('stdhub:terminal-drag', onTermDrag)
    }
  }, [])

  function onRightHandleDown(e: ReactMouseEvent): void {
    if (e.button !== 0) return
    rightDragRef.current = {
      startX: e.clientX,
      startW: termRightWidth,
      latest: termRightWidth,
    }
    setResizingRight(true)
    const onMove = (ev: MouseEvent): void => {
      const drag = rightDragRef.current
      if (!drag) return
      const w = Math.min(
        720,
        Math.max(240, drag.startW + (drag.startX - ev.clientX)),
      )
      drag.latest = w
      setTermRightWidth(w)
    }
    const onUp = (): void => {
      const latest = rightDragRef.current?.latest
      rightDragRef.current = null
      setResizingRight(false)
      if (latest != null) {
        try {
          window.localStorage.setItem(
            'stdhub.terminal-right-width',
            String(latest),
          )
        } catch {
          // Storage unavailable — width still applies this session.
        }
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function nameOf(id: FunctionId): string {
    return t(`shell.${id}`)
  }

  function openTab(id: FunctionId): void {
    setSelected(id)
    setTabs((prev) => ({
      open: prev.open.includes(id) ? prev.open : [...prev.open, id],
      active: id,
    }))
  }

  function selectOnly(id: FunctionId): void {
    setSelected(id)
    setTabs((prev) => ({
      ...prev,
      active: prev.open.includes(id) ? id : prev.active,
    }))
  }

  function dockTab(id: FunctionId): void {
    if (!DOCKABLE.includes(id) || rightDock.includes(id)) return
    setRightDock((prev) => [...prev, id])
  }

  function undockTab(id: FunctionId): void {
    if (!rightDock.includes(id)) return
    setRightDock((prev) => prev.filter((tab) => tab !== id))
    setTabs((prev) => ({
      ...prev,
      active: id,
    }))
  }

  function closeTab(id: FunctionId): void {
    setTabs((prev) => {
      const open = prev.open.filter((tab) => tab !== id)
      return {
        open,
        active:
          prev.active === id ? (open[open.length - 1] ?? null) : prev.active,
      }
    })
    setRightDock((prev) => prev.filter((tab) => tab !== id))
    // Selection (sidebar + panel) is deliberately untouched: closing a tab
    // never closes the explorer. Selection only changes on explicit clicks.
    if (id === 'editor' && tabs.open.includes('editor')) {
      window.dispatchEvent(new CustomEvent('stdhub:editor-closed'))
    }
  }

  function openFolderFromMenu(): void {
    window.dispatchEvent(new CustomEvent('stdhub:open-folder'))
  }

  function openFolderFromPanel(): void {
    window.dispatchEvent(new CustomEvent('stdhub:open-folder'))
  }

  function closeOthers(id: FunctionId): void {
    if (id !== 'editor' && tabs.open.includes('editor')) {
      window.dispatchEvent(new CustomEvent('stdhub:editor-closed'))
    }
    setRightDock((prev) => prev.filter((tab) => tab === id))
    setTabs({ open: [id], active: id })
  }

  function moveTab(id: FunctionId, dir: -1 | 1): void {
    setTabs((prev) => {
      const at = prev.open.indexOf(id)
      const to = at + dir
      if (at < 0 || to < 0 || to >= prev.open.length) return prev
      const open = [...prev.open]
      open[at] = prev.open[to]
      open[to] = id
      return { ...prev, open }
    })
  }

  function functionView(id: FunctionId) {
    switch (id) {
      case 'calculator':
        return <CalculatorView />
      case 'research':
        return <SearchView />
      case 'chatbot':
        return <ChatView />
      default:
        return null
    }
  }

  function onDragHandleDown(e: ReactMouseEvent): void {
    dragRef.current = { startX: e.clientX, startW: panelWidth }
    setResizing(true)
    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      const w = drag.startW + (ev.clientX - drag.startX)
      setPanelWidth(Math.max(PANEL_MIN, Math.min(PANEL_MAX, w)))
    }
    const onUp = (): void => {
      dragRef.current = null
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const activePanel = tabs.active && tabs.open.includes(tabs.active) ? tabs.active : null
  const mainTabs = tabs.open.filter((id) => !rightDock.includes(id))
  // The dock shows the active tab when docked, else its most recent one —
  // each side keeps its own visible tab, like VSCode groups.
  const dockActive =
    activePanel && rightDock.includes(activePanel)
      ? activePanel
      : (rightDock[rightDock.length - 1] ?? null)
  // Main content follows the active tab while it lives in the main area;
  // focusing a docked tab leaves the last main tab visible instead.
  const mainVisible =
    activePanel && TRIO.includes(activePanel) && !rightDock.includes(activePanel)
      ? activePanel
      : null
  const showEditor = activePanel === 'editor'
  const showDockHint =
    activePanel !== null && !showEditor && mainVisible === null && rightDock.includes(activePanel)

  function activateDocked(id: FunctionId): void {
    setTabs((prev) => ({ ...prev, active: id }))
  }

  // Pointer-based tab drag (same pattern as explorer/terminal tabs):
  // drop over the right dock to pin it there, over the main tab bar to
  // bring it back. The editor is not dockable.
  function onTabPointerDown(e: ReactPointerEvent, id: FunctionId): void {
    if (e.button !== 0 || !DOCKABLE.includes(id)) return
    tabGestureRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    }
    window.addEventListener('pointermove', onTabPointerMove)
    window.addEventListener('pointerup', onTabPointerUp)
    window.addEventListener('pointercancel', onTabPointerCancel)
  }

  function detachTabGesture(): void {
    window.removeEventListener('pointermove', onTabPointerMove)
    window.removeEventListener('pointerup', onTabPointerUp)
    window.removeEventListener('pointercancel', onTabPointerCancel)
  }

  function onTabPointerMove(e: PointerEvent): void {
    const gesture = tabGestureRef.current
    if (!gesture) return
    if (!gesture.active) {
      if (
        Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) <
        DRAG_THRESHOLD
      ) {
        return
      }
      gesture.active = true
      setDraggingTab(true)
      setTabGhost({ id: gesture.id, x: e.clientX, y: e.clientY })
    } else {
      setTabGhost((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : prev,
      )
    }
  }

  function endTabGestureAt(clientX: number, clientY: number): void {
    const gesture = tabGestureRef.current
    tabGestureRef.current = null
    detachTabGesture()
    setDraggingTab(false)
    setTabGhost(null)
    if (!gesture || !gesture.active) return
    const hit = safeElementFromPoint(clientX, clientY)
    if (hit?.closest?.('[data-testid="function-right-slot"]')) {
      dockTab(gesture.id)
      return
    }
    if (hit?.closest?.('[data-testid="shell-tabs"]')) {
      undockTab(gesture.id)
    }
  }

  function onTabPointerUp(e: PointerEvent): void {
    endTabGestureAt(e.clientX, e.clientY)
  }

  function onTabPointerCancel(): void {
    tabGestureRef.current = null
    detachTabGesture()
    setDraggingTab(false)
    setTabGhost(null)
  }

  return (
    <TooltipProvider delay={2000}>
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-svh w-full flex-col">
        <AppMenubar
          onOpenTab={openTab}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenFolder={openFolderFromMenu}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          panelOpen={panelOpen}
          onLogout={onLogout}
        />
        <div className="flex min-h-0 flex-1">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {FUNCTIONS.map(({ id, icon: Icon }) => (
                    <SidebarMenuItem key={id}>
                      <ContextMenu>
                        <ContextMenuTrigger>
                          <SidebarMenuButton
                            isActive={selected === id}
                            onClick={() => {
                              // Settings only opens its modal — never
                              // selects, never tabs. Anything else opens
                              // (or focuses) its tab on click.
                              if (id === 'settings') {
                                setSettingsOpen(true)
                                return
                              }
                              openTab(id)
                            }}
                            tooltip={nameOf(id)}
                          >
                            <Icon aria-hidden />
                            <span>{nameOf(id)}</span>
                          </SidebarMenuButton>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuGroup>
                            <ContextMenuItem
                              onClick={() => {
                                if (id === 'settings') setSettingsOpen(true)
                                else openTab(id)
                              }}
                            >
                              {t('shell.openTab')}
                            </ContextMenuItem>
                          </ContextMenuGroup>
                        </ContextMenuContent>
                      </ContextMenu>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            {account?.email ? (
              <p className="truncate px-2 text-xs text-muted-foreground">
                {account.email}
              </p>
            ) : null}
            <p className="px-2 text-[10px] text-muted-foreground/60">
              build{' '}
              {typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev'}
            </p>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onLogout}>
                  <LogOut aria-hidden />
                  <span>{t('platform.logout')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {selected === 'editor' ? (
        <div
          className={`flex shrink-0 overflow-hidden border-r ${
            resizing ? '' : 'transition-[width] duration-200 ease-out'
          }`}
          style={{ width: panelOpen ? panelWidth : 0 }}
          aria-label={t('shell.panelTitle', { name: nameOf(selected) })}
        >
          <div
            className="flex shrink-0 flex-col gap-1 overflow-hidden p-3"
            style={{ width: panelWidth - 4 }}
          >
            <EditorPanel
              hostRef={setExplorerHost}
              onOpenFolder={openFolderFromPanel}
            />
            <div className="mt-auto flex justify-end">
              <button
                type="button"
                aria-label={t('shell.collapsePanel')}
                onClick={() => setPanelOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronsLeft className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('shell.resizePanel')}
            onMouseDown={onDragHandleDown}
            className="w-1 shrink-0 cursor-col-resize hover:bg-accent"
          />
        </div>
        ) : null}
        {selected === 'editor' && !panelOpen ? (
          <div className="flex shrink-0 flex-col justify-end border-r p-2">
            <button
              type="button"
              aria-label={t('shell.expandPanel')}
              onClick={() => setPanelOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronsRight className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b px-2">
            <SidebarTrigger />
            <div
              role="tablist"
              aria-label="STDHub"
              data-testid="shell-tabs"
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5"
            >
              {mainTabs.map((id) => (
                <div
                  key={id}
                  role="tab"
                  aria-selected={tabs.active === id}
                  className="animate-in fade-in slide-in-from-left-1 duration-200"
                  onPointerDown={(e) => onTabPointerDown(e, id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault()
                      closeTab(id)
                    }
                  }}
                >
                  <ContextMenu>
                    <ContextMenuTrigger className="flex items-center rounded-md">
                      <button
                        type="button"
                        onClick={() => selectOnly(id)}
                        className={
                          tabs.active === id
                            ? 'rounded-l-md bg-muted px-3 py-1.5 text-xs font-medium'
                            : 'rounded-l-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground'
                        }
                      >
                        {nameOf(id)}
                      </button>
                      <button
                        type="button"
                        aria-label={t('shell.close', { name: nameOf(id) })}
                        onClick={() => closeTab(id)}
                        className="rounded-r-md px-1.5 py-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuGroup>
                        <ContextMenuItem onClick={() => closeTab(id)}>
                          {t('shell.close', { name: nameOf(id) })}
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => closeOthers(id)}>
                          {t('shell.closeOthers')}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => moveTab(id, -1)}>
                          {t('shell.moveLeft')}
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => moveTab(id, 1)}>
                          {t('shell.moveRight')}
                        </ContextMenuItem>
                        {DOCKABLE.includes(id) ? (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => dockTab(id)}>
                              {t('shell.dockRight')}
                            </ContextMenuItem>
                          </>
                        ) : null}
                      </ContextMenuGroup>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              ))}
            </div>
          </div>
          <div
            data-testid="shell-body"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                hidden={!showEditor}
                className="flex min-h-0 flex-1 flex-col"
              >
                <EditorView
                  explorerHost={explorerHost}
                  onOpenFile={() => openTab('editor')}
                />
              </div>
              <div
                ref={setMainHost}
                hidden={mainVisible === null}
                className="flex min-h-0 flex-1 flex-col"
              />
              {!showEditor && mainVisible === null ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {showDockHint ? t('shell.dockedHint') : t('shell.emptyTabs')}
                  </p>
                </div>
              ) : null}
            </div>
            <div
              data-testid="function-right-slot"
              style={{
                width:
                  rightDock.length > 0 ? 360 : draggingTab ? 96 : 0,
              }}
              className={`relative flex shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out ${
                draggingTab && rightDock.length === 0
                  ? 'border-l-2 border-dashed border-primary/60 bg-primary/5'
                  : ''
              }`}
            >
              {rightDock.length > 0 ? (
                <div className="flex items-center gap-1 border-b px-2">
                  <div
                    role="tablist"
                    aria-label={t('shell.rightDockTitle')}
                    className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5"
                  >
                    {rightDock.map((id) => (
                      <div
                        key={id}
                        role="tab"
                        aria-selected={dockActive === id}
                      >
                        <ContextMenu>
                          <ContextMenuTrigger className="flex items-center rounded-md">
                            <button
                              type="button"
                              onClick={() => activateDocked(id)}
                              className={
                                dockActive === id
                                  ? 'rounded-l-md bg-muted px-3 py-1.5 text-xs font-medium'
                                  : 'rounded-l-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground'
                              }
                            >
                              {nameOf(id)}
                            </button>
                            <button
                              type="button"
                              aria-label={t('shell.close', { name: nameOf(id) })}
                              onClick={() => closeTab(id)}
                              className="rounded-r-md px-1.5 py-1.5 text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3.5" aria-hidden />
                            </button>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuGroup>
                              <ContextMenuItem onClick={() => closeTab(id)}>
                                {t('shell.close', { name: nameOf(id) })}
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => undockTab(id)}>
                                {t('shell.undock')}
                              </ContextMenuItem>
                            </ContextMenuGroup>
                          </ContextMenuContent>
                        </ContextMenu>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div ref={setFuncRightHost} className="min-h-0 flex-1" />
            </div>
              <div
                data-testid="terminal-right-slot"
                ref={setRightHost}
                style={{
                  // The right sidebar is independent: it stays while it has
                  // tabs, even with the bottom panel closed.
                  width:
                    termRightCount > 0
                      ? termRightWidth
                      : draggingTerm
                        ? 96
                        : 0,
                }}
                className={`relative shrink-0 overflow-hidden ${
                  resizingRight ? '' : 'transition-[width] duration-200 ease-out'
                } ${
                  draggingTerm && termRightCount === 0
                    ? 'border-l-2 border-dashed border-primary/60 bg-primary/5'
                    : ''
                }`}
              >
                {termOpen && termRightCount > 0 ? (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t('shell.resizePanel')}
                    data-testid="terminal-right-resize"
                    onMouseDown={onRightHandleDown}
                    className="absolute top-0 bottom-0 left-0 z-10 w-1.5 cursor-col-resize hover:bg-accent"
                  />
                ) : null}
              </div>
            </div>
            <div
              data-testid="terminal-bottom-slot"
              ref={setBottomHost}
              className={`grid shrink-0 transition-[grid-template-rows] duration-300 ease-out ${
                termOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            />
          </div>
          {/* Function views stay mounted here and portal into the main or
              right dock — moving a tab never loses its state. */}
          {tabs.open
            .filter((id) => TRIO.includes(id))
            .map((id) => {
              const docked = rightDock.includes(id)
              const host = docked ? funcRightHost : mainHost
              if (!host) return null
              const visible = docked ? dockActive === id : mainVisible === id
              return (
                <Fragment key={id}>
                  {createPortal(
                    <div
                      hidden={!visible}
                      className={
                        docked
                          ? 'flex h-full min-h-0 flex-col'
                          : 'flex min-h-0 flex-1 flex-col'
                      }
                    >
                      {functionView(id)}
                    </div>,
                    host,
                  )}
                </Fragment>
              )
            })}
          {tabGhost ? (
            <div
              aria-hidden
              style={{
                transform: `translate(${tabGhost.x + 12}px, ${tabGhost.y + 12}px)`,
              }}
              className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-48 items-center gap-1.5 rounded-md border bg-popover px-2 py-1 text-xs shadow-lg"
            >
              <span className="truncate">{nameOf(tabGhost.id)}</span>
            </div>
          ) : null}
          <TerminalPanel bottomHost={bottomHost} rightHost={rightHost} />
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('shell.settings')}</DialogTitle>
              </DialogHeader>
              <SettingsView />
            </DialogContent>
          </Dialog>
        </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
    </TooltipProvider>
  )
}

export default AppShell
