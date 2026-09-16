import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TerminalPanel from './TerminalPanel'
import '../../lib/i18n'
import {
  killTerminal,
  onTerminalExit,
  onTerminalOutput,
  openExternalTerminal,
  spawnTerminal,
  writeTerminal,
} from '@/lib/pty'
import { Terminal as XTerm } from '@xterm/xterm'

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function (this: unknown) {
    return {
      open: vi.fn(),
      write: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      onData: vi.fn(),
    }
  }),
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(function (this: unknown) {
    return {
      fit: vi.fn(),
      proposeDimensions: () => ({ cols: 80, rows: 24 }),
    }
  }),
}))

vi.mock('@/lib/pty', () => ({
  TERMINAL_MIME: 'application/x-stdhub-terminal',
  spawnTerminal: vi.fn(async () => undefined),
  writeTerminal: vi.fn(async () => undefined),
  resizeTerminal: vi.fn(async () => undefined),
  killTerminal: vi.fn(async () => undefined),
  openExternalTerminal: vi.fn(async () => 'opened' as const),
  onTerminalOutput: vi.fn(async () => () => undefined),
  onTerminalExit: vi.fn(async () => () => undefined),
}))

interface FakeXTerm {
  open: ReturnType<typeof vi.fn>
  write: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  loadAddon: ReturnType<typeof vi.fn>
  onData: ReturnType<typeof vi.fn>
}

function createdTerms(): FakeXTerm[] {
  return vi.mocked(XTerm).mock.results.map((r) => r.value as FakeXTerm)
}

let bottomHost: HTMLDivElement
let rightHost: HTMLDivElement

function emitRoot(root = 'C:/proj'): void {
  act(() => {
    window.dispatchEvent(new CustomEvent('stdhub:root', { detail: { root } }))
  })
}

function emitShow(): void {
  act(() => {
    window.dispatchEvent(new CustomEvent('stdhub:terminal-show'))
  })
}

function bottomTabs(): HTMLElement[] {
  const scope = screen.queryByTestId('terminal-bottom')
  if (!scope) return []
  return Array.from(scope.querySelectorAll('[role="tab"]')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )
}

function rightTabs(): HTMLElement[] {
  const scope = screen.queryByTestId('terminal-right')
  if (!scope) return []
  return Array.from(scope.querySelectorAll('[role="tab"]')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )
}

function bottomNewButton(): HTMLElement {
  return within(screen.getByTestId('terminal-bottom')).getByRole('button', {
    name: 'New terminal',
  })
}

function fakePointerTarget(el: Element | null): void {
  const doc = document as unknown as {
    elementFromPoint: (x: number, y: number) => Element | null
  }
  doc.elementFromPoint = () => el
}

const realHitTest: ((x: number, y: number) => Element | null) | undefined =
  typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint.bind(document)
    : undefined

function dragTabTo(tab: HTMLElement, target: Element | null): void {
  fireEvent.pointerDown(tab, { button: 0, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(tab, { clientX: 40, clientY: 40 })
  fakePointerTarget(target)
  fireEvent.pointerUp(tab, { clientX: 40, clientY: 40 })
}

async function openTwo(): Promise<void> {
  emitRoot()
  emitShow()
  await screen.findByRole('tab', { name: 'Terminal 1' })
  fireEvent.click(bottomNewButton())
  await screen.findByRole('tab', { name: 'Terminal 2' })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.removeItem('stdhub.terminal-height')
  bottomHost = document.createElement('div')
  rightHost = document.createElement('div')
  rightHost.setAttribute('data-testid', 'terminal-right-slot')
  document.body.appendChild(bottomHost)
  document.body.appendChild(rightHost)
  render(<TerminalPanel bottomHost={bottomHost} rightHost={rightHost} />)
})

afterEach(() => {
  const doc = document as unknown as {
    elementFromPoint?: (x: number, y: number) => Element | null
  }
  if (realHitTest) doc.elementFromPoint = realHitTest
  else delete doc.elementFromPoint
})

describe('T09h terminal groups', () => {
  it('renders nothing without hosts', () => {
    // Re-render without hosts on a clean tree.
    document.body.innerHTML = ''
    render(<TerminalPanel bottomHost={null} rightHost={null} />)
    expect(screen.queryByTestId('terminal-bottom')).toBeNull()
    expect(screen.queryByTestId('terminal-right')).toBeNull()
  })

  it('asks for a folder before spawning', async () => {
    emitShow()
    expect(await screen.findByText(/open a folder first/i)).toBeTruthy()
    expect(bottomTabs()).toHaveLength(0)
    expect(spawnTerminal).not.toHaveBeenCalled()
  })

  it('spawns a terminal in the last opened folder', async () => {
    emitRoot()
    emitShow()
    expect(await screen.findByRole('tab', { name: 'Terminal 1' })).toBeTruthy()
    expect(spawnTerminal).toHaveBeenCalledWith('term-1', 'C:/proj', 80, 24)
    await waitFor(() => {
      expect(createdTerms()).toHaveLength(1)
    })
  })

  it('shows a notice when spawning fails (web)', async () => {
    emitRoot()
    const { fsError } = await import('@/lib/filesystem')
    vi.mocked(spawnTerminal).mockRejectedValueOnce(fsError('unsupported'))
    emitShow()
    expect(await screen.findByText(/needs the desktop app/i)).toBeTruthy()
    expect(bottomTabs()).toHaveLength(0)
  })

  it('holds multiple terminals and switches between them', async () => {
    await openTwo()
    expect(bottomTabs()).toHaveLength(2)
    fireEvent.click(
      within(screen.getByRole('tab', { name: 'Terminal 1' })).getByRole(
        'button',
        { name: 'Terminal 1' },
      ),
    )
    expect(screen.getByRole('tab', { name: 'Terminal 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('moves a tab right via its menu, keeping numbers and session', async () => {
    await openTwo()
    const tab1 = screen.getByRole('tab', { name: 'Terminal 1' })
    fireEvent.contextMenu(
      within(tab1).getByRole('button', { name: 'Terminal 1' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to the right' }))
    // Global numbering follows opening order in both groups.
    expect(
      await within(screen.getByTestId('terminal-right')).findByRole('tab', {
        name: 'Terminal 1',
      }),
    ).toBeTruthy()
    expect(
      within(screen.getByTestId('terminal-bottom')).getByRole('tab', {
        name: 'Terminal 2',
      }),
    ).toBeTruthy()
    // No backend churn: same two PTYs, no kill, no respawn.
    expect(spawnTerminal).toHaveBeenCalledTimes(2)
    expect(killTerminal).not.toHaveBeenCalled()
    // The moved tab gets a fresh view that keeps receiving output.
    await waitFor(() => {
      expect(createdTerms()).toHaveLength(3)
    })
    const onOutput = vi.mocked(onTerminalOutput).mock.calls[0][0]
    act(() => {
      onOutput({ id: 'term-1', data: 'hello$ ' })
    })
    expect(createdTerms()[2].write).toHaveBeenCalledWith('hello$ ')
  })

  it('moves a tab back to the bottom via its menu', async () => {
    await openTwo()
    fireEvent.contextMenu(
      within(screen.getByRole('tab', { name: 'Terminal 2' })).getByRole(
        'button',
        { name: 'Terminal 2' },
      ),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to the right' }))
    expect(screen.queryByTestId('terminal-right')).not.toBeNull()
    const rightTab = within(screen.getByTestId('terminal-right')).getByRole(
      'tab',
      { name: 'Terminal 2' },
    )
    fireEvent.contextMenu(
      within(rightTab).getByRole('button', { name: 'Terminal 2' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to the bottom' }))
    await waitFor(() => {
      expect(screen.queryByTestId('terminal-right')).toBeNull()
    })
    expect(bottomTabs()).toHaveLength(2)
  })

  it('moves a tab right by dragging onto the right slot', async () => {
    await openTwo()
    dragTabTo(screen.getByRole('tab', { name: 'Terminal 1' }), rightHost)
    expect(
      await within(screen.getByTestId('terminal-right')).findByRole('tab', {
        name: 'Terminal 1',
      }),
    ).toBeTruthy()
    expect(bottomTabs()).toHaveLength(1)
    expect(rightTabs()).toHaveLength(1)
    // Same session, no backend churn: no kill, no respawn.
    expect(spawnTerminal).toHaveBeenCalledTimes(2)
    expect(killTerminal).not.toHaveBeenCalled()
    // The moved tab gets a fresh view that keeps receiving output.
    await waitFor(() => {
      expect(createdTerms()).toHaveLength(3)
    })
    const onOutput = vi.mocked(onTerminalOutput).mock.calls[0][0]
    act(() => {
      onOutput({ id: 'term-1', data: 'hello$ ' })
    })
    expect(createdTerms()[2].write).toHaveBeenCalledWith('hello$ ')
  })

  it('moves a tab back by dragging onto the bottom group', async () => {
    await openTwo()
    dragTabTo(screen.getByRole('tab', { name: 'Terminal 1' }), rightHost)
    await within(screen.getByTestId('terminal-right')).findByRole('tab', {
      name: 'Terminal 1',
    })
    const rightTab = within(screen.getByTestId('terminal-right')).getByRole(
      'tab',
      { name: 'Terminal 1' },
    )
    const bottomGroup = screen.getByTestId('terminal-bottom')
    dragTabTo(rightTab, bottomGroup)
    await waitFor(() => {
      expect(screen.queryByTestId('terminal-right')).toBeNull()
    })
    expect(bottomTabs()).toHaveLength(2)
  })

  it('ignores a press without motion (plain click still activates)', async () => {
    await openTwo()
    const tab = screen.getByRole('tab', { name: 'Terminal 1' })
    fireEvent.pointerDown(tab, { button: 0, clientX: 10, clientY: 10 })
    fakePointerTarget(rightHost)
    fireEvent.pointerUp(tab, { clientX: 11, clientY: 10 })
    expect(bottomTabs()).toHaveLength(2)
    expect(screen.queryByTestId('terminal-right')).toBeNull()
  })

  it('closes a terminal tab, kills its PTY and renumbers', async () => {
    await openTwo()
    fireEvent.click(screen.getByRole('button', { name: 'Close Terminal 1' }))
    expect(killTerminal).toHaveBeenCalledWith('term-1')
    expect(await screen.findByRole('tab', { name: 'Terminal 1' })).toBeTruthy()
    expect(bottomTabs()).toHaveLength(1)
  })

  it('reveals without spawning when a terminal is already open', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    expect(spawnTerminal).toHaveBeenCalledTimes(1)
    emitShow()
    expect(spawnTerminal).toHaveBeenCalledTimes(1)
    expect(bottomTabs()).toHaveLength(1)
  })

  it('routes backend output to the right terminal', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    await waitFor(() => {
      expect(createdTerms().length).toBeGreaterThan(0)
    })
    const onOutput = vi.mocked(onTerminalOutput).mock.calls[0][0]
    act(() => {
      onOutput({ id: 'term-1', data: 'hello$ ' })
    })
    expect(createdTerms()[0].write).toHaveBeenCalledWith('hello$ ')
  })

  it('forwards typed keys to the PTY', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    await waitFor(() => {
      expect(createdTerms()[0].onData.mock.calls.length).toBeGreaterThan(0)
    })
    const onData = createdTerms()[0].onData.mock.calls[0][0] as (
      data: string,
    ) => void
    act(() => {
      onData('ls\r')
    })
    expect(writeTerminal).toHaveBeenCalledWith('term-1', 'ls\r')
  })

  it('marks exited terminals', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    await waitFor(() => {
      expect(createdTerms().length).toBeGreaterThan(0)
    })
    const onExit = vi.mocked(onTerminalExit).mock.calls[0][0]
    act(() => {
      onExit({ id: 'term-1' })
    })
    expect(createdTerms()[0].write).toHaveBeenCalledWith(
      expect.stringContaining('Process exited'),
    )
  })

  it('opens an external terminal in the folder', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    fireEvent.click(
      within(screen.getByTestId('terminal-bottom')).getByRole('button', {
        name: 'Open external terminal',
      }),
    )
    expect(openExternalTerminal).toHaveBeenCalledWith('C:/proj')
  })

  it('notices when the external terminal fails', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    vi.mocked(openExternalTerminal).mockRejectedValueOnce(new Error('nope'))
    fireEvent.click(
      within(screen.getByTestId('terminal-bottom')).getByRole('button', {
        name: 'Open external terminal',
      }),
    )
    expect(await screen.findByText(/something went wrong/i)).toBeTruthy()
  })

  it('resizes the bottom panel by dragging its handle', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    const inner = screen.getByTestId('terminal-bottom')
      .firstElementChild as HTMLElement
    expect(inner.getAttribute('style')).toContain('height: 224px')
    const handle = screen.getByRole('separator', { name: /resize terminal/i })
    fireEvent.mouseDown(handle, { clientY: 500 })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mousemove', { clientY: 400 }))
    })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mouseup'))
    })
    expect(inner.getAttribute('style')).toContain('height: 324px')
    expect(window.localStorage.getItem('stdhub.terminal-height')).toBe('324')
  })

  it('keeps its height across hide and show', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    const inner = () =>
      screen.getByTestId('terminal-bottom').firstElementChild as HTMLElement
    const handle = screen.getByRole('separator', { name: /resize terminal/i })
    fireEvent.mouseDown(handle, { clientY: 500 })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mousemove', { clientY: 400 }))
    })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mouseup'))
    })
    expect(inner().getAttribute('style')).toContain('height: 324px')
    fireEvent.click(
      within(screen.getByTestId('terminal-bottom')).getByRole('button', {
        name: /hide terminal/i,
      }),
    )
    emitShow()
    expect(await screen.findByRole('tab', { name: 'Terminal 1' })).toBeTruthy()
    expect(inner().getAttribute('style')).toContain('height: 324px')
  })

  it('collapses and re-expands without losing terminals', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    fireEvent.click(
      within(screen.getByTestId('terminal-bottom')).getByRole('button', {
        name: /hide terminal/i,
      }),
    )
    // Tabs stay mounted while collapsed (scrollback preserved).
    expect(bottomTabs()).toHaveLength(1)
    emitShow()
    expect(await screen.findByRole('tab', { name: 'Terminal 1' })).toBeTruthy()
    expect(createdTerms()).toHaveLength(1)
  })

  function moveFirstTabRight(): void {
    fireEvent.contextMenu(
      within(screen.getByRole('tab', { name: 'Terminal 1' })).getByRole(
        'button',
        { name: 'Terminal 1' },
      ),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to the right' }))
  }

  it('hides the bottom panel when its last tab moves right', async () => {
    emitRoot()
    emitShow()
    await screen.findByRole('tab', { name: 'Terminal 1' })
    const states: Array<{ open: unknown; rightCount: unknown }> = []
    const onVis = (e: Event): void => {
      states.push((e as CustomEvent).detail as never)
    }
    window.addEventListener('stdhub:terminal-visibility', onVis)
    try {
      moveFirstTabRight()
      await waitFor(() => {
        expect(
          states.some((s) => s.open === false && s.rightCount === 1),
        ).toBe(true)
      })
      // The terminal's new home is the right sidebar.
      expect(
        await within(screen.getByTestId('terminal-right')).findByRole('tab', {
          name: 'Terminal 1',
        }),
      ).toBeTruthy()
    } finally {
      window.removeEventListener('stdhub:terminal-visibility', onVis)
    }
  })

  it('keeps the right sidebar with the bottom panel closed', async () => {
    await openTwo()
    moveFirstTabRight()
    await within(screen.getByTestId('terminal-right')).findByRole('tab', {
      name: 'Terminal 1',
    })
    fireEvent.click(
      within(screen.getByTestId('terminal-bottom')).getByRole('button', {
        name: /hide terminal/i,
      }),
    )
    // Right keeps working on its own: routed output still lands.
    expect(
      within(screen.getByTestId('terminal-right')).getByRole('tab', {
        name: 'Terminal 1',
      }),
    ).toBeTruthy()
    const onOutput = vi.mocked(onTerminalOutput).mock.calls[0][0]
    await waitFor(() => {
      expect(createdTerms().length).toBeGreaterThan(0)
    })
    act(() => {
      onOutput({ id: 'term-1', data: 'right$ ' })
    })
    // The moved tab's fresh right-hand view receives the stream.
    await waitFor(() => {
      const writes = createdTerms().flatMap((inst) =>
        inst.write.mock.calls.map((call) => call[0] as string),
      )
      expect(writes).toContain('right$ ')
    })
  })

  it('moves every right tab back to the bottom', async () => {
    await openTwo()
    moveFirstTabRight()
    await within(screen.getByTestId('terminal-right')).findByRole('tab', {
      name: 'Terminal 1',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Move all to the bottom' }))
    await waitFor(() => {
      expect(screen.queryByTestId('terminal-right')).toBeNull()
    })
    expect(bottomTabs()).toHaveLength(2)
  })

  it('hides the bottom panel when its last tab is closed', async () => {
    await openTwo()
    moveFirstTabRight()
    await within(screen.getByTestId('terminal-right')).findByRole('tab', {
      name: 'Terminal 1',
    })
    const states: Array<{ open: unknown; rightCount: unknown }> = []
    const onVis = (e: Event): void => {
      states.push((e as CustomEvent).detail as never)
    }
    window.addEventListener('stdhub:terminal-visibility', onVis)
    try {
      // Bottom holds Terminal 2 (global order kept); closing it empties
      // the bottom group while Terminal 1 lives on the right.
      fireEvent.click(
        within(screen.getByTestId('terminal-bottom')).getByRole('button', {
          name: 'Close Terminal 2',
        }),
      )
      expect(killTerminal).toHaveBeenCalledWith('term-2')
      await waitFor(() => {
        expect(
          states.some((s) => s.open === false && s.rightCount === 1),
        ).toBe(true)
      })
    } finally {
      window.removeEventListener('stdhub:terminal-visibility', onVis)
    }
  })
})
