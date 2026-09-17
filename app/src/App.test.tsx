import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import './lib/i18n'
import i18n, { LANGUAGE_STORAGE_KEY } from './lib/i18n'

vi.mock('./components/editor/CodeEditor', () => ({
  default: () => <div data-testid="mock-editor-shell" />,
}))

function mockNavigatorLanguage(value: string): void {
  Object.defineProperty(window.navigator, 'language', {
    value,
    configurable: true,
  })
}

function seedLanguage(): void {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
}

function enterAsGuest(): void {
  fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }))
}

function sidebarButton(name: RegExp): HTMLElement {
  const buttons = screen.getAllByRole('button', { name })
  const sidebar = buttons.find((b) => !b.closest('[role="tablist"]'))
  if (!sidebar) throw new Error(`sidebar button ${name} not found`)
  return sidebar
}

/** Right-clicks a tab's inner button (bubbles through the menu trigger). */
function openTabMenu(name: string, scopeTestId = 'shell-tabs'): void {
  const tab = within(screen.getByTestId(scopeTestId)).getByRole('tab', {
    name,
  })
  fireEvent.contextMenu(within(tab).getByRole('button', { name }))
}

function tabNames(): string[] {
  const tablist = screen.getByRole('tablist')
  return Array.from(tablist.querySelectorAll('[role="tab"]')).map(
    (tab) => tab.textContent ?? '',
  )
}

function menuTrigger(name: string): HTMLElement {
  const found = screen
    .getAllByText(name)
    .find((el) => el.getAttribute('aria-haspopup') === 'menu')
  if (!found) throw new Error(`menu trigger ${name} not found`)
  return found
}

beforeEach(async () => {
  window.localStorage.clear()
  mockNavigatorLanguage('en-US')
  await i18n.changeLanguage('en')
})

describe('T04 login', () => {
  it('shows the login screen first', () => {
    seedLanguage()
    render(<App />)
    expect(
      screen.getByRole('button', { name: /continue as guest/i }),
    ).toBeTruthy()
  })

  it('keeps cloud login disabled until the database is chosen', () => {
    seedLanguage()
    render(<App />)
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeDisabled()
    expect(screen.getByText(/isn't available yet/i)).toBeTruthy()
  })

  it('guest enters the shell offline and persists', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.getByText('Explorer')).toBeTruthy()
    const stored: unknown = JSON.parse(
      window.localStorage.getItem('stdhub.profile') ?? 'null',
    )
    expect(
      typeof stored === 'object' &&
        stored !== null &&
        (stored as { mode?: unknown }).mode,
    ).toBe('guest')
  })

  it('logout returns to the login screen', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(
      await screen.findByRole('button', { name: /continue as guest/i }),
    ).toBeTruthy()
    expect(window.localStorage.getItem('stdhub.profile')).toBeNull()
  })
})

describe('T05 shell', () => {
  it('starts with no open tabs', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    expect(screen.getByText(/no tabs open/i)).toBeTruthy()
    expect(
      screen.getByRole('tablist').querySelectorAll('[role="tab"]'),
    ).toHaveLength(0)
  })

  it('left-click opens the function tab', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    expect(tabNames().join('|')).toBe('Calculator')
    expect(screen.queryByText(/no tabs open/i)).toBeNull()
  })

  it('opens a function tab from the context menu too', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.contextMenu(sidebarButton(/calculator/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    expect(tabNames().join('|')).toBe('Calculator')
  })

  it('shows the side panel only for the explorer', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    expect(screen.getByLabelText('Notebook panel')).toBeTruthy()
    fireEvent.click(sidebarButton(/calculator/i))
    expect(screen.queryByLabelText('Notebook panel')).toBeNull()
    fireEvent.click(sidebarButton(/notebook/i))
    expect(screen.getByLabelText('Notebook panel')).toBeTruthy()
  })

  it('opens settings as a modal without selecting it', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/settings/i))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sidebarButton(/settings/i)).not.toHaveAttribute(
      'data-active',
      'true',
    )
    expect(screen.getByLabelText('Notebook panel')).toBeTruthy()
  })

  it('keeps the explorer when another tab is closed', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/notebook/i))
    fireEvent.click(sidebarButton(/calculator/i))
    fireEvent.click(screen.getByRole('button', { name: /close calculator/i }))
    expect(tabNames().join('|')).toBe('Notebook')
    fireEvent.click(sidebarButton(/notebook/i))
    expect(screen.getByLabelText('Notebook panel')).toBeTruthy()
  })

  it('docks a function tab to the right from its menu', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the right/i }))
    const slot = screen.getByTestId('function-right-slot')
    expect(slot.getAttribute('style')).toContain('width: 360px')
    expect(
      within(slot).getByRole('tab', { name: 'Calculator' }),
    ).toBeTruthy()
    // Gone from the main bar, but still functional on the right.
    expect(
      within(screen.getByTestId('shell-tabs')).queryByRole('tab', {
        name: 'Calculator',
      }),
    ).toBeNull()
    expect(
      within(slot).getByRole('textbox', { name: /expression/i }),
    ).toBeTruthy()
  })

  it('undocks back to the main area', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the right/i }))
    const slot = screen.getByTestId('function-right-slot')
    openTabMenu('Calculator', 'function-right-slot')
    fireEvent.click(screen.getByRole('menuitem', { name: /move to main/i }))
    expect(slot.getAttribute('style')).toContain('width: 0px')
    expect(
      within(screen.getByTestId('shell-tabs')).getByRole('tab', {
        name: 'Calculator',
      }),
    ).toBeTruthy()
  })

  it('drags a tab onto the right slot', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    const funcSlot = screen.getByTestId('function-right-slot')
    const doc = document as unknown as {
      elementFromPoint?: (x: number, y: number) => Element | null
    }
    const real = doc.elementFromPoint
    doc.elementFromPoint = () => funcSlot
    try {
      const tab = within(screen.getByTestId('shell-tabs')).getByRole('tab', {
        name: 'Calculator',
      })
      fireEvent.pointerDown(tab, { button: 0, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(tab, { clientX: 60, clientY: 60 })
      fireEvent.pointerUp(tab, { clientX: 60, clientY: 60 })
    } finally {
      if (real) doc.elementFromPoint = real
      else delete doc.elementFromPoint
    }
    expect(funcSlot.getAttribute('style')).toContain('width: 360px')
    expect(
      within(funcSlot).getByRole('tab', { name: 'Calculator' }),
    ).toBeTruthy()
  })

  it('never docks the editor', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/notebook/i))
    const tab = within(screen.getByTestId('shell-tabs')).getByRole('tab', {
      name: 'Notebook',
    })
    openTabMenu('Notebook')
    expect(screen.queryByRole('menuitem', { name: /dock to the right/i })).toBeNull()
    const doc = document as unknown as {
      elementFromPoint?: (x: number, y: number) => Element | null
    }
    const real = doc.elementFromPoint
    doc.elementFromPoint = () =>
      screen.getByTestId('function-right-slot')
    try {
      fireEvent.pointerDown(tab, { button: 0, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(tab, { clientX: 60, clientY: 60 })
      fireEvent.pointerUp(tab, { clientX: 60, clientY: 60 })
    } finally {
      if (real) doc.elementFromPoint = real
      else delete doc.elementFromPoint
    }
    expect(
      screen.getByTestId('function-right-slot').getAttribute('style'),
    ).toContain('width: 0px')
  })

  it('hints in main when the active tab is docked', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the right/i }))
    expect(screen.getByText(/this tab is docked/i)).toBeTruthy()
  })

  it('docks a function tab to the bottom from its menu', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the bottom/i }))
    const dock = screen.getByTestId('function-bottom-dock')
    expect(dock.getAttribute('style')).toContain('height: 224px')
    expect(within(dock).getByRole('tab', { name: 'Calculator' })).toBeTruthy()
    expect(
      within(screen.getByTestId('shell-tabs')).queryByRole('tab', {
        name: 'Calculator',
      }),
    ).toBeNull()
    expect(
      within(dock).getByRole('textbox', { name: /expression/i }),
    ).toBeTruthy()
    // The bottom dock stacks above the terminal panel.
    const term = screen.getByTestId('terminal-bottom-slot')
    expect(dock.compareDocumentPosition(term) & 4).toBe(4)
  })

  it('docks a function tab to the left from its menu', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/tutor/i))
    openTabMenu('Tutor')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the left/i }))
    const slot = screen.getByTestId('function-left-slot')
    expect(slot.getAttribute('style')).toContain('width: 360px')
    expect(
      within(slot).getByRole('tab', { name: 'Tutor' }),
    ).toBeTruthy()
    expect(
      within(screen.getByTestId('shell-tabs')).queryByRole('tab', {
        name: 'Tutor',
      }),
    ).toBeNull()
  })

  it('drags tabs onto the left slot and the bottom dock', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    fireEvent.click(sidebarButton(/research/i))
    const doc = document as unknown as {
      elementFromPoint?: (x: number, y: number) => Element | null
    }
    const real = doc.elementFromPoint
    function dragTabTo(name: string, target: Element): void {
      doc.elementFromPoint = () => target
      try {
        const tab = within(screen.getByTestId('shell-tabs')).getByRole('tab', {
          name,
        })
        fireEvent.pointerDown(tab, { button: 0, clientX: 10, clientY: 10 })
        fireEvent.pointerMove(tab, { clientX: 60, clientY: 60 })
        fireEvent.pointerUp(tab, { clientX: 60, clientY: 60 })
      } finally {
        if (real) doc.elementFromPoint = real
        else delete doc.elementFromPoint
      }
    }
    const left = screen.getByTestId('function-left-slot')
    const bottom = screen.getByTestId('function-bottom-dock')
    dragTabTo('Calculator', left)
    dragTabTo('Research', bottom)
    expect(left.getAttribute('style')).toContain('width: 360px')
    expect(
      within(left).getByRole('tab', { name: 'Calculator' }),
    ).toBeTruthy()
    expect(bottom.getAttribute('style')).toContain('height: 224px')
    expect(
      within(bottom).getByRole('tab', { name: 'Research' }),
    ).toBeTruthy()
  })

  it('undocks from the left and bottom back to the main area', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    fireEvent.click(sidebarButton(/tutor/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the left/i }))
    openTabMenu('Tutor')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the bottom/i }))
    openTabMenu('Calculator', 'function-left-slot')
    fireEvent.click(screen.getByRole('menuitem', { name: /move to main/i }))
    openTabMenu('Tutor', 'function-bottom-dock')
    fireEvent.click(screen.getByRole('menuitem', { name: /move to main/i }))
    expect(
      screen.getByTestId('function-left-slot').getAttribute('style'),
    ).toContain('width: 0px')
    expect(
      screen.getByTestId('function-bottom-dock').getAttribute('class'),
    ).toContain('h-0')
    expect(
      within(screen.getByTestId('shell-tabs')).getByRole('tab', {
        name: 'Calculator',
      }),
    ).toBeTruthy()
    expect(
      within(screen.getByTestId('shell-tabs')).getByRole('tab', {
        name: 'Tutor',
      }),
    ).toBeTruthy()
  })

  it('keeps each dock group independent with positional labels', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    fireEvent.click(sidebarButton(/research/i))
    fireEvent.click(sidebarButton(/tutor/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the left/i }))
    openTabMenu('Tutor')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the bottom/i }))
    const left = screen.getByTestId('function-left-slot')
    const bottom = screen.getByTestId('function-bottom-dock')
    const main = screen.getByTestId('shell-tabs')
    // Labels follow the tab, so each group reads its own names.
    expect(within(left).getByRole('tab', { name: 'Calculator' })).toBeTruthy()
    expect(
      within(bottom).getByRole('tab', { name: 'Tutor' }),
    ).toBeTruthy()
    expect(
      within(main).getByRole('tab', { name: 'Research' }),
    ).toBeTruthy()
    expect(within(main).queryByRole('tab', { name: 'Calculator' })).toBeNull()
    expect(within(left).queryByRole('tab', { name: 'Tutor' })).toBeNull()
  })

  it('drags a tab from one dock straight to another', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the right/i }))
    const right = screen.getByTestId('function-right-slot')
    const left = screen.getByTestId('function-left-slot')
    const doc = document as unknown as {
      elementFromPoint?: (x: number, y: number) => Element | null
    }
    const real = doc.elementFromPoint
    doc.elementFromPoint = () => left
    try {
      const tab = within(right).getByRole('tab', { name: 'Calculator' })
      fireEvent.pointerDown(tab, { button: 0, clientX: 900, clientY: 400 })
      fireEvent.pointerMove(tab, { clientX: 200, clientY: 400 })
      fireEvent.pointerUp(tab, { clientX: 200, clientY: 400 })
    } finally {
      if (real) doc.elementFromPoint = real
      else delete doc.elementFromPoint
    }
    expect(left.getAttribute('style')).toContain('width: 360px')
    expect(right.getAttribute('style')).toContain('width: 0px')
    expect(
      within(left).getByRole('tab', { name: 'Calculator' }),
    ).toBeTruthy()
  })

  it('drags a docked tab back to the main bar', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the bottom/i }))
    const bottom = screen.getByTestId('function-bottom-dock')
    const bar = screen.getByTestId('shell-tabs')
    const doc = document as unknown as {
      elementFromPoint?: (x: number, y: number) => Element | null
    }
    const real = doc.elementFromPoint
    doc.elementFromPoint = () => bar
    try {
      const tab = within(bottom).getByRole('tab', { name: 'Calculator' })
      fireEvent.pointerDown(tab, { button: 0, clientX: 640, clientY: 700 })
      fireEvent.pointerMove(tab, { clientX: 640, clientY: 120 })
      fireEvent.pointerUp(tab, { clientX: 640, clientY: 120 })
    } finally {
      if (real) doc.elementFromPoint = real
      else delete doc.elementFromPoint
    }
    expect(bottom.getAttribute('class')).toContain('h-0')
    expect(
      within(bar).getByRole('tab', { name: 'Calculator' }),
    ).toBeTruthy()
  })

  it('lands a near miss on the closest collapsed slot', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    const left = screen.getByTestId('function-left-slot')
    const right = screen.getByTestId('function-right-slot')
    const bottom = screen.getByTestId('function-bottom-dock')
    vi.spyOn(left, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, width: 0, height: 800,
      top: 0, left: 0, bottom: 800, right: 0,
    } as DOMRect)
    vi.spyOn(right, 'getBoundingClientRect').mockReturnValue({
      x: 5000, y: 0, width: 0, height: 800,
      top: 0, left: 5000, bottom: 800, right: 5000,
    } as DOMRect)
    vi.spyOn(bottom, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 5000, width: 1280, height: 0,
      top: 5000, left: 0, bottom: 5000, right: 1280,
    } as DOMRect)
    // The pointer lands on plain content next to the collapsed left slot:
    // no element to hit, but close enough to dock left.
    const doc = document as unknown as {
      elementFromPoint?: (x: number, y: number) => Element | null
    }
    const real = doc.elementFromPoint
    doc.elementFromPoint = () => document.body
    try {
      const tab = within(screen.getByTestId('shell-tabs')).getByRole('tab', {
        name: 'Calculator',
      })
      fireEvent.pointerDown(tab, { button: 0, clientX: 10, clientY: 400 })
      fireEvent.pointerMove(tab, { clientX: 30, clientY: 400 })
      fireEvent.pointerUp(tab, { clientX: 30, clientY: 400 })
    } finally {
      if (real) doc.elementFromPoint = real
      else delete doc.elementFromPoint
    }
    expect(left.getAttribute('style')).toContain('width: 360px')
    expect(right.getAttribute('style')).toContain('width: 0px')
  })

  it('ignores drops far from every slot', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    const doc = document as unknown as {
      elementFromPoint?: (x: number, y: number) => Element | null
    }
    const real = doc.elementFromPoint
    doc.elementFromPoint = () => document.body
    try {
      const tab = within(screen.getByTestId('shell-tabs')).getByRole('tab', {
        name: 'Calculator',
      })
      fireEvent.pointerDown(tab, { button: 0, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(tab, { clientX: 5000, clientY: 5000 })
      fireEvent.pointerUp(tab, { clientX: 5000, clientY: 5000 })
    } finally {
      if (real) doc.elementFromPoint = real
      else delete doc.elementFromPoint
    }
    // Still in the main bar, nothing docked anywhere.
    expect(
      within(screen.getByTestId('shell-tabs')).getByRole('tab', {
        name: 'Calculator',
      }),
    ).toBeTruthy()
    expect(
      screen.getByTestId('function-right-slot').getAttribute('style'),
    ).toContain('width: 0px')
    expect(
      screen.getByTestId('function-left-slot').getAttribute('style'),
    ).toContain('width: 0px')
    expect(
      screen.getByTestId('function-bottom-dock').getAttribute('class'),
    ).toContain('h-0')
  })

  it('resizes the right dock by dragging its handle', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the right/i }))
    const slot = screen.getByTestId('function-right-slot')
    expect(slot.getAttribute('style')).toContain('width: 360px')
    const handle = within(slot).getByTestId('dock-right-resize')
    fireEvent.mouseDown(handle, { button: 0, clientX: 900 })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 800 }))
    })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mouseup'))
    })
    expect(slot.getAttribute('style')).toContain('width: 460px')
    expect(window.localStorage.getItem('stdhub.dock-right-width')).toBe('460')
  })

  it('resizes the left dock by dragging its handle', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the left/i }))
    const slot = screen.getByTestId('function-left-slot')
    expect(slot.getAttribute('style')).toContain('width: 360px')
    const handle = within(slot).getByTestId('dock-left-resize')
    fireEvent.mouseDown(handle, { button: 0, clientX: 400 })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 300 }))
    })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mouseup'))
    })
    expect(slot.getAttribute('style')).toContain('width: 260px')
    expect(window.localStorage.getItem('stdhub.dock-left-width')).toBe('260')
  })

  it('resizes the bottom dock by dragging its handle', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the bottom/i }))
    const dock = screen.getByTestId('function-bottom-dock')
    expect(dock.getAttribute('style')).toContain('height: 224px')
    const handle = within(dock).getByTestId('dock-bottom-resize')
    fireEvent.mouseDown(handle, { button: 0, clientY: 600 })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mousemove', { clientY: 500 }))
    })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mouseup'))
    })
    expect(dock.getAttribute('style')).toContain('height: 324px')
    expect(window.localStorage.getItem('stdhub.dock-bottom-height')).toBe('324')
  })

  it('keeps the Notebook visible when a docked tab takes focus', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/notebook/i))
    fireEvent.click(sidebarButton(/calculator/i))
    openTabMenu('Calculator')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the right/i }))
    // Focusing the docked tab must not wipe the center: the Notebook
    // (no folder yet) stays instead of the docked hint.
    const docked = within(screen.getByTestId('function-right-slot')).getByRole(
      'tab',
      { name: 'Calculator' },
    )
    fireEvent.click(within(docked).getByRole('button', { name: 'Calculator' }))
    expect(screen.getByText(/no folder open/i)).toBeTruthy()
    expect(screen.queryByText(/this tab is docked/i)).toBeNull()
  })

  it('keeps the last main tab visible when a docked tab takes focus', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/calculator/i))
    fireEvent.click(sidebarButton(/research/i))
    openTabMenu('Research')
    fireEvent.click(screen.getByRole('menuitem', { name: /dock to the right/i }))
    // Main still shows the calculator (last main tab), not the hint.
    expect(
      screen.getByRole('textbox', { name: /expression/i }),
    ).toBeTruthy()
    expect(screen.queryByText(/this tab is docked/i)).toBeNull()
    // Focusing the docked tab keeps the calculator in the center too.
    const docked = within(screen.getByTestId('function-right-slot')).getByRole(
      'tab',
      { name: 'Research' },
    )
    fireEvent.click(within(docked).getByRole('button', { name: 'Research' }))
    expect(
      screen.getByRole('textbox', { name: /expression/i }),
    ).toBeTruthy()
    expect(screen.queryByText(/this tab is docked/i)).toBeNull()
  })

  it('closes the focused tab with Delete', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.contextMenu(sidebarButton(/notebook/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    const tab = screen.getByRole('tablist').querySelector('[role="tab"]')
    if (!tab) throw new Error('no tab rendered')
    fireEvent.keyDown(tab, { key: 'Delete' })
    expect(screen.getByText(/no tabs open/i)).toBeTruthy()
  })

  it('reorders tabs from the tab context menu', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.contextMenu(sidebarButton(/notebook/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    fireEvent.contextMenu(sidebarButton(/calculator/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    const tablist = screen.getByRole('tablist')
    const calcTab = within(tablist).getByText('Calculator')
    fireEvent.contextMenu(calcTab)
    fireEvent.click(screen.getByRole('menuitem', { name: /move left/i }))
    const names = tabNames()
    expect(names[0]).toContain('Calculator')
    expect(names[1]).toContain('Notebook')
  })

  it('resizes the side panel by dragging its handle', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    const handle = screen.getByRole('separator', { name: /resize panel/i })
    fireEvent.mouseDown(handle, { clientX: 240 })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 300 }))
    })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mouseup'))
    })
    expect(screen.getByLabelText('Notebook panel').getAttribute('style')).toContain(
      'width: 300px',
    )
  })

  it('collapses and expands the side panel', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    const panel = screen.getByLabelText('Notebook panel')
    expect(panel.className).toContain('transition-[width]')
    fireEvent.click(screen.getByRole('button', { name: /collapse panel/i }))
    expect(panel.getAttribute('style')).toContain('width: 0px')
    fireEvent.click(screen.getByRole('button', { name: /expand panel/i }))
    expect(panel.getAttribute('style')).toContain('width: 240px')
    expect(screen.getByText('Explorer')).toBeTruthy()
  })

  it('docks terminal tabs on the right strip', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    const right = screen.getByTestId('terminal-right-slot')
    expect(right.getAttribute('style')).toContain('width: 0px')
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:terminal-visibility', {
          detail: { open: true, rightCount: 2 },
        }),
      )
    })
    expect(right.getAttribute('style')).toContain('width: 384px')
    // Independent: the right sidebar stays with the bottom panel closed.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:terminal-visibility', {
          detail: { open: false, rightCount: 2 },
        }),
      )
    })
    expect(right.getAttribute('style')).toContain('width: 384px')
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:terminal-drag', { detail: { dragging: true } }),
      )
    })
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:terminal-visibility', {
          detail: { open: true, rightCount: 0 },
        }),
      )
    })
    expect(right.getAttribute('style')).toContain('width: 96px')
  })

  it('resizes the right terminal dock by dragging its handle', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:terminal-visibility', {
          detail: { open: true, rightCount: 1 },
        }),
      )
    })
    const right = screen.getByTestId('terminal-right-slot')
    expect(right.getAttribute('style')).toContain('width: 384px')
    const handle = within(right).getByRole('separator')
    fireEvent.mouseDown(handle, { clientX: 1000 })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 900 }))
    })
    act(() => {
      window.dispatchEvent(new window.MouseEvent('mouseup'))
    })
    expect(right.getAttribute('style')).toContain('width: 484px')
    expect(window.localStorage.getItem('stdhub.terminal-right-width')).toBe(
      '484',
    )
  })
})

describe('T04a language first', () => {
  it('asks the language before anything else on first run', () => {
    render(<App />)
    expect(screen.getByText(/choose your language/i)).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /continue as guest/i }),
    ).toBeNull()
  })

  it('suggests the detected region language', () => {
    mockNavigatorLanguage('pt-BR')
    render(<App />)
    expect(screen.getByText(/detected: português/i)).toBeTruthy()
  })

  it('confirming persists and advances to login exactly once', async () => {
    mockNavigatorLanguage('pt-BR')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Português' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(
      await screen.findByRole('button', { name: /continuar como convidado/i }),
    ).toBeTruthy()
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt')
  })

  it('skips the question when a language is already stored', () => {
    seedLanguage()
    render(<App />)
    expect(screen.queryByText(/choose your language/i)).toBeNull()
    expect(
      screen.getByRole('button', { name: /continue as guest/i }),
    ).toBeTruthy()
  })
})

describe('T05a menubar', () => {
  it('opens a function from the File menu', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(menuTrigger('File'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Calculator' }))
    expect(tabNames().join('|')).toBe('Calculator')
  })

  it('toggles the panel from the View menu', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    const panel = screen.getByLabelText('Notebook panel')
    fireEvent.click(menuTrigger('View'))
    fireEvent.click(screen.getByRole('menuitem', { name: /hide panel/i }))
    expect(panel.getAttribute('style')).toContain('width: 0px')
    fireEvent.click(menuTrigger('View'))
    fireEvent.click(screen.getByRole('menuitem', { name: /show panel/i }))
    expect(panel.getAttribute('style')).toContain('width: 240px')
    expect(screen.getByText('Explorer')).toBeTruthy()
  })

  it('toggles the sidebar from the View menu', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    expect(document.querySelector('[data-state="collapsed"]')).toBeTruthy()
    fireEvent.click(menuTrigger('View'))
    fireEvent.click(screen.getByRole('menuitem', { name: /toggle sidebar/i }))
    expect(document.querySelector('[data-state="expanded"]')).toBeTruthy()
  })

  it('switches language from the Settings menu', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(menuTrigger('Settings'))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Português' }))
    expect(await screen.findByRole('button', { name: /sair/i })).toBeTruthy()
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt')
  })

  it('enables editor commands for the editor task', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(menuTrigger('File'))
    expect(
      screen.getByRole('menuitem', { name: /save/i }),
    ).not.toHaveAttribute('aria-disabled')
    fireEvent.click(menuTrigger('Edit'))
    expect(
      screen.getByRole('menuitem', { name: /undo/i }),
    ).not.toHaveAttribute('aria-disabled')
  })

  it('logs out from the File menu', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(menuTrigger('File'))
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }))
    expect(
      await screen.findByRole('button', { name: /continue as guest/i }),
    ).toBeTruthy()
  })
})

describe('T07b explorer panel', () => {
  it('picks a folder without opening any tab', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    const buttons = screen.getAllByRole('button', { name: /open folder/i })
    fireEvent.click(buttons[0])
    // The failure must be visible in the sidebar explorer panel itself
    // (the main editor area is hidden while the Notebook tab is closed).
    const panel = screen.getByLabelText(/notebook panel/i)
    expect(await within(panel).findByText(/needs the desktop app/i)).toBeTruthy()
    expect(
      screen.getByRole('tablist').querySelectorAll('[role="tab"]'),
    ).toHaveLength(0)
  })

  it('presents cloud link options', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(screen.getByRole('button', { name: /link cloud/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'GitHub' }))
    expect(await screen.findByText(/next task/i)).toBeTruthy()
  })

  it('locks STDHub cloud without Pro', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(screen.getByRole('button', { name: /link cloud/i }))
    const item = screen.getByRole('menuitem', { name: /STDHub cloud/i })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/requires a pro plan/i)).toBeTruthy()
  })
})

describe('T12-14 functional trio', () => {
  it('opens a working calculator', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.contextMenu(sidebarButton(/calculator/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    expect(
      screen.getByRole('textbox', { name: /expression/i }),
    ).toBeTruthy()
    expect(screen.queryByText('Coming soon')).toBeNull()
  })

  it('opens a working research view', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.contextMenu(sidebarButton(/research/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    expect(screen.getByRole('textbox', { name: /search/i })).toBeTruthy()
    expect(screen.queryByText('Coming soon')).toBeNull()
  })

  it('opens a working chatbot', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.contextMenu(sidebarButton(/tutor/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    expect(screen.getByRole('textbox', { name: /message/i })).toBeTruthy()
    expect(screen.queryByText('Coming soon')).toBeNull()
  })

  it('does not show coming soon for the notebook', () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.contextMenu(sidebarButton(/notebook/i))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    expect(screen.queryByText('Coming soon')).toBeNull()
  })
})

describe('T07e settings popup', () => {
  it('opens settings in a centered popup from the sidebar', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/settings/i))
    expect(
      await screen.findByRole('dialog', { name: 'Settings' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.getByRole('tablist').querySelectorAll('[role="tab"]'),
    ).toHaveLength(0)
  })

  it('opens settings from the top menu', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(menuTrigger('Settings'))
    fireEvent.click(screen.getByRole('menuitem', { name: /open settings/i }))
    expect(
      await screen.findByRole('dialog', { name: 'Settings' }),
    ).toBeTruthy()
  })

  it('closes the popup from its close button', async () => {
    seedLanguage()
    render(<App />)
    enterAsGuest()
    fireEvent.click(sidebarButton(/settings/i))
    await screen.findByRole('dialog', { name: 'Settings' })
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
