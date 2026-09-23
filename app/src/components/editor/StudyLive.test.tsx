import { useState } from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudyLive, { type StudyLiveHandle } from './StudyLive'
import '../../lib/i18n'

function Harness({
  initial,
  onChange,
}: {
  initial: string
  onChange?: (value: string) => void
}) {
  const [content, setContent] = useState(initial)
  return (
    <StudyLive
      content={content}
      onChange={(v) => {
        setContent(v)
        onChange?.(v)
      }}
      onToggleTask={() => undefined}
    />
  )
}

function LiveHarness({
  initial,
  liveRef,
  onCommit,
}: {
  initial: string
  liveRef: { current: StudyLiveHandle | null }
  onCommit?: (value: string) => void
}) {
  const [content, setContent] = useState(initial)
  return (
    <StudyLive
      ref={liveRef}
      content={content}
      onChange={(v) => {
        setContent(v)
        onCommit?.(v)
      }}
      onToggleTask={() => undefined}
    />
  )
}

describe('StudyLive', () => {
  it('renders blocks without any editor open', () => {
    render(<Harness initial={'# Título\n\ntexto aqui\n'} />)
    expect(screen.getByText('Título')).toBeTruthy()
    expect(screen.getByText('texto aqui')).toBeTruthy()
    expect(screen.queryByTestId('study-block-editor')).toBeNull()
  })

  it('opens the clicked block for editing and commits on blur', () => {
    const onChange = vi.fn()
    render(<Harness initial={'# Título\n\ntexto aqui\n'} onChange={onChange} />)
    fireEvent.click(screen.getByText('texto aqui'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    expect(editor.value).toBe('texto aqui')
    fireEvent.change(editor, { target: { value: 'texto novo' } })
    fireEvent.blur(editor)
    expect(onChange).toHaveBeenCalledWith('# Título\n\ntexto novo\n')
    expect(screen.getByText('texto novo')).toBeTruthy()
  })

  it('cancels on Escape without committing', () => {
    const onChange = vi.fn()
    render(<Harness initial={'texto aqui\n'} onChange={onChange} />)
    fireEvent.click(screen.getByText('texto aqui'))
    const editor = screen.getByTestId('study-block-editor')
    fireEvent.change(editor, { target: { value: 'descartado' } })
    fireEvent.keyDown(editor, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('texto aqui')).toBeTruthy()
  })

  it('ignores clicks on interactive elements', () => {
    render(<Harness initial={'- [ ] uma\n'} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.queryByTestId('study-block-editor')).toBeNull()
  })

  it('wraps the selection Docs-style and commits at once', () => {
    const liveRef: { current: StudyLiveHandle | null } = { current: null }
    render(<LiveHarness initial={'texto aqui\n'} liveRef={liveRef} />)
    fireEvent.click(screen.getByText('texto aqui'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    editor.setSelectionRange(0, 5)
    act(() => {
      liveRef.current?.wrapSelection('**', '**')
    })
    expect(screen.queryByTestId('study-block-editor')).toBeNull()
    expect(screen.getByText('texto').tagName).toBe('STRONG')
  })

  it('appends blocks and opens them for editing', () => {
    const liveRef: { current: StudyLiveHandle | null } = { current: null }
    render(<LiveHarness initial={'# Título\n'} liveRef={liveRef} />)
    act(() => {
      liveRef.current?.insertBlock(':::flashcard\nq\n---\na\n:::')
    })
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    expect(editor.value).toBe(':::flashcard\nq\n---\na\n:::')
  })

  it('forwards task toggles with source lines', () => {
    const onToggleTask = vi.fn()
    render(
      <StudyLive
        content={'- [ ] uma\n'}
        onChange={() => undefined}
        onToggleTask={onToggleTask}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggleTask).toHaveBeenCalledWith(0)
  })

  it('commits title plus body for new notes', async () => {
    const onCommit = vi.fn()
    render(
      <StudyLive
        content={''}
        onChange={onCommit}
        onToggleTask={() => undefined}
      />,
    )
    fireEvent.change(screen.getByTestId('study-note-title'), {
      target: { value: 'Minha nota' },
    })
    const body = screen.getByTestId('study-note-body')
    fireEvent.change(body, { target: { value: 'conteúdo aqui' } })
    fireEvent.blur(body)
    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledWith('# Minha nota\n\nconteúdo aqui')
    })
  })

  it('does not commit an untouched new note', async () => {
    const onCommit = vi.fn()
    render(
      <StudyLive
        content={''}
        onChange={onCommit}
        onToggleTask={() => undefined}
      />,
    )
    fireEvent.blur(screen.getByTestId('study-note-body'))
    await waitFor(() => {
      expect(onCommit).not.toHaveBeenCalled()
    })
  })

  it('deletes a block from its context menu', () => {
    const onCommit = vi.fn()
    render(
      <StudyLive
        content={'# A\n\ntexto\n'}
        onChange={onCommit}
        onToggleTask={() => undefined}
      />,
    )
    fireEvent.contextMenu(screen.getByText('texto'))
    fireEvent.click(screen.getByRole('menuitem', { name: /delete block/i }))
    expect(onCommit).toHaveBeenCalledWith('# A\n')
    expect(screen.queryByRole('menuitem', { name: /delete block/i })).toBeNull()
  })

  it('duplicates a block from its context menu', () => {
    render(<LiveHarness initial={'# A\n\ntexto\n'} liveRef={{ current: null }} />)
    fireEvent.contextMenu(screen.getByText('texto'))
    fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }))
    expect(screen.getAllByText('texto')).toHaveLength(2)
  })

  it('creates a title from the empty-area menu', () => {
    render(<LiveHarness initial={'texto\n'} liveRef={{ current: null }} />)
    fireEvent.contextMenu(screen.getByTestId('study-live'))
    fireEvent.click(screen.getByRole('menuitem', { name: /create title in between/i }))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    expect(editor.value).toBe('# Heading')
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 9])
  })

  it('keeps only duplicate and delete on blocks', () => {
    render(<LiveHarness initial={'texto\n'} liveRef={{ current: null }} />)
    fireEvent.contextMenu(screen.getByText('texto'))
    expect(
      screen.getByRole('menuitem', { name: /duplicate block/i }),
    ).toBeTruthy()
    expect(
      screen.getByRole('menuitem', { name: /delete block/i }),
    ).toBeTruthy()
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
    expect(
      screen.queryByRole('menuitem', { name: /insert title/i }),
    ).toBeNull()
  })

  it('offers creates on empty-area right-click', () => {
    render(<LiveHarness initial={'# A\n'} liveRef={{ current: null }} />)
    fireEvent.contextMenu(screen.getByTestId('study-live'))
    expect(
      screen.getByRole('menuitem', { name: /create subtitle in between/i }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('menuitem', { name: /delete block/i }),
    ).toBeNull()
  })

  it('closes the menu on Escape', () => {
    render(<LiveHarness initial={'texto\n'} liveRef={{ current: null }} />)
    fireEvent.contextMenu(screen.getByText('texto'))
    expect(screen.getByRole('menuitem', { name: /delete block/i })).toBeTruthy()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('menuitem', { name: /delete block/i })).toBeNull()
  })

  it('toggles draw mode and cancels cleanly', () => {    const liveRef: { current: StudyLiveHandle | null } = { current: null }
    render(<LiveHarness initial={'# A\n'} liveRef={liveRef} />)
    act(() => {
      liveRef.current?.startDraw()
    })
    expect(screen.getByTestId('study-draw-canvas')).toBeTruthy()
    expect(screen.getByRole('button', { name: /done/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByTestId('study-draw-canvas')).toBeNull()
  })

  it('done without strokes commits nothing', () => {
    const onCommit = vi.fn()
    const liveRef: { current: StudyLiveHandle | null } = { current: null }
    render(
      <StudyLive
        ref={liveRef}
        content={'# A\n'}
        onChange={(v) => {
          onCommit(v)
        }}
        onToggleTask={() => undefined}
      />,
    )
    act(() => {
      liveRef.current?.startDraw()
    })
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.queryByTestId('study-draw-canvas')).toBeNull()
  })

  it('opens an editor for inserted text', () => {
    render(<LiveHarness initial={'texto\n'} liveRef={{ current: null }} />)
    fireEvent.contextMenu(screen.getByTestId('study-live'))
    fireEvent.click(screen.getByRole('menuitem', { name: /create text in between/i }))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    // Pre-filled lorem, fully selected: typing replaces it at once.
    expect(editor.value).toBe('Lorem ipsum dolor sit amet…')
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([
      0,
      'Lorem ipsum dolor sit amet…'.length,
    ])
    fireEvent.change(editor, { target: { value: 'novo' } })
    fireEvent.blur(editor)
    expect(screen.getByText('novo')).toBeTruthy()
  })

  it('hints the block kind in empty editors', () => {
    render(<LiveHarness initial={'texto\n'} liveRef={{ current: null }} />)
    fireEvent.contextMenu(screen.getByTestId('study-live'))
    fireEvent.click(screen.getByRole('menuitem', { name: /create title in between/i }))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    expect(editor.value).toBe('# Heading')
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 9])
    expect(editor).toHaveAttribute('placeholder', 'Heading')
  })

  it('saves from the button inside the box', () => {
    render(<LiveHarness initial={'texto\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('texto'))
    const editor = screen.getByTestId('study-block-editor')
    fireEvent.change(editor, { target: { value: 'salvo' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.queryByTestId('study-block-editor')).toBeNull()
    expect(screen.getByText('salvo')).toBeTruthy()
  })

  it('opens the typing menu inside the editor', () => {
    render(<LiveHarness initial={'texto\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('texto'))
    const editor = screen.getByTestId('study-block-editor')
    fireEvent.contextMenu(editor)
    expect(screen.getByRole('menuitem', { name: /^copy$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^paste$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /select all/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^delete$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^duplicate$/i })).toBeTruthy()
    expect(screen.getAllByRole('menuitem')).toHaveLength(6)
    expect(
      screen.queryByRole('menuitem', { name: /duplicate block/i }),
    ).toBeNull()
  })

  it('selects all from the typing menu', () => {
    render(<LiveHarness initial={'texto aqui\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('texto aqui'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    fireEvent.contextMenu(editor)
    fireEvent.click(screen.getByRole('menuitem', { name: /select all/i }))
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([
      0,
      'texto aqui'.length,
    ])
  })

  it('deletes the selection from the typing menu', () => {
    render(<LiveHarness initial={'texto aqui\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('texto aqui'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    editor.setSelectionRange(0, 5)
    fireEvent.contextMenu(editor)
    fireEvent.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    expect(editor.value).toBe(' aqui')
  })

  it('deletes the whole line with a collapsed caret', () => {
    render(<LiveHarness initial={'a\n\nb\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('b'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    expect(editor.value).toBe('b')
    editor.setSelectionRange(0, 0)
    fireEvent.contextMenu(editor)
    fireEvent.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    expect(editor.value).toBe('')
  })

  it('duplicates the selection from the typing menu', () => {
    render(<LiveHarness initial={'texto aqui\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('texto aqui'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    editor.setSelectionRange(0, 5)
    fireEvent.contextMenu(editor)
    fireEvent.click(screen.getByRole('menuitem', { name: /^duplicate$/i }))
    expect(editor.value).toBe('textotexto aqui')
  })

  it('duplicates the line with a collapsed caret', () => {
    render(<LiveHarness initial={'ab\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('ab'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    editor.setSelectionRange(1, 1)
    fireEvent.contextMenu(editor)
    fireEvent.click(screen.getByRole('menuitem', { name: /^duplicate$/i }))
    expect(editor.value).toBe('ab\nab')
  })

  it('deletes the whole block from the typing menu', () => {
    const onCommit = vi.fn()
    render(
      <StudyLive
        content={'# A\n\ntexto\n'}
        onChange={onCommit}
        onToggleTask={() => undefined}
      />,
    )
    fireEvent.click(screen.getByText('texto'))
    const editor = screen.getByTestId('study-block-editor')
    fireEvent.contextMenu(editor)
    fireEvent.click(screen.getByRole('menuitem', { name: /^delete block$/i }))
    expect(onCommit).toHaveBeenCalledWith('# A\n')
    expect(screen.queryByTestId('study-block-editor')).toBeNull()
  })

  it('keeps the selection when the menu opens off-text', () => {
    render(<LiveHarness initial={'texto aqui\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('texto aqui'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    // Select, then simulate the native collapse of a right press elsewhere.
    editor.setSelectionRange(0, 5)
    fireEvent.mouseDown(editor, { button: 2 })
    editor.setSelectionRange(8, 8)
    fireEvent.contextMenu(editor)
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 5])
    expect(
      screen.getByRole('menuitem', { name: /^duplicate$/i }),
    ).toBeTruthy()
  })

  it('does not resurrect stale selections', () => {
    render(<LiveHarness initial={'texto aqui\n'} liveRef={{ current: null }} />)
    fireEvent.click(screen.getByText('texto aqui'))
    const editor = screen.getByTestId(
      'study-block-editor',
    ) as HTMLTextAreaElement
    // Old selection, then the text changed: restore must not fire.
    editor.setSelectionRange(0, 5)
    fireEvent.mouseDown(editor, { button: 2 })
    editor.setSelectionRange(8, 8)
    fireEvent.change(editor, { target: { value: 'texto aqui!' } })
    fireEvent.contextMenu(editor)
    // The change moved the caret; the stale range must not come back.
    expect([editor.selectionStart, editor.selectionEnd]).not.toEqual([0, 5])
  })
})
