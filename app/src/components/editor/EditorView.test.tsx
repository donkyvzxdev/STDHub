import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorView from './EditorView'
import '../../lib/i18n'
import {
  fsError,
  type FileNode,
  type FileProvider,
} from '../../lib/filesystem'

vi.mock('./CodeEditor', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) => (
    <textarea
      data-testid="mock-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

interface MemEntry {
  isDir: boolean
  content: string
}

class FakeProvider implements FileProvider {
  readonly kind = 'tauri' as const
  files = new Map<string, MemEntry>([
    ['root', { isDir: true, content: '' }],
    ['root/notes', { isDir: true, content: '' }],
    ['root/notes/todo.md', { isDir: false, content: '# Todo\n' }],
    ['root/notes/sub', { isDir: true, content: '' }],
    ['root/docs', { isDir: true, content: '' }],
    ['root/app.ts', { isDir: false, content: 'const x = 1;\n' }],
    ['root/logo.png', { isDir: false, content: 'PNGDATA' }],
    ['root/data.bin', { isDir: false, content: `a${String.fromCharCode(0)}b` }],
  ])

  childrenOf(dir: string): FileNode[] {
    const prefix = `${dir}/`
    const seen = new Map<string, FileNode>()
    for (const [path, entry] of this.files) {
      if (!path.startsWith(prefix)) continue
      const rest = path.slice(prefix.length)
      if (rest === '' || rest.includes('/')) continue
      seen.set(path, { path, name: rest, isDir: entry.isDir })
    }
    return [...seen.values()].sort(
      (a, b) =>
        Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
    )
  }

  async openFolder(): Promise<string | null> {
    return 'root'
  }

  async listDir(path: string): Promise<FileNode[]> {
    const entry = this.files.get(path)
    if (!entry || !entry.isDir) throw fsError('not-found')
    return this.childrenOf(path)
  }

  async readText(path: string): Promise<string> {
    const entry = this.files.get(path)
    if (!entry || entry.isDir) throw fsError('not-found')
    if ([...entry.content].some((c) => c.charCodeAt(0) === 0)) {
      throw fsError('binary')
    }
    if (path.endsWith('.png')) throw new Error('invalid utf-8')
    return entry.content
  }

  async readBinary(path: string): Promise<Uint8Array> {
    const entry = this.files.get(path)
    if (!entry || entry.isDir) throw fsError('not-found')
    return new TextEncoder().encode(entry.content)
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    this.files.set(path, {
      isDir: false,
      content: new TextDecoder().decode(data),
    })
  }

  async writeText(path: string, content: string): Promise<void> {
    const entry = this.files.get(path)
    if (!entry || entry.isDir) throw fsError('not-found')
    entry.content = content
  }

  async createFile(dir: string, name: string): Promise<string> {
    const full = `${dir}/${name}`
    if (this.files.has(full)) throw fsError('exists')
    this.files.set(full, { isDir: false, content: '' })
    return full
  }

  async createDir(dir: string, name: string): Promise<string> {
    const full = `${dir}/${name}`
    if (this.files.has(full)) throw fsError('exists')
    this.files.set(full, { isDir: true, content: '' })
    return full
  }

  async rename(oldPath: string, newName: string): Promise<string> {    const dir = oldPath.split('/').slice(0, -1).join('/')
    const full = `${dir}/${newName}`
    if (this.files.has(full)) throw fsError('exists')
    const entry = this.files.get(oldPath)
    if (!entry) throw fsError('not-found')
    this.files.delete(oldPath)
    this.files.set(full, entry)
    return full
  }

  async remove(path: string): Promise<void> {
    if (!this.files.has(path)) throw fsError('not-found')
    for (const key of [...this.files.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) this.files.delete(key)
    }
  }

  async move(oldPath: string, newPath: string): Promise<void> {
    const entry = this.files.get(oldPath)
    if (!entry) throw fsError('not-found')
    if (this.files.has(newPath)) throw fsError('exists')
    this.files.delete(oldPath)
    this.files.set(newPath, entry)
    if (entry.isDir) {
      for (const [key, value] of [...this.files]) {
        if (key.startsWith(`${oldPath}/`)) {
          this.files.delete(key)
          this.files.set(newPath + key.slice(oldPath.length), value)
        }
      }
    }
  }
}

let provider: FakeProvider
let host: HTMLDivElement
const onOpenFile = vi.fn()

function openRoot(): void {
  fireEvent.click(screen.getByRole('button', { name: /open folder/i }))
}

function row(name: string): HTMLElement {
  const buttons = screen.getAllByRole('button', {
    name: new RegExp(`^${name}$`),
  })
  const rowButton = buttons.find((b) => !b.closest('[role="tablist"]'))
  if (!rowButton) throw new Error(`explorer row ${name} not found`)
  return rowButton
}

function mockHitTest(el: Element | null): void {
  const doc = document as unknown as {
    elementFromPoint: (x: number, y: number) => Element | null
  }
  doc.elementFromPoint = () => el
}

const realHitTest: ((x: number, y: number) => Element | null) | undefined =
  typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint.bind(document)
    : undefined

function startDrag(rowEl: HTMLElement, x = 10, y = 10): void {
  fireEvent.pointerDown(rowEl, { button: 0, clientX: x, clientY: y, pointerId: 1 })
  fireEvent.pointerMove(rowEl, {
    clientX: x + 20,
    clientY: y + 20,
    pointerId: 1,
  })
}

function editorTab(name: string): HTMLElement {
  const tablist = screen.getByRole('tablist')
  const tabs = Array.from(tablist.querySelectorAll('button')).filter((b) =>
    b.textContent?.startsWith(name),
  )
  const tab = tabs[0]
  if (!tab || !(tab instanceof HTMLElement)) {
    throw new Error(`editor tab ${name} not found`)
  }
  return tab
}

beforeEach(() => {
  window.localStorage.clear()
  provider = new FakeProvider()
  onOpenFile.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  render(
    <EditorView provider={provider} explorerHost={host} onOpenFile={onOpenFile} />,
  )
  openRoot()
})

afterEach(() => {
  host.remove()
  const doc = document as unknown as {
    elementFromPoint?: (x: number, y: number) => Element | null
  }
  if (realHitTest) doc.elementFromPoint = realHitTest
  else delete doc.elementFromPoint
})

describe('T07 explorer', () => {
  it('opens a folder and lists top-level entries', async () => {
    expect(await screen.findByText('notes')).toBeTruthy()
    expect(screen.getByText('app.ts')).toBeTruthy()
    expect(screen.queryByText('todo.md')).toBeNull()
  })

  it('expands a directory on click', async () => {
    await screen.findByText('notes')
    fireEvent.click(row('notes'))
    expect(await screen.findByText('todo.md')).toBeTruthy()
    const expanded = document.querySelector('[data-expand="root/notes"]')
    expect(expanded?.className).toContain('grid-rows-[1fr]')
    expect(expanded?.className).toContain('transition-[grid-template-rows]')
  })

  it('opens a file into the editor', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    const editor = (await screen.findByTestId(
      'mock-editor',
    )) as HTMLTextAreaElement
    expect(editor.value).toBe('const x = 1;\n')
    expect(onOpenFile).toHaveBeenCalledWith('root/app.ts')
    const tab = document.querySelector('[role="tab"]')
    expect(tab?.className).toContain('animate-in')
  })

  it('opens images in a preview instead of the editor', async () => {
    window.URL.createObjectURL = vi.fn(
      () => 'blob:fake-logo',
    ) as unknown as typeof URL.createObjectURL
    window.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
    await screen.findByText('app.ts')
    fireEvent.click(row('logo.png'))
    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      'blob:fake-logo',
    )
    expect(onOpenFile).toHaveBeenCalledWith('root/logo.png')
  })

  it('refuses non-image binary files', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('data.bin'))
    expect(await screen.findByText(/binary files/i)).toBeTruthy()
    expect(onOpenFile).not.toHaveBeenCalledWith('root/data.bin')
  })

  it('marks dirty on edit and saves via the save button', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    const editor = (await screen.findByTestId(
      'mock-editor',
    )) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'const x = 2;\n' } })
    expect(editorTab('app.ts').textContent).toContain('•')
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(editorTab('app.ts').textContent).not.toContain('•'),
    )
    expect(provider.files.get('root/app.ts')?.content).toBe('const x = 2;\n')
  })

  it('saves dirty files on Ctrl+S', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    const editor = (await screen.findByTestId(
      'mock-editor',
    )) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'changed\n' } })
    act(() => {
      window.dispatchEvent(
        new window.KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
        }),
      )
    })
    expect(provider.files.get('root/app.ts')?.content).toBe('changed\n')
  })

  it('saves dirty files on the menubar event', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    const editor = (await screen.findByTestId(
      'mock-editor',
    )) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'via menu\n' } })
    act(() => {
      window.dispatchEvent(new CustomEvent('stdhub:save'))
    })
    expect(provider.files.get('root/app.ts')?.content).toBe('via menu\n')
  })

  it('creates a file from the toolbar button', async () => {
    await screen.findByText('notes')
    fireEvent.click(screen.getByRole('button', { name: 'New file' }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'ideas.md' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }))
    const tablist = await screen.findByRole('tablist')
    expect(within(tablist).getByText('ideas.md')).toBeTruthy()
    expect(provider.files.has('root/ideas.md')).toBe(true)
  })

  it('creates a folder from the toolbar button', async () => {
    await screen.findByText('notes')
    fireEvent.click(screen.getByRole('button', { name: 'New folder' }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'study' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }))
    expect(await screen.findByText('study')).toBeTruthy()
    fireEvent.click(row('study'))
    expect(await screen.findByText(/empty folder/i)).toBeTruthy()
  })

  it('creates a file from the directory context menu', async () => {
    await screen.findByText('notes')
    fireEvent.click(row('notes'))
    await screen.findByText('todo.md')
    fireEvent.contextMenu(row('notes'))
    fireEvent.click(screen.getByRole('menuitem', { name: /new file/i }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'ideas.md' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    const tablist = await screen.findByRole('tablist')
    expect(within(tablist).getByText('ideas.md')).toBeTruthy()
    expect(provider.files.has('root/notes/ideas.md')).toBe(true)
  })

  it('renames a file from its context menu', async () => {
    await screen.findByText('app.ts')
    fireEvent.contextMenu(row('app.ts'))
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
    const input = screen.getByLabelText('Name')
    fireEvent.change(input, { target: { value: 'main.ts' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('main.ts')).toBeTruthy()
    expect(provider.files.has('root/main.ts')).toBe(true)
  })

  it('deletes a file only after confirmation', async () => {
    await screen.findByText('app.ts')
    fireEvent.contextMenu(row('app.ts'))
    fireEvent.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.queryByText('app.ts')).toBeNull())
    expect(provider.files.has('root/app.ts')).toBe(false)
  })

  it('asks before closing a dirty tab', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    const editor = (await screen.findByTestId(
      'mock-editor',
    )) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'dirty\n' } })
    fireEvent.click(screen.getByRole('button', { name: /close app\.ts/i }))
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }))
    expect(screen.queryByTestId('mock-editor')).toBeNull()
    expect(provider.files.get('root/app.ts')?.content).toBe('const x = 1;\n')
  })

  it('duplicates a file from its context menu', async () => {
    await screen.findByText('app.ts')
    fireEvent.contextMenu(row('app.ts'))
    fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }))
    expect(await screen.findByText('app copy.ts')).toBeTruthy()
    expect(provider.files.get('root/app copy.ts')?.content).toBe(
      'const x = 1;\n',
    )
  })

  it('copies the path from the context menu', async () => {
    const writes: string[] = []
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          writes.push(text)
          return Promise.resolve()
        },
      },
      configurable: true,
    })
    await screen.findByText('app.ts')
    fireEvent.contextMenu(row('app.ts'))
    fireEvent.click(screen.getByRole('menuitem', { name: /copy path/i }))
    expect(await screen.findByText(/path copied/i)).toBeTruthy()
    expect(writes).toEqual(['root/app.ts'])
  })

  it('reveals the terminal panel from the notebook corner button', async () => {
    await screen.findByText('notes')
    const seen: string[] = []
    const onShow = (): void => {
      seen.push('terminal-show')
    }
    window.addEventListener('stdhub:terminal-show', onShow)
    try {
      fireEvent.click(
        screen.getByRole('button', { name: 'New integrated terminal' }),
      )
      expect(seen).toEqual(['terminal-show'])
    } finally {
      window.removeEventListener('stdhub:terminal-show', onShow)
    }
  })

  it('hides the corner button while the terminal panel is open', async () => {
    await screen.findByText('notes')
    const name = 'New integrated terminal'
    expect(screen.getByRole('button', { name })).toBeTruthy()
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:terminal-visibility', {
          detail: { open: true },
        }),
      )
    })
    expect(screen.queryByRole('button', { name })).toBeNull()
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:terminal-visibility', {
          detail: { open: false },
        }),
      )
    })
    expect(screen.getByRole('button', { name })).toBeTruthy()
  })

  it('saves a chat note into the open folder', async () => {
    await screen.findByText('notes')
    const spyCreate = vi.spyOn(provider, 'createFile')
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:save-note', {
          detail: { name: 'note-x.md', content: '# Hi\n' },
        }),
      )
    })
    await waitFor(() => {
      expect(spyCreate).toHaveBeenCalledWith('root', 'note-x.md')
    })
    // Tree row and open tab share the name — scope each query.
    expect(await within(host).findByText('note-x.md')).toBeTruthy()
    const tablist = screen.getByRole('tablist')
    expect(within(tablist).getByText('note-x.md')).toBeTruthy()
    expect(provider.files.get('root/note-x.md')?.content).toBe('# Hi\n')
  })

  it('renders the tree inside the portal host', async () => {
    expect(await screen.findByText('notes')).toBeTruthy()
    expect(host.textContent).toContain('notes')
    expect(host.textContent).toContain('app.ts')
  })

  it('replaces the preview tab on single click', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    await screen.findByTestId('mock-editor')
    fireEvent.click(row('notes'))
    await screen.findByText('todo.md')
    fireEvent.click(row('todo.md'))
    const tablist = screen.getByRole('tablist')
    await waitFor(() => {
      expect(tablist.querySelectorAll('[role="tab"]')).toHaveLength(1)
    })
    expect(within(tablist).queryByText('app.ts')).toBeNull()
    expect(within(tablist).getByText('todo.md')).toBeTruthy()
  })

  it('pins files via open in new tab', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    await screen.findByTestId('mock-editor')
    fireEvent.contextMenu(row('app.ts'))
    fireEvent.click(screen.getByRole('menuitem', { name: /open in new tab/i }))
    fireEvent.click(row('notes'))
    await screen.findByText('todo.md')
    fireEvent.click(row('todo.md'))
    await screen.findByTestId('mock-editor')
    expect(
      screen.getByRole('tablist').querySelectorAll('[role="tab"]'),
    ).toHaveLength(2)
  })

  it('drops a file onto the tab bar to pin it', async () => {
    await screen.findByText('notes')
    fireEvent.click(row('notes'))
    await screen.findByText('todo.md')
    mockHitTest(screen.getByRole('tablist'))
    const todo = row('todo.md')
    startDrag(todo)
    fireEvent.pointerUp(todo, { clientX: 30, clientY: 30, pointerId: 1 })
    expect(await screen.findByTestId('mock-editor')).toBeTruthy()
    const appRow = row('app.ts')
    fireEvent.pointerDown(appRow, { button: 0, clientX: 5, clientY: 5, pointerId: 2 })
    fireEvent.click(appRow)
    await screen.findByTestId('mock-editor')
    expect(
      screen.getByRole('tablist').querySelectorAll('[role="tab"]'),
    ).toHaveLength(2)
  })

  it('moves a file onto a directory via pointer drag', async () => {
    await screen.findByText('notes')
    fireEvent.click(row('notes'))
    await screen.findByText('todo.md')
    const app = row('app.ts')
    mockHitTest(row('notes'))
    startDrag(app)
    fireEvent.pointerUp(app, { clientX: 30, clientY: 30, pointerId: 1 })
    await waitFor(() =>
      expect(provider.files.has('root/notes/app.ts')).toBe(true),
    )
    expect(provider.files.has('root/app.ts')).toBe(false)
  })

  it('exposes row-level drop targets for pointer drag', async () => {
    await screen.findByText('notes')
    expect(
      row('notes')
        .closest('[data-drop-dir]')
        ?.getAttribute('data-drop-dir'),
    ).toBe('root/notes')
    expect(
      row('app.ts')
        .closest('[data-drop-dir]')
        ?.getAttribute('data-drop-dir'),
    ).toBe('root')
  })

  it('moves a directory with its children', async () => {
    await screen.findByText('docs')
    const notes = row('notes')
    mockHitTest(row('docs'))
    startDrag(notes)
    fireEvent.pointerUp(notes, { clientX: 30, clientY: 30, pointerId: 1 })
    await waitFor(() =>
      expect(provider.files.has('root/docs/notes/todo.md')).toBe(true),
    )
    expect(provider.files.has('root/notes')).toBe(false)
  })

  it('refuses to move a folder into itself', async () => {
    await screen.findByText('notes')
    fireEvent.click(row('notes'))
    await screen.findByText('sub')
    const notes = row('notes')
    mockHitTest(row('sub'))
    startDrag(notes)
    fireEvent.pointerUp(notes, { clientX: 30, clientY: 30, pointerId: 1 })
    expect(await screen.findByText(/into itself/i)).toBeTruthy()
    expect(provider.files.has('root/notes')).toBe(true)
  })

  it('does not toggle on click after a drag', async () => {
    await screen.findByText('notes')
    mockHitTest(null)
    const notes = row('notes')
    startDrag(notes)
    fireEvent.pointerUp(notes, { clientX: 30, clientY: 30, pointerId: 1 })
    fireEvent.click(notes)
    expect(screen.queryByText('todo.md')).toBeNull()
  })

  it('computes drop insertion positions', async () => {
    const { insertionIndex } = await import('../../lib/dragFile')
    expect(insertionIndex(5, [10, 20, 30])).toBe(0)
    expect(insertionIndex(15, [10, 20, 30])).toBe(1)
    expect(insertionIndex(99, [10, 20, 30])).toBe(3)
    expect(insertionIndex(10, [])).toBe(0)
  })

  it('drops open files but keeps the tree when the notebook closes', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    await screen.findByTestId('mock-editor')
    act(() => {
      window.dispatchEvent(new CustomEvent('stdhub:editor-closed'))
    })
    expect(screen.queryByTestId('mock-editor')).toBeNull()
    expect(screen.getByText('app.ts')).toBeTruthy()
  })

  it('asks before dropping dirty files on notebook close', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    const editor = (await screen.findByTestId(
      'mock-editor',
    )) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'dirty\n' } })
    act(() => {
      window.dispatchEvent(new CustomEvent('stdhub:editor-closed'))
    })
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }))
    expect(screen.queryByTestId('mock-editor')).toBeNull()
    expect(provider.files.get('root/app.ts')?.content).toBe('const x = 1;\n')
  })

  it('shows a notice when folders are unsupported', async () => {
    const noneProvider = {
      kind: 'none',
      openFolder: async () => {
        throw fsError('unsupported')
      },
    } as unknown as FileProvider
    render(<EditorView provider={noneProvider} />)
    const buttons = screen.getAllByRole('button', { name: /open folder/i })
    fireEvent.click(buttons[buttons.length - 1])
    expect(await screen.findByText(/needs the desktop app/i)).toBeTruthy()
  })

  it('reveals the notebook when a folder is picked', async () => {
    await screen.findByText('notes')
    expect(onOpenFile).toHaveBeenCalledWith('root')
  })

  it('pins a preview on double-click (VSCode-style)', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    await screen.findByTestId('mock-editor')
    fireEvent.doubleClick(row('app.ts'))
    fireEvent.click(row('notes'))
    await screen.findByText('todo.md')
    fireEvent.click(row('todo.md'))
    await screen.findByTestId('mock-editor')
    expect(
      screen.getByRole('tablist').querySelectorAll('[role="tab"]'),
    ).toHaveLength(2)
  })

  it('pins a preview on edit so unsaved work is kept', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('app.ts'))
    const editor = (await screen.findByTestId(
      'mock-editor',
    )) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'edited\n' } })
    fireEvent.click(row('notes'))
    await screen.findByText('todo.md')
    fireEvent.click(row('todo.md'))
    await waitFor(() => {
      expect(
        screen.getByRole('tablist').querySelectorAll('[role="tab"]'),
      ).toHaveLength(2)
    })
    expect(within(screen.getByRole('tablist')).getByText('app.ts')).toBeTruthy()
  })

  it('does not highlight a file that failed to open', async () => {
    await screen.findByText('app.ts')
    fireEvent.click(row('data.bin'))
    expect(await screen.findByText(/binary files/i)).toBeTruthy()
    expect(row('data.bin').className).not.toContain('bg-accent')
    expect(
      screen.getByRole('tablist').querySelectorAll('[role="tab"]'),
    ).toHaveLength(0)
  })

  it('keeps the tree when a refresh fails', async () => {
    await screen.findByText('notes')
    fireEvent.click(row('notes'))
    await screen.findByText('todo.md')
    const orig = provider.listDir.bind(provider)
    let failed = false
    vi.spyOn(provider, 'listDir').mockImplementation(async (path: string) => {
      if (path === 'root' && !failed) {
        failed = true
        throw fsError('failed')
      }
      return orig(path)
    })
    fireEvent.contextMenu(row('todo.md'))
    fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }))
    expect(await screen.findByText(/something went wrong/i)).toBeTruthy()
    expect(screen.getByText('notes')).toBeTruthy()
    expect(screen.getByText('todo.md')).toBeTruthy()
  })
})
