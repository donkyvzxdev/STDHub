import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import {
  ChevronsDown,
  ExternalLink,
  PanelBottom,
  Plus,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { fsCode } from '@/lib/filesystem'
import { DRAG_THRESHOLD, safeElementFromPoint } from '@/lib/dragFile'
import {
  killTerminal,
  onTerminalExit,
  onTerminalOutput,
  openExternalTerminal,
  resizeTerminal,
  spawnTerminal,
  writeTerminal,
} from '@/lib/pty'

interface TermTab {
  id: string
}

interface TermInstance {
  term: XTerm
  fit: FitAddon
}

interface TerminalPanelProps {
  bottomHost: HTMLElement | null
  rightHost: HTMLElement | null
}

/**
 * Integrated terminal panel (desktop/Tauri only): hidden until revealed,
 * holding multiple PTY terminals in tabs. Each tab runs a fixed shell per
 * OS (PowerShell on Windows, `$SHELL`/`sh` on Unix) rooted at the last
 * opened folder.
 *
 * Tabs live in two groups: bottom (default) and right. Dragging a tab to
 * the shell's right edge (or its context menu) moves just that tab to the
 * right group — VSCode-style, handy for TUIs and AI CLIs next to the code.
 * Moving recreates the xterm view (scrollback resets) but the PTY session
 * itself keeps running, so output keeps flowing.
 */
function TerminalPanel({ bottomHost, rightHost }: TerminalPanelProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [terms, setTerms] = useState<TermTab[]>([])
  const [rightIds, setRightIds] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem('stdhub.terminal-height')
      const parsed = raw ? Number.parseInt(raw, 10) : NaN
      if (Number.isFinite(parsed)) return Math.min(640, Math.max(120, parsed))
    } catch {
      // Storage unavailable — fall back to the default height.
    }
    return 224
  })
  const lastRootRef = useRef<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const counterRef = useRef(0)
  const countRef = useRef(0)
  const instances = useRef(new Map<string, TermInstance>())
  const hosts = useRef(new Map<string, HTMLDivElement>())
  const bottomBodyRef = useRef<HTMLDivElement | null>(null)
  const rightBodyRef = useRef<HTMLDivElement | null>(null)
  const heightDragRef = useRef<{
    startY: number
    startH: number
    latest: number
  } | null>(null)

  function onHeightDragDown(e: ReactMouseEvent): void {
    if (e.button !== 0) return
    heightDragRef.current = {
      startY: e.clientY,
      startH: panelHeight,
      latest: panelHeight,
    }
    const onMove = (ev: MouseEvent): void => {
      const drag = heightDragRef.current
      if (!drag) return
      const max = Math.floor(window.innerHeight * 0.7)
      const h = Math.min(Math.max(120, max), drag.startH + (drag.startY - ev.clientY))
      drag.latest = h
      setPanelHeight(h)
    }
    const onUp = (): void => {
      const latest = heightDragRef.current?.latest
      heightDragRef.current = null
      if (latest != null) {
        try {
          window.localStorage.setItem('stdhub.terminal-height', String(latest))
        } catch {
          // Storage unavailable — height still applies this session.
        }
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const bottomIds = terms
    .map((tab) => tab.id)
    .filter((id) => !rightIds.includes(id))
  const hasRight = rightIds.length > 0

  const newTerminal = useCallback(
    async (group: 'bottom' | 'right' = 'bottom'): Promise<void> => {
      const root = lastRootRef.current
      if (!root) {
        setNotice(t('terminal.noFolder'))
        setOpen(true)
        return
      }
      // Backend ids stay unique forever; the visible number is positional
      // (1..N in opening order) and computed at render time.
      counterRef.current += 1
      const id = `term-${counterRef.current}`
      try {
        await spawnTerminal(id, root, 80, 24)
      } catch (e) {
        // Reveal the panel so the failure is visible instead of silent.
        setNotice(
          fsCode(e) === 'unsupported'
            ? t('explorer.terminalWeb')
            : t('explorer.opFailed'),
        )
        setOpen(true)
        return
      }
      countRef.current += 1
      setTerms((prev) => [...prev, { id }])
      if (group === 'right') {
        setRightIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      }
      setActiveId(id)
      activeIdRef.current = id
      setOpen(true)
      setNotice(null)
    },
    [t],
  )

  // Reveal-only: opens the panel, spawning a first terminal only when none
  // is open. Creating extras stays on each group's + button.
  const showPanel = useCallback((): void => {
    setOpen(true)
    if (countRef.current === 0) void newTerminal('bottom')
  }, [newTerminal])

  // Lets the notebook's floating button hide while the panel is visible,
  // and lets the shell lay out the right-hand dock.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('stdhub:terminal-visibility', {
        detail: { open, rightCount: rightIds.length },
      }),
    )
  }, [open, rightIds])

  function moveTab(id: string, to: 'bottom' | 'right'): void {
    const isRight = rightIds.includes(id)
    const wantsRight = to === 'right'
    if (wantsRight === isRight) return
    // Drop the xterm view bound to the old host; the creation effect builds
    // a fresh one in the new group. The PTY keeps running, so the session
    // (and its output stream) survives the move.
    instances.current.get(id)?.term.dispose()
    instances.current.delete(id)
    hosts.current.delete(id)
    if (to === 'right') {
      setRightIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      // The bottom group's last tab just found its new home on the right:
      // hide the now-empty bottom panel.
      if (bottomIds.length === 1 && bottomIds[0] === id) setOpen(false)
    } else {
      setRightIds((prev) => prev.filter((tabId) => tabId !== id))
    }
    setActiveId(id)
    activeIdRef.current = id
  }

  // The right sidebar is independent: closing it never kills anything, it
  // just moves every tab back to the bottom group.
  function moveAllBack(): void {
    if (rightIds.length === 0) return
    for (const id of rightIds) {
      instances.current.get(id)?.term.dispose()
      instances.current.delete(id)
      hosts.current.delete(id)
    }
    const last = rightIds[rightIds.length - 1]
    setRightIds([])
    if (last) {
      setActiveId(last)
      activeIdRef.current = last
    }
  }

  useEffect(() => {
    const inst = instances.current
    const hs = hosts.current
    function onRoot(e: Event): void {
      const detail = (e as CustomEvent<{ root?: unknown }>).detail
      if (typeof detail?.root === 'string' && detail.root !== '') {
        lastRootRef.current = detail.root
        setNotice(null)
      }
    }
    function onShow(): void {
      showPanel()
    }
    let unOutput: (() => void) | undefined
    let unExit: (() => void) | undefined
    void onTerminalOutput((out) => {
      inst.get(out.id)?.term.write(out.data)
    }).then((un) => {
      unOutput = un
    })
    void onTerminalExit((exit) => {
      inst.get(exit.id)?.term.write(`\r\n${t('terminal.exited')}\r\n`)
    }).then((un) => {
      unExit = un
    })
    window.addEventListener('stdhub:root', onRoot)
    window.addEventListener('stdhub:terminal-show', onShow)
    return () => {
      window.removeEventListener('stdhub:root', onRoot)
      window.removeEventListener('stdhub:terminal-show', onShow)
      unOutput?.()
      unExit?.()
      for (const { term } of inst.values()) term.dispose()
      inst.clear()
      hs.clear()
    }
  }, [t, showPanel])

  // Create xterm instances for tabs that lack one (never dispose here:
  // switching tabs or adding one must keep the others' scrollback).
  // Each group is independent: bottom tabs need the bottom panel open,
  // right tabs only need the right sidebar to exist.
  useEffect(() => {
    for (const tab of terms) {
      if (instances.current.has(tab.id)) continue
      const host = hosts.current.get(tab.id)
      if (!host) continue
      const visible = rightIds.includes(tab.id) ? hasRight : open
      if (!visible) continue
      const term = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        theme: {
          background: '#09090b',
          foreground: '#e4e4e7',
          cursor: '#e4e4e7',
          selectionBackground: 'rgba(255, 255, 255, 0.25)',
        },
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(host)
      term.onData((data) => {
        void writeTerminal(tab.id, data).catch(() => undefined)
      })
      instances.current.set(tab.id, { term, fit })
    }
  }, [terms, rightIds, hasRight, open])

  // Fit (and report the size of) the visible terminals. Refs only, so the
  // observer callback below stays valid for the panel's whole lifetime.
  const fitGroup = useCallback((id: string | null): void => {
    if (!id) return
    const entry = instances.current.get(id)
    if (!entry) return
    try {
      entry.fit.fit()
      const dims = entry.fit.proposeDimensions()
      if (dims && dims.cols > 0 && dims.rows > 0) {
        void resizeTerminal(id, dims.cols, dims.rows).catch(() => undefined)
      }
    } catch {
      // Transient layout states (e.g. mid-animation): the observer retries.
    }
  }, [])

  // Groups animate open (0fr→1fr tracks): an xterm created mid-animation
  // measures ~zero size and would stay blank forever without a re-fit.
  // The observer refits on every geometry change instead.
  useEffect(() => {
    const targets = [bottomBodyRef.current, rightBodyRef.current].filter(
      (el): el is HTMLDivElement => el !== null,
    )
    if (targets.length === 0 || typeof ResizeObserver === 'undefined') return
    let queued = false
    const ro = new ResizeObserver(() => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        fitGroup(activeIdRef.current)
      })
    })
    for (const el of targets) ro.observe(el)
    return () => ro.disconnect()
  }, [fitGroup, bottomHost, rightHost, hasRight])

  // Fit (and focus) whenever the visible terminal changes.
  useEffect(() => {
    if (!activeId) return
    const visible = rightIds.includes(activeId) ? hasRight : open
    if (!visible) return
    fitGroup(activeId)
    try {
      instances.current.get(activeId)?.term.focus()
    } catch {
      // Non-blocking: keyboard still reaches the terminal on click.
    }
  }, [activeId, open, rightIds, hasRight, fitGroup])

  async function openExternal(): Promise<void> {
    const root = lastRootRef.current
    if (!root) {
      setNotice(t('terminal.noFolder'))
      return
    }
    try {
      await openExternalTerminal(root)
      setNotice(null)
    } catch (e) {
      setNotice(
        fsCode(e) === 'unsupported'
          ? t('explorer.terminalWeb')
          : t('explorer.opFailed'),
      )
    }
  }

  async function closeTerminal(id: string): Promise<void> {
    try {
      await killTerminal(id)
    } catch {
      // Already gone backend-side; still drop the tab.
    }
    instances.current.get(id)?.term.dispose()
    instances.current.delete(id)
    hosts.current.delete(id)
    countRef.current = Math.max(0, countRef.current - 1)
    const rest = terms.map((tab) => tab.id).filter((tabId) => tabId !== id)
    setTerms((prev) => prev.filter((tab) => tab.id !== id))
    setRightIds((prev) => prev.filter((tabId) => tabId !== id))
    // Dismissing the bottom's last tab hands its home to the right sidebar.
    if (
      open &&
      !rightIds.includes(id) &&
      rest.filter((tabId) => !rightIds.includes(tabId)).length === 0 &&
      rest.length > 0
    ) {
      setOpen(false)
    }
    if (activeId === id) {
      const wasRight = rightIds.includes(id)
      const sameGroup = wasRight
        ? rest.filter((tabId) => rightIds.includes(tabId))
        : rest.filter((tabId) => !rightIds.includes(tabId))
      const fallback =
        sameGroup[sameGroup.length - 1] ?? rest[rest.length - 1] ?? null
      setActiveId(fallback)
      activeIdRef.current = fallback
    }
  }

  function labelOf(id: string): string {
    const index = terms.findIndex((tab) => tab.id === id)
    return `${t('terminal.title')} ${index + 1}`
  }

  /** The tab this group shows: its own when active, else its most recent. */
  function groupActive(ids: string[]): string | null {
    if (activeId && ids.includes(activeId)) return activeId
    return ids[ids.length - 1] ?? null
  }

  const [dragGhost, setDragGhost] = useState<{
    id: string
    label: string
    x: number
    y: number
  } | null>(null)
  const tabGestureRef = useRef<{
    id: string
    startX: number
    startY: number
    active: boolean
  } | null>(null)

  function setTabDragging(dragging: boolean): void {
    window.dispatchEvent(
      new CustomEvent('stdhub:terminal-drag', { detail: { dragging } }),
    )
  }

  // Pointer-based tab drag (same pattern as the explorer): works with
  // mouse and touch alike, with no browser-DnD quirks. Dropping over the
  // right dock moves just that tab right; over the bottom group moves it
  // back. A plain click (no motion) still just activates the tab.
  function onTabPointerDown(e: ReactPointerEvent, id: string): void {
    if (e.button !== 0) return
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
      setTabDragging(true)
      setDragGhost({
        id: gesture.id,
        label: labelOf(gesture.id),
        x: e.clientX,
        y: e.clientY,
      })
    } else {
      setDragGhost((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : prev,
      )
    }
  }

  function endTabGestureAt(clientX: number, clientY: number): void {
    const gesture = tabGestureRef.current
    tabGestureRef.current = null
    detachTabGesture()
    setTabDragging(false)
    setDragGhost(null)
    if (!gesture || !gesture.active) return
    const hit = safeElementFromPoint(clientX, clientY)
    if (hit?.closest?.('[data-testid="terminal-right-slot"]')) {
      moveTab(gesture.id, 'right')
      return
    }
    if (hit?.closest?.('[data-testid="terminal-bottom"]')) {
      moveTab(gesture.id, 'bottom')
    }
  }

  function onTabPointerUp(e: PointerEvent): void {
    endTabGestureAt(e.clientX, e.clientY)
  }

  function onTabPointerCancel(): void {
    tabGestureRef.current = null
    detachTabGesture()
    setTabDragging(false)
    setDragGhost(null)
  }

  function renderTab(tabId: string, group: 'bottom' | 'right') {
    const label = labelOf(tabId)
    const moveLabel =
      group === 'bottom' ? t('terminal.moveRight') : t('terminal.moveBottom')
    const moveTo = group === 'bottom' ? 'right' : 'bottom'
    return (
      <div
        key={tabId}
        role="tab"
        aria-selected={activeId === tabId}
        onPointerDown={(e) => onTabPointerDown(e, tabId)}
        className="flex animate-in cursor-grab items-center rounded-md fade-in select-none slide-in-from-left-1 duration-200 active:cursor-grabbing"
      >
        <ContextMenu>
          <ContextMenuTrigger className="flex items-center rounded-md">
            <button
              type="button"
              onClick={() => {
                setActiveId(tabId)
                activeIdRef.current = tabId
              }}
              className={
                activeId === tabId
                  ? 'rounded-l-md bg-muted px-3 py-1 text-xs font-medium'
                  : 'rounded-l-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground'
              }
            >
              {label}
            </button>
            <button
              type="button"
              aria-label={t('terminal.closeTerminal', { name: label })}
              onClick={() => void closeTerminal(tabId)}
              className="rounded-r-md px-1.5 py-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuGroup>
              <ContextMenuItem onClick={() => void closeTerminal(tabId)}>
                {t('explorer.close')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => moveTab(tabId, moveTo)}>
                {moveLabel}
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    )
  }

  function renderHeader(
    group: 'bottom' | 'right',
    ids: string[],
    extra: ReactNode,
  ) {
    const showEmpty = group === 'bottom' && terms.length === 0
    return (
      <div className="flex items-center gap-1 border-b px-2">
        <TerminalIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        {showEmpty ? (
          <p className="min-w-0 flex-1 px-2 py-1 text-xs text-muted-foreground">
            {t('terminal.empty')}
          </p>
        ) : (
          <div
            role="tablist"
            aria-label={
              group === 'bottom' ? t('terminal.title') : t('terminal.rightTitle')
            }
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1"
          >
            {ids.map((tabId) => renderTab(tabId, group))}
          </div>
        )}
        <button
          type="button"
          aria-label={t('terminal.newTerminal')}
          title={t('terminal.newTerminal')}
          onClick={() => void newTerminal(group)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="size-4" aria-hidden />
        </button>
        {extra}
      </div>
    )
  }

  function renderBodies(ids: string[]) {
    return ids.map((tabId) => (
      <div
        key={tabId}
        hidden={groupActive(ids) !== tabId}
        className="h-full px-2 py-1"
        ref={(el) => {
          if (el) hosts.current.set(tabId, el)
          else hosts.current.delete(tabId)
        }}
      />
    ))
  }

  const rightExtras = (
    <button
      type="button"
      aria-label={t('terminal.moveAllBottom')}
      title={t('terminal.moveAllBottom')}
      onClick={moveAllBack}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      <PanelBottom className="size-4" aria-hidden />
    </button>
  )

  const bottomExtras = (
    <>
      <button
        type="button"
        aria-label={t('terminal.external')}
        title={t('terminal.external')}
        onClick={() => void openExternal()}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <ExternalLink className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t('terminal.hide')}
        title={t('terminal.hide')}
        onClick={() => setOpen(false)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <ChevronsDown className="size-4" aria-hidden />
      </button>
    </>
  )

  return (
    <>
      {bottomHost
        ? createPortal(
            <div
              data-testid="terminal-bottom"
              ref={bottomBodyRef}
              className="flex min-h-0 flex-col overflow-hidden bg-background"
            >
              <div
                style={{ height: panelHeight }}
                className="flex min-h-0 shrink-0 flex-col"
              >
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label={t('terminal.resize')}
                  data-testid="terminal-resize"
                  onMouseDown={onHeightDragDown}
                  className="h-1.5 w-full shrink-0 cursor-row-resize hover:bg-accent"
                />
                {renderHeader('bottom', bottomIds, bottomExtras)}
                <div className="min-h-0 flex-1">{renderBodies(bottomIds)}</div>
              {notice ? (
                <p
                  role="status"
                  className="border-t px-4 py-1.5 text-xs text-muted-foreground"
                >
                  {notice}
                </p>
              ) : null}
              {dragGhost ? (
                <div
                  aria-hidden
                  style={{
                    transform: `translate(${dragGhost.x + 12}px, ${dragGhost.y + 12}px)`,
                  }}
                  className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-48 items-center gap-1.5 rounded-md border bg-popover px-2 py-1 text-xs shadow-lg"
                >
                  <TerminalIcon
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate">{dragGhost.label}</span>
                </div>
              ) : null}
              </div>
            </div>,
            bottomHost,
          )
        : null}
      {rightHost && hasRight
        ? createPortal(
            <div
              data-testid="terminal-right"
              ref={rightBodyRef}
              className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
            >
              {renderHeader('right', rightIds, rightExtras)}
              <div className="min-h-0 flex-1">{renderBodies(rightIds)}</div>
            </div>,
            rightHost,
          )
        : null}
    </>
  )
}

export default TerminalPanel
