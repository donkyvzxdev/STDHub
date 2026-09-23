import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import {
  drawingMarkdown,
  insertionIndex,
  parseStmd,
  replaceBlockLines,
  type StmdBlock,
} from '@/lib/stmd'
import { StudyBlock } from './StudyNotebook'

export interface StudyLiveHandle {
  /**
   * Google-Docs style: with a selection open, wraps it and commits at once
   * (the style just activates — no raw syntax stays on screen). With a
   * collapsed caret, inserts the pair and keeps editing so typing lands
   * inside it. Without an open editor, starts a trailing paragraph first.
   */
  wrapSelection(before: string, after: string): void
  /** Appends a block template at the end and opens it for editing. */
  insertBlock(template: string): void
  /** Appends a block silently (e.g. pen drawings). */
  appendBlock(text: string): void
  /** Enters freehand draw-over-the-page mode. */
  startDraw(): void
}

interface StudyLiveProps {
  content: string
  /** Commits new full content (parent marks dirty). */
  onChange: (value: string) => void
  onToggleTask: (line: number) => void
}

interface Editing {
  start: number
  endExclusive: number
}

interface CtxMenu {
  x: number
  y: number
  block: number | null
  /** Gap line for creates (first block below the pointer, else append). */
  insertAt?: number
  /** Typing-exclusive menu inside the block editor. */
  typing?: boolean
}

const INTERACTIVE_SELECTOR =
  'button, input, a, label, textarea, summary, select'

const DRAW_COLORS = ['#ffffff', '#facc15', '#38bdf8', '#f87171', '#4ade80']
const DRAW_WIDTHS = [3, 6, 10]

function blockEnd(blocks: StmdBlock[], index: number, lineCount: number): number {
  return index + 1 < blocks.length ? blocks[index + 1].line : lineCount
}

/**
 * Obsidian-style StudyMD editing (`.stmd` only): the file renders as a
 * notebook and clicking a block edits just that block's source. Blur or
 * Ctrl+Enter commits, Escape cancels. Right-click opens the block menu
 * (delete/duplicate/insert). The pen draws straight over the page and the
 * ink lands as an image block. Other file types keep Monaco untouched.
 */
const StudyLive = forwardRef<StudyLiveHandle, StudyLiveProps>(
  function StudyLive({ content, onChange, onToggleTask }, ref) {
    const { t } = useTranslation()
    const blocks = useMemo(() => parseStmd(content), [content])
    const lines = useMemo(() => content.split('\n'), [content])
    const [editing, setEditing] = useState<Editing | null>(null)
    const editingRef = useRef<Editing | null>(null)
    editingRef.current = editing
    const areaRef = useRef<HTMLTextAreaElement | null>(null)
    const caretRef = useRef<number | [number, number] | null>(null)
    // Instant-apply (toolbar) commits itself; a trailing blur must not
    // recommit stale textarea content over it.
    const skipCommitRef = useRef(false)
    const [menu, setMenu] = useState<CtxMenu | null>(null)
    const [drawing, setDrawing] = useState(false)
    const articleRef = useRef<HTMLElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const drawState = useRef({
      down: false,
      last: null as { x: number; y: number } | null,
      drew: false,
      color: DRAW_COLORS[0],
      width: DRAW_WIDTHS[1],
    })
    const [drawColor, setDrawColor] = useState(DRAW_COLORS[0])
    const [drawWidth, setDrawWidth] = useState(DRAW_WIDTHS[1])

    function openBlock(index: number): void {
      const block = blocks[index]
      if (!block) return
      // Trailing blanks belong to the separators, not to the draft.
      let end = blockEnd(blocks, index, lines.length)
      while (end > block.line && lines[end - 1] === '') end--
      caretRef.current = null
      setEditing({ start: block.line, endExclusive: end })
    }

    function sliceOf(range: Editing): string {
      return lines.slice(range.start, range.endExclusive).join('\n')
    }

    function commit(): void {
      if (skipCommitRef.current) {
        skipCommitRef.current = false
        return
      }
      const range = editingRef.current
      const area = areaRef.current
      if (!range || !area) return
      const draft = area.value
      if (draft.trimEnd() === sliceOf(range).trimEnd()) {
        setEditing(null)
        return
      }
      onChange(replaceBlockLines(content, range.start, range.endExclusive, draft))
      setEditing(null)
    }

    function cancel(): void {
      setEditing(null)
    }

    // Trailing paragraph used when a wrap has nowhere to land.
    function trailingStart(): number {
      const trimmed = [...lines]
      while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
        trimmed.pop()
      }
      return trimmed.length + (trimmed.length > 0 ? 1 : 0)
    }

    /** Inserts template at an arbitrary line index and opens it. */
    function insertAt(
      index: number,
      template: string,
      select?: [number, number] | number,
    ): void {
      const head = lines.slice(0, Math.max(0, index))
      while (head.length > 0 && head[head.length - 1] === '') head.pop()
      const start = head.length + (head.length > 0 ? 1 : 0)
      onChange(
        replaceBlockLines(content, index, index, template),
      )
      caretRef.current = select ?? null
      setEditing({
        start,
        endExclusive: start + template.split('\n').length,
      })
    }

    useImperativeHandle(
      ref,
      () => ({
        wrapSelection(before: string, after: string): void {
          const range = editingRef.current
          const area = areaRef.current
          if (!range || !area) {
            // Nowhere open: start a trailing paragraph, then wrap empty.
            const start = trailingStart()
            const pair = `${before}${after}`
            onChange(replaceBlockLines(content, start, start, pair))
            setEditing({ start, endExclusive: start + 1 })
            caretRef.current = before.length
            return
          }
          const s = area.selectionStart
          const e = area.selectionEnd
          const draft = area.value
          const selected = draft.slice(s, e)
          const wrapped = `${draft.slice(0, s)}${before}${selected}${after}${draft.slice(e)}`
          if (selected) {
            skipCommitRef.current = true
            area.value = wrapped
            onChange(replaceBlockLines(content, range.start, range.endExclusive, wrapped))
            setEditing(null)
            return
          }
          area.value = wrapped
          autosize(area)
          area.focus()
          area.setSelectionRange(s + before.length, s + before.length)
        },
        insertBlock(template: string): void {
          insertAt(lines.length, template)
        },
        appendBlock(text: string): void {
          onChange(replaceBlockLines(content, lines.length, lines.length, text))
        },
        startDraw(): void {
          setMenu(null)
          setEditing(null)
          drawState.current.drew = false
          setDrawing(true)
        },
      }),
    )

    function autosize(area: HTMLTextAreaElement): void {
      area.style.height = 'auto'
      area.style.height = `${area.scrollHeight}px`
    }

    /** Empty editors hint their kind (`# ` → heading) or show lorem. */
    function placeholderFor(text: string): string {
      if (/^#{1,6}\s/.test(text)) return t('study.toolHeading')
      if (/^>\s?/.test(text)) return t('study.toolQuote')
      if (/^[-*]\s\[[ xX]\]/.test(text)) return t('study.toolTask')
      if (/^([-*+]|\d+[.)])\s/.test(text)) return t('study.toolList')
      if (/^```/.test(text)) return t('study.toolCalc')
      if (/^:::flashcard/.test(text)) return t('study.toolFlash')
      if (/^:::quiz/.test(text)) return t('study.toolQuiz')
      if (/^:::/.test(text)) return t('study.toolCallout')
      if (/^#stdcalc/.test(text)) return t('study.toolInlineCalc')
      if (/^#stdmarker/.test(text)) return t('study.toolInlineMarker')
      return 'Lorem ipsum dolor sit amet…'
    }

    function deleteBlock(index: number): void {
      const block = blocks[index]
      if (!block) return
      setMenu(null)
      onChange(
        replaceBlockLines(content, block.line, blockEnd(blocks, index, lines.length), ''),
      )
    }

    function duplicateBlock(index: number): void {
      const block = blocks[index]
      if (!block) return
      const end = blockEnd(blocks, index, lines.length)
      const slice = lines.slice(block.line, end).join('\n').trimEnd()
      setMenu(null)
      if (slice === '') return
      onChange(replaceBlockLines(content, end, end, slice))
    }

    // --- draw mode ---------------------------------------------------------
    useEffect(() => {
      if (!drawing) return
      const article = articleRef.current
      const canvas = canvasRef.current
      if (!article || !canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(article.clientWidth * dpr))
      canvas.height = Math.max(1, Math.floor(article.scrollHeight * dpr))
    }, [drawing, content])

    function drawPos(e: React.PointerEvent): { x: number; y: number } | null {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      }
    }

    function drawCtx(): CanvasRenderingContext2D | null {
      const canvas = canvasRef.current
      if (!canvas) return null
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const dpr = window.devicePixelRatio || 1
      ctx.strokeStyle = drawState.current.color
      ctx.lineWidth = drawState.current.width * dpr
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      return ctx
    }

    function finishDraw(save: boolean): void {
      const canvas = canvasRef.current
      if (save && drawState.current.drew && canvas) {
        try {
          const url = canvas.toDataURL('image/png')
          if (url && url.length > 100) {
            onChange(
              replaceBlockLines(
                content,
                lines.length,
                lines.length,
                drawingMarkdown(url),
              ),
            )
          }
        } catch {
          // Canvas unavailable — just leave draw mode.
        }
      }
      drawState.current.down = false
      drawState.current.last = null
      setDrawing(false)
    }

    // --- context menu ------------------------------------------------------
    useEffect(() => {
      if (!menu) return
      function onKey(e: KeyboardEvent): void {
        if (e.key === 'Escape') setMenu(null)
      }
      function onPointer(e: PointerEvent): void {
        const target = e.target as HTMLElement
        if (target.closest('[data-ctx-menu]')) return
        setMenu(null)
      }
      function onScroll(): void {
        setMenu(null)
      }
      window.addEventListener('keydown', onKey)
      window.addEventListener('pointerdown', onPointer)
      window.addEventListener('scroll', onScroll, true)
      return () => {
        window.removeEventListener('keydown', onKey)
        window.removeEventListener('pointerdown', onPointer)
        window.removeEventListener('scroll', onScroll, true)
      }
    }, [menu])

    // Context-menu creates come pre-filled (and selected) so the box never
    // sits in a weird empty state.
    const NEW_TITLE = `# ${t('study.toolHeading')}`
    const NEW_SUBTITLE = `## ${t('study.toolHeading')}`
    const NEW_TEXT = 'Lorem ipsum dolor sit amet…'

    /** Typing-menu helpers: operate on the open editor, pre-commit. */
    function typingArea(): HTMLTextAreaElement | null {
      return areaRef.current
    }

    function lineBounds(
      value: string,
      offset: number,
    ): [number, number] {
      const start = value.lastIndexOf('\n', offset - 1) + 1
      let end = value.indexOf('\n', offset)
      if (end < 0) end = value.length
      return [start, end]
    }

    async function typingCopy(): Promise<void> {
      const ta = typingArea()
      if (!ta) return
      const s = ta.selectionStart
      const e = ta.selectionEnd
      const text =
        s !== e
          ? ta.value.slice(s, e)
          : ta.value.slice(...lineBounds(ta.value, s))
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        try {
          if (typeof document.execCommand === 'function') {
            const had = [ta.selectionStart, ta.selectionEnd]
            ta.select()
            document.execCommand('copy')
            ta.setSelectionRange(had[0], had[1])
          }
        } catch {
          // Clipboard unavailable — nothing to do.
        }
      }
      setMenu(null)
    }

    async function typingPaste(): Promise<void> {
      const ta = typingArea()
      if (!ta) return
      setMenu(null)
      try {
        const text = await navigator.clipboard.readText()
        if (!text) return
        const s = ta.selectionStart
        const e = ta.selectionEnd
        ta.value = ta.value.slice(0, s) + text + ta.value.slice(e)
        ta.focus()
        ta.setSelectionRange(s + text.length, s + text.length)
      } catch {
        // Clipboard unreadable — paste stays a keyboard job.
      }
    }

    function typingSelectAll(): void {
      const ta = typingArea()
      setMenu(null)
      if (!ta) return
      ta.focus()
      ta.select()
    }

    function typingDelete(): void {
      const ta = typingArea()
      setMenu(null)
      if (!ta) return
      const s = ta.selectionStart
      const e = ta.selectionEnd
      if (s !== e) {
        ta.value = ta.value.slice(0, s) + ta.value.slice(e)
        ta.focus()
        ta.setSelectionRange(s, s)
        return
      }
      // Collapsed: drop the whole line (VSCode-style).
      const [ls, le] = lineBounds(ta.value, s)
      // Drop the line plus one adjacent newline when there is one.
      const hasNext = ta.value[le] === '\n'
      const dropStart = hasNext ? ls : ls > 0 ? ls - 1 : ls
      const dropEnd = hasNext ? le + 1 : le
      ta.value = ta.value.slice(0, dropStart) + ta.value.slice(dropEnd)
      ta.focus()
      ta.setSelectionRange(dropStart, dropStart)
    }

    /** "Deletar": drops the whole open block (title, text, …). */
    function typingDeleteBlock(): void {
      const range = editingRef.current
      setMenu(null)
      if (!range) return
      onChange(replaceBlockLines(content, range.start, range.endExclusive, ''))
      setEditing(null)
    }

    function typingDuplicate(): void {
      const ta = typingArea()
      setMenu(null)
      if (!ta) return
      const s = ta.selectionStart
      const e = ta.selectionEnd
      if (s !== e) {
        const copy = ta.value.slice(s, e)
        ta.value = ta.value.slice(0, e) + copy + ta.value.slice(e)
        ta.focus()
        ta.setSelectionRange(e, e + copy.length)
        return
      }
      // Collapsed: duplicate the line below (VSCode-style).
      const [ls, le] = lineBounds(ta.value, s)
      const lineText = ta.value.slice(ls, le)
      const tail = le < ta.value.length
      ta.value = tail
        ? ta.value.slice(0, le) + `\n${lineText}` + ta.value.slice(le)
        : `${ta.value}\n${lineText}`
      ta.focus()
      const atCaret = tail ? le + lineText.length + 1 : ta.value.length
      ta.setSelectionRange(atCaret, atCaret)
    }
    const menuItems: { label: string; run: () => void }[] =
      menu == null
        ? []
          : menu.typing
            ? [
                { label: t('study.typingCopy'), run: () => void typingCopy() },
                { label: t('study.typingPaste'), run: () => void typingPaste() },
                { label: t('study.typingSelectAll'), run: typingSelectAll },
                { label: t('study.typingDelete'), run: typingDelete },
                { label: t('study.typingDeleteBlock'), run: typingDeleteBlock },
                { label: t('study.typingDuplicate'), run: typingDuplicate },
              ]
          : menu.block == null
            ? [
                {
                  label: t('study.createTitleBetween'),
                  run: () => {
                    const at = menu.insertAt ?? lines.length
                    setMenu(null)
                    insertAt(at, NEW_TITLE, [2, NEW_TITLE.length])
                  },
                },
                {
                  label: t('study.createSubtitleBetween'),
                  run: () => {
                    const at = menu.insertAt ?? lines.length
                    setMenu(null)
                    insertAt(at, NEW_SUBTITLE, [3, NEW_SUBTITLE.length])
                  },
                },
                {
                  label: t('study.createTextBetween'),
                  run: () => {
                    const at = menu.insertAt ?? lines.length
                    setMenu(null)
                    insertAt(at, NEW_TEXT, [0, NEW_TEXT.length])
                  },
                },
              ]
            : [
                {
                  label: t('study.deleteBlock'),
                  run: () => deleteBlock(menu.block as number),
                },
                {
                  label: t('study.duplicateBlock'),
                  run: () => duplicateBlock(menu.block as number),
                },
              ]

    return (
      <article
        ref={articleRef as React.Ref<HTMLElement>}
        data-testid="study-live"
        onContextMenu={(e) => {
          if (drawing) return
          e.preventDefault()
          const target = e.target as HTMLElement
          // The block editor has its own typing menu (handled there with
          // stopPropagation) — never show the block menu over it.
          if (target.closest('[data-testid="study-block-editor"]')) return
          const wrap = target.closest('[data-block-index]')
          if (wrap) {
            setMenu({
              x: e.clientX,
              y: e.clientY,
              block: Number(wrap.getAttribute('data-block-index')),
            })
            return
          }
          // Gap (or empty padding): create in between — the first block
          // below the pointer, else the end.
          const tops: { line: number; top: number }[] = []
          articleRef.current
            ?.querySelectorAll('[data-block-index]')
            .forEach((el) => {
              const idx = Number(el.getAttribute('data-block-index'))
              const block = blocks[idx]
              if (block) {
                tops.push({
                  line: block.line,
                  top: el.getBoundingClientRect().top,
                })
              }
            })
          setMenu({
            x: e.clientX,
            y: e.clientY,
            block: null,
            insertAt: insertionIndex(tops, e.clientY, lines.length),
          })
        }}
        className="relative mx-auto w-full max-w-3xl flex-1 space-y-1 overflow-y-auto break-words px-6 py-5"
      >
        {drawing ? (
          <div className="sticky top-0 z-20 mb-2 flex flex-wrap items-center gap-1 rounded-lg border bg-popover p-2 shadow-lg">
            <span className="px-1 text-xs font-medium">{t('study.draw')}</span>
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => {
                  drawState.current.color = c
                  setDrawColor(c)
                }}
                style={{ backgroundColor: c }}
                className={`size-6 rounded-full border-2 ${drawColor === c ? 'border-primary' : 'border-transparent'}`}
              />
            ))}
            {DRAW_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                aria-label={String(w)}
                onClick={() => {
                  drawState.current.width = w
                  setDrawWidth(w)
                }}
                className={`rounded-md px-2 py-1 text-xs ${drawWidth === w ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
              >
                {w}
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => {
                const canvas = canvasRef.current
                const ctx = canvas?.getContext('2d')
                if (canvas && ctx) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height)
                }
                drawState.current.drew = false
              }}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {t('study.clear')}
            </button>
            <button
              type="button"
              onClick={() => finishDraw(false)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => finishDraw(true)}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              {t('study.done')}
            </button>
          </div>
        ) : null}
        {drawing ? (
          <canvas
            ref={canvasRef}
            data-testid="study-draw-canvas"
            style={{ height: articleRef.current?.scrollHeight }}
            className="absolute inset-x-6 top-0 z-10 w-[calc(100%-3rem)] cursor-crosshair touch-none"
            onPointerDown={(e) => {
              const ctx = drawCtx()
              const pos = drawPos(e)
              if (!ctx || !pos) return
              drawState.current.down = true
              drawState.current.last = pos
              e.currentTarget.setPointerCapture(e.pointerId)
              ctx.beginPath()
              ctx.moveTo(pos.x, pos.y)
              ctx.lineTo(pos.x + 0.1, pos.y + 0.1)
              ctx.stroke()
              drawState.current.drew = true
            }}
            onPointerMove={(e) => {
              if (!drawState.current.down) return
              const ctx = drawCtx()
              const pos = drawPos(e)
              const last = drawState.current.last
              if (!ctx || !pos || !last) return
              ctx.beginPath()
              ctx.moveTo(last.x, last.y)
              ctx.lineTo(pos.x, pos.y)
              ctx.stroke()
              drawState.current.last = pos
              drawState.current.drew = true
            }}
            onPointerUp={() => {
              drawState.current.down = false
              drawState.current.last = null
            }}
            onPointerCancel={() => {
              drawState.current.down = false
              drawState.current.last = null
            }}
          />
        ) : null}
        {blocks.length === 0 && !editing ? (
          <NewNote onCommit={onChange} />
        ) : null}
        {blocks.map((block, i) => {
          const isOpen = editing != null && editing.start === block.line
          if (isOpen) {
            const draft = sliceOf(editing)
            return (
              <BlockEditor
                key={`edit-${block.line}`}
                initial={draft}
                caret={caretRef.current}
                areaRef={areaRef}
                onCommit={commit}
                onCancel={cancel}
                onTypingMenu={(x, y) =>
                  setMenu({ x, y, block: null, typing: true })
                }
                placeholder={placeholderFor(draft)}
              />
            )
          }
          return (
            <div
              key={`${block.line}-${i}`}
              data-block-index={i}
              role="button"
              tabIndex={0}
              aria-label={t('study.editBlock')}
              onClick={(e) => {
                if (drawing) return
                const target = e.target as HTMLElement
                if (target.closest(INTERACTIVE_SELECTOR)) return
                openBlock(i)
              }}
              onDoubleClick={() => {
                if (!drawing) openBlock(i)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !drawing) openBlock(i)
              }}
              className="cursor-text rounded-md px-2 py-1 transition hover:bg-accent/40"
            >
              <StudyBlock block={block} onToggleTask={onToggleTask} />
            </div>
          )
        })}
        {editing && !blocks.some((b) => b.line === editing.start) ? (
          <BlockEditor
            key={`edit-extra-${editing.start}`}
            initial={sliceOf(editing)}
            caret={caretRef.current}
            areaRef={areaRef}
            onCommit={commit}
            onCancel={cancel}
            onTypingMenu={(x, y) =>
              setMenu({ x, y, block: null, typing: true })
            }
            placeholder={placeholderFor(sliceOf(editing))}
          />
        ) : null}
        {menu ? (
          <div
            data-ctx-menu
            role="menu"
            // Typing menu acts on the live textarea: holding mousedown keeps
            // focus (no blur-commit) so the action lands. Block menus keep
            // the native order (blur commits first, then the action).
            onMouseDown={menu.typing ? (e) => e.preventDefault() : undefined}
            style={{
              left: Math.min(menu.x, window.innerWidth - 220),
              top: Math.min(menu.y, window.innerHeight - menuItems.length * 36 - 16),
            }}
            className="fixed z-50 w-52 rounded-md border bg-popover p-1 shadow-lg"
          >
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={item.run}
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </article>
    )
  },
)

/** New-note header: title on top, text box right below, committed together. */
function NewNote({ onCommit }: { onCommit: (value: string) => void }) {
  const { t } = useTranslation()
  const titleRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  function commit(): void {
    const title = titleRef.current?.value.trim() ?? ''
    const body = bodyRef.current?.value.trimEnd() ?? ''
    if (title === '' && body === '') return
    onCommit(`${title === '' ? '' : `# ${title}\n\n`}${body}`)
  }

  function maybeCommit(e: React.FocusEvent): void {
    const root = e.currentTarget
    // Blur hopping between title and body must not commit half a note.
    window.setTimeout(() => {
      if (root.contains(document.activeElement)) return
      commit()
    }, 0)
  }

  return (
    <div onBlur={maybeCommit} className="flex flex-col gap-2 py-4">
      <input
        ref={titleRef}
        data-testid="study-note-title"
        placeholder={t('study.noteTitle')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            bodyRef.current?.focus()
          }
        }}
        className="bg-transparent text-3xl font-bold focus:outline-none placeholder:text-muted-foreground/50"
      />
      <textarea
        ref={bodyRef}
        data-testid="study-note-body"
        placeholder={t('study.noteBody')}
        rows={8}
        className="w-full resize-none rounded-md border border-dashed bg-transparent p-3 text-sm leading-6 focus:border-primary/50 focus:outline-none"
      />
    </div>
  )
}

function BlockEditor({
  initial,
  caret,
  areaRef,
  onCommit,
  onCancel,
  onTypingMenu,
  placeholder,
}: {
  initial: string
  caret: number | [number, number] | null
  areaRef: { current: HTMLTextAreaElement | null }
  onCommit: () => void
  onCancel: () => void
  onTypingMenu: (x: number, y: number) => void
  placeholder: string
}) {
  const { t } = useTranslation()
  const localRef = useRef<HTMLTextAreaElement | null>(null)
  // Right-mousedown collapses the selection natively before React sees it;
  // snapshot it here so the typing menu can restore exactly what the press
  // destroyed (Docs-style). Anything older is a genuine caret move.
  const pressRef = useRef<{
    range: [number, number]
    len: number
    at: number
  } | null>(null)

  useEffect(() => {
    const area = localRef.current
    areaRef.current = area
    if (area) {
      area.focus()
      if (Array.isArray(caret)) {
        area.setSelectionRange(caret[0], caret[1])
      } else {
        const at = caret ?? area.value.length
        area.setSelectionRange(at, at)
      }
      area.style.height = 'auto'
      area.style.height = `${area.scrollHeight}px`
    }
    return () => {
      areaRef.current = null
    }
  }, [areaRef, caret])

  return (
    <div className="rounded-md border border-primary/50 bg-background focus-within:border-primary">
      <textarea
        ref={localRef}
        data-testid="study-block-editor"
        defaultValue={initial}
        placeholder={placeholder}
        rows={Math.max(1, initial.split('\n').length)}
        onInput={(e) => {
          const area = e.currentTarget
          area.style.height = 'auto'
          area.style.height = `${area.scrollHeight}px`
        }}
        onBlur={onCommit}
        onMouseDown={(e) => {
          if (e.button !== 2) return
          const ta = e.currentTarget
          pressRef.current = {
            range: [ta.selectionStart, ta.selectionEnd],
            len: ta.value.length,
            at: Date.now(),
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const ta = e.currentTarget
          const press = pressRef.current
          pressRef.current = null
          if (
            ta.selectionStart === ta.selectionEnd &&
            press &&
            press.range[0] < press.range[1] &&
            press.len === ta.value.length &&
            Date.now() - press.at < 1000
          ) {
            ta.setSelectionRange(press.range[0], press.range[1])
          }
          onTypingMenu(e.clientX, e.clientY)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        className="w-full resize-none overflow-x-hidden bg-transparent px-3 pt-2 pb-1 font-mono text-[13px] leading-6 break-words placeholder:text-muted-foreground/50 focus:outline-none"
      />
      <div className="flex justify-end px-2 pt-1 pb-2">
        <button
          type="button"
          data-testid="study-block-save"
          aria-label={t('explorer.save')}
          title={t('explorer.save')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCommit}
          className="rounded-md bg-primary p-1.5 text-primary-foreground shadow hover:opacity-90"
        >
          <Save className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export default StudyLive
