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

/** How close (px) the drag cursor must be for a dock slot to light up. */
const DOCK_NEAR_MARGIN = 80

const DOCK_MIN_W = 240
const DOCK_MAX_W = 720
const DOCK_MIN_H = 120
const DOCK_MAX_H = 480

function readDockSize(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? Number.parseInt(raw, 10) : NaN
    if (Number.isFinite(parsed)) return Math.min(max, Math.max(min, parsed))
  } catch {
    // Storage unavailable — fall back to the default size.
  }
  return fallback
}

/** Function tabs that can dock on the right (the editor stays put). */
const DOCKABLE: FunctionId[] = ['calculator', 'research', 'chatbot']

const TRIO: FunctionId[] = ['calculator', 'research', 'chatbot']

type DockSide = 'left' | 'right' | 'bottom'

interface TabsState {
  open: FunctionId[]
  active: FunctionId | null
  /** Dock placement per tab; absent means the tab lives in the main area. */
  dock: Partial<Record<FunctionId, DockSide>>
}

interface AppShellProps {
  account: Account | null
  onLogout: () => void
}

function AppShell({ account, onLogout }: AppShellProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<FunctionId | null>('editor')
  const [tabs, setTabs] = useState<TabsState>({ open: [], active: null, dock: {} })
  // Last tab that lived in the main area: focusing a docked tab keeps the
  // center on this instead of wiping it (e.g. the Notebook stays put).
  const [lastMain, setLastMain] = useState<FunctionId | null>(null)
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
  const [funcLeftHost, setFuncLeftHost] = useState<HTMLDivElement | null>(null)
  const [funcBottomHost, setFuncBottomHost] = useState<HTMLDivElement | null>(null)
  // Slot frames for proximity: drop hints only light up while the drag
  // cursor is near, and near-drops land even on a collapsed (0-size) slot.
  const leftSlotRef = useRef<HTMLDivElement | null>(null)
  const rightSlotRef = useRef<HTMLDivElement | null>(null)
  const bottomDockRef = useRef<HTMLDivElement | null>(null)
  const [dockLeftWidth, setDockLeftWidth] = useState(() =>
    readDockSize('stdhub.dock-left-width', 360, DOCK_MIN_W, DOCK_MAX_W),
  )
  const [dockRightWidth, setDockRightWidth] = useState(() =>
    readDockSize('stdhub.dock-right-width', 360, DOCK_MIN_W, DOCK_MAX_W),
  )
  const [dockBottomHeight, setDockBottomHeight] = useState(() =>
    readDockSize('stdhub.dock-bottom-height', 224, DOCK_MIN_H, DOCK_MAX_H),
  )
  const [resizingDock, setResizingDock] = useState<
    null | 'left' | 'right' | 'bottom'
  >(null)
  const dockDragRef = useRef<{
    side: 'left' | 'right' | 'bottom'
    latest: number
  } | null>(null)
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

  // Function dock resize (same pattern as the terminal right dock and the
  // explorer panel): sides grow toward the center, the bottom dock upward.
  function onDockResizeDown(side: 'left' | 'right' | 'bottom') {
    return (e: ReactMouseEvent): void => {
      if (e.button !== 0) return
      const startX = e.clientX
      const startY = e.clientY
      const startW = side === 'left' ? dockLeftWidth : dockRightWidth
      const startH = dockBottomHeight
      const storageKey =
        side === 'left'
          ? 'stdhub.dock-left-width'
          : side === 'right'
            ? 'stdhub.dock-right-width'
            : 'stdhub.dock-bottom-height'
      setResizingDock(side)
      dockDragRef.current = {
        side,
        latest: side === 'bottom' ? startH : startW,
      }
      const onMove = (ev: MouseEvent): void => {
        let next = dockDragRef.current?.latest ?? 0
        if (side === 'left') {
          next = Math.min(
            DOCK_MAX_W,
            Math.max(DOCK_MIN_W, startW + (ev.clientX - startX)),
          )
          setDockLeftWidth(next)
        } else if (side === 'right') {
          next = Math.min(
            DOCK_MAX_W,
            Math.max(DOCK_MIN_W, startW + (startX - ev.clientX)),
          )
          setDockRightWidth(next)
        } else {
          next = Math.min(
            DOCK_MAX_H,
            Math.max(DOCK_MIN_H, startH + (startY - ev.clientY)),
          )
          setDockBottomHeight(next)
        }
        if (dockDragRef.current) dockDragRef.current.latest = next
      }
      const onUp = (): void => {
        const latest = dockDragRef.current?.latest
        dockDragRef.current = null
        setResizingDock(null)
        if (latest != null) {
          try {
            window.localStorage.setItem(storageKey, String(latest))
          } catch {
            // Storage unavailable — size still applies this session.
          }
        }
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
  }

  function nameOf(id: FunctionId): string {
    return t(`shell.${id}`)
  }

  function openTab(id: FunctionId): void {
    setSelected(id)
    setTabs((prev) => ({
      ...prev,
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

  function dockTab(id: FunctionId, side: DockSide = 'right'): void {
    if (!DOCKABLE.includes(id) || tabs.dock[id] === side) return
    if (tabs.active === id) {
      // Docking the tab under the cursor must not strand the center on it:
      // fall back to the most recently opened tab still in the main area.
      const fallback =
        [...tabs.open]
          .reverse()
          .find((t) => t !== id && tabs.dock[t] == null) ?? null
      setLastMain(fallback)
    }
    setTabs((prev) =>
      prev.dock[id] === side
        ? prev
        : { ...prev, dock: { ...prev.dock, [id]: side } },
    )
  }

  function undockTab(id: FunctionId): void {
    setTabs((prev) => {
      if (!(id in prev.dock)) return prev
      const dock = { ...prev.dock }
      delete dock[id]
      return { ...prev, dock, active: id }
    })
  }

  function closeTab(id: FunctionId): void {
    setTabs((prev) => {
      const open = prev.open.filter((tab) => tab !== id)
      const dock = { ...prev.dock }
      delete dock[id]
      return {
        open,
        dock,
        active:
          prev.active === id ? (open[open.length - 1] ?? null) : prev.active,
      }
    })
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
    setTabs((prev) => {
      const kept = prev.dock[id]
      return {
        open: [id],
        active: id,
        dock: kept ? { [id]: kept } : {},
      }
    })
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
  const mainTabs = tabs.open.filter((id) => tabs.dock[id] == null)
  const dockedTabs = (side: DockSide): FunctionId[] =>
    tabs.open.filter((id) => tabs.dock[id] === side)
  const rightDockTabs = dockedTabs('right')
  const leftDockTabs = dockedTabs('left')
  const bottomDockTabs = dockedTabs('bottom')
  // Each dock group shows the active tab when docked there, else its most
  // recent one — every side keeps its own visible tab, like VSCode groups.
  function dockActive(side: DockSide): FunctionId | null {
    const list = dockedTabs(side)
    if (list.length === 0) return null
    return activePanel != null && tabs.dock[activePanel] === side
      ? activePanel
      : list[list.length - 1]
  }
  // Main content follows the active tab while it lives in the main area;
  // focusing a docked tab falls back to the last main tab instead of
  // blanking the center (the Notebook never vanishes on a dock click).
  const lastMainValid =
    lastMain != null &&
    tabs.open.includes(lastMain) &&
    tabs.dock[lastMain] == null
      ? lastMain
      : null
  const mainVisible =
    activePanel && TRIO.includes(activePanel) && tabs.dock[activePanel] == null
      ? activePanel
      : lastMainValid && TRIO.includes(lastMainValid)
        ? lastMainValid
        : null
  const showEditor =
    activePanel === 'editor' ||
    ((activePanel == null || tabs.dock[activePanel] != null) &&
      lastMainValid === 'editor')
  const showDockHint =
    activePanel !== null &&
    !showEditor &&
    mainVisible === null &&
    tabs.dock[activePanel] != null

  useEffect(() => {
    if (activePanel && tabs.dock[activePanel] == null) {
      setLastMain(activePanel)
    }
  }, [activePanel, tabs.dock])

  function activateDocked(id: FunctionId): void {
    setTabs((prev) => ({ ...prev, active: id }))
  }

  // Drop hints stay hidden until the drag cursor comes near a slot, so an
  // empty side never flashes open while dragging across the window.
  const nearRight =
    draggingTab && tabGhost
      ? slotIsNear(rightSlotRef.current, tabGhost.x, tabGhost.y)
      : false
  const nearLeft =
    draggingTab && tabGhost
      ? slotIsNear(leftSlotRef.current, tabGhost.x, tabGhost.y)
      : false
  const nearBottom =
    draggingTab && tabGhost
      ? slotIsNear(bottomDockRef.current, tabGhost.x, tabGhost.y)
      : false

  // Pointer-based tab drag (same pattern as explorer/terminal tabs):
  // drop over a dock slot to pin it there, over the main tab bar to
  // bring it back. Dragging starts from the main bar AND from inside a
  // dock, so tabs move directly between sides. The editor is not dockable.
  function slotIsNear(
    el: HTMLDivElement | null,
    clientX: number,
    clientY: number,
  ): boolean {
    if (!el) return false
    const rect = el.getBoundingClientRect()
    return (
      clientX >= rect.left - DOCK_NEAR_MARGIN &&
      clientX <= rect.right + DOCK_NEAR_MARGIN &&
      clientY >= rect.top - DOCK_NEAR_MARGIN &&
      clientY <= rect.bottom + DOCK_NEAR_MARGIN
    )
  }
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
      dockTab(gesture.id, 'right')
      return
    }
    if (hit?.closest?.('[data-testid="function-left-slot"]')) {
      dockTab(gesture.id, 'left')
      return
    }
    if (hit?.closest?.('[data-testid="function-bottom-dock"]')) {
      dockTab(gesture.id, 'bottom')
      return
    }
    if (hit?.closest?.('[data-testid="shell-tabs"]')) {
      undockTab(gesture.id)
      return
    }
    // Near miss: the pointer landed next to a collapsed slot (which has no
    // area to hit-test against), so proximity decides the drop target.
    if (slotIsNear(rightSlotRef.current, clientX, clientY)) {
      dockTab(gesture.id, 'right')
      return
    }
    if (slotIsNear(leftSlotRef.current, clientX, clientY)) {
      dockTab(gesture.id, 'left')
      return
    }
    if (slotIsNear(bottomDockRef.current, clientX, clientY)) {
      dockTab(gesture.id, 'bottom')
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

  // Shared tab strip for the three function dock groups (left, right,
  // bottom): same behavior, only the placement differs.
  function renderDockTabs(side: DockSide) {
    const list = dockedTabs(side)
    const active = dockActive(side)
    return (
      <div className="flex items-center gap-1 border-b px-2">
        <div
          role="tablist"
          aria-label={t('shell.rightDockTitle')}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5"
        >
          {list.map((id) => (
            <div
              key={id}
              role="tab"
              aria-selected={active === id}
              onPointerDown={(e) => onTabPointerDown(e, id)}
            >
              <ContextMenu>
                <ContextMenuTrigger className="flex items-center rounded-md">
                  <button
                    type="button"
                    onClick={() => activateDocked(id)}
                    className={
                      active === id
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
    )
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
                            <ContextMenuItem onClick={() => dockTab(id, 'right')}>
                              {t('shell.dockRight')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => dockTab(id, 'bottom')}>
                              {t('shell.dockBottom')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => dockTab(id, 'left')}>
                              {t('shell.dockLeft')}
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
            {/* Function left dock: right after the explorer panel (or in its
                place when the panel is hidden), before the main content. */}
            <div
              data-testid="function-left-slot"
              ref={leftSlotRef}
              style={{
                width:
                  leftDockTabs.length > 0
                    ? dockLeftWidth
                    : draggingTab && nearLeft
                      ? 96
                      : 0,
              }}
              className={`relative flex shrink-0 flex-col overflow-hidden ${
                resizingDock === 'left'
                  ? ''
                  : 'transition-[width] duration-200 ease-out'
              } ${
                draggingTab && nearLeft
                  ? 'border-r-2 border-dashed border-primary/60 bg-primary/5'
                  : ''
              }`}
            >
              {leftDockTabs.length > 0 ? renderDockTabs('left') : null}
              <div ref={setFuncLeftHost} className="min-h-0 flex-1" />
              {leftDockTabs.length > 0 ? (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t('shell.resizePanel')}
                  data-testid="dock-left-resize"
                  onMouseDown={onDockResizeDown('left')}
                  className="absolute top-0 right-0 bottom-0 z-10 w-1.5 cursor-col-resize hover:bg-accent"
                />
              ) : null}
            </div>
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
              ref={rightSlotRef}
              style={{
                width:
                  rightDockTabs.length > 0
                    ? dockRightWidth
                    : draggingTab && nearRight
                      ? 96
                      : 0,
              }}
              className={`relative flex shrink-0 flex-col overflow-hidden ${
                resizingDock === 'right'
                  ? ''
                  : 'transition-[width] duration-200 ease-out'
              } ${
                draggingTab && nearRight
                  ? 'border-l-2 border-dashed border-primary/60 bg-primary/5'
                  : ''
              }`}
            >
              {rightDockTabs.length > 0 ? renderDockTabs('right') : null}
              <div ref={setFuncRightHost} className="min-h-0 flex-1" />
              {rightDockTabs.length > 0 ? (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t('shell.resizePanel')}
                  data-testid="dock-right-resize"
                  onMouseDown={onDockResizeDown('right')}
                  className="absolute top-0 bottom-0 left-0 z-10 w-1.5 cursor-col-resize hover:bg-accent"
                />
              ) : null}
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
            {/* Function bottom dock: above the terminal panel, same pattern
                as the side slots. Dropping here stacks it over the terminal. */}
            <div
              data-testid="function-bottom-dock"
              ref={bottomDockRef}
              style={
                bottomDockTabs.length > 0
                  ? { height: dockBottomHeight }
                  : undefined
              }
              className={`relative flex shrink-0 flex-col overflow-hidden ${
                resizingDock === 'bottom'
                  ? ''
                  : 'transition-[height] duration-200 ease-out'
              } ${
                bottomDockTabs.length > 0
                  ? 'border-t'
                  : draggingTab && nearBottom
                    ? 'h-16 border-t-2 border-dashed border-primary/60 bg-primary/5'
                    : 'h-0'
              }`}
            >
              {bottomDockTabs.length > 0 ? renderDockTabs('bottom') : null}
              <div ref={setFuncBottomHost} className="min-h-0 flex-1" />
              {bottomDockTabs.length > 0 ? (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label={t('shell.resizePanel')}
                  data-testid="dock-bottom-resize"
                  onMouseDown={onDockResizeDown('bottom')}
                  className="absolute top-0 right-0 left-0 z-10 h-1.5 cursor-row-resize hover:bg-accent"
                />
              ) : null}
            </div>
            <div
              data-testid="terminal-bottom-slot"
              ref={setBottomHost}
              className={`grid shrink-0 transition-[grid-template-rows] duration-300 ease-out ${
                termOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            />
          </div>
          {/* Function views stay mounted here and portal into the main area
              or one of the three docks — moving a tab never loses state. */}
          {tabs.open
            .filter((id) => TRIO.includes(id))
            .map((id) => {
              const side = tabs.dock[id] ?? null
              const host =
                side === 'right'
                  ? funcRightHost
                  : side === 'left'
                    ? funcLeftHost
                    : side === 'bottom'
                      ? funcBottomHost
                      : mainHost
              if (!host) return null
              const visible = side ? dockActive(side) === id : mainVisible === id
              return (
                <Fragment key={id}>
                  {createPortal(
                    <div
                      hidden={!visible}
                      className={
                        side
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
