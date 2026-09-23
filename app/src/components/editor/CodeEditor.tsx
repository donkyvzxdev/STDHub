import { useEffect, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import { installCompletions, registerCompletionSource } from '@/lib/completion'
import { markdownSource } from '@/lib/markdownCompletions'
import { studySource } from '@/lib/studyCompletions'
import { setupMonacoWorkers } from '@/lib/monacoEnv'
import { registerStudyLanguage } from '@/lib/studyLanguage'

export interface EditorHandle {
  undo(): void
  redo(): void
  focus(): void
  /** Wraps the selection (or an empty caret) with a before/after pair. */
  wrapSelection(before: string, after: string): void
  /** Inserts text at the caret; line snippets go to the line start. */
  insertAtCursor(text: string): void
}

interface CodeEditorProps {
  language: string
  value: string
  onChange: (value: string) => void
  onSave: () => void
  handleRef: { current: EditorHandle | null }
}

/**
 * Suggest behavior for every language: built-in services (TS/JS/JSON/CSS/
 * HTML workers) plus word completions from the open document — so code and
 * Markdown both suggest out of the box. The STDHub-specific source plugs in
 * through `registerCompletionSource` (see `@/lib/completion`).
 */
export const MONACO_SUGGEST_OPTIONS = {
  quickSuggestions: { other: true, comments: false, strings: false },
  suggestOnTriggerCharacters: true,
  wordBasedSuggestions: 'currentDocument',
  tabCompletion: 'on',
  acceptSuggestionOnEnter: 'on',
} as const

/**
 * Self-hosted Monaco editor (no CDN). Mounts once per file — the parent
 * remounts via `key` when switching files, so mount props stay valid for the
 * lifetime of the instance. Callbacks flow through a ref updated each render.
 */
function CodeEditor({
  language,
  value,
  onChange,
  onSave,
  handleRef,
}: CodeEditorProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const mountProps = useRef({ language, value })
  const cbRef = useRef({ onChange, onSave })

  useEffect(() => {
    cbRef.current = { onChange, onSave }
  })

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let editor: Monaco.editor.IStandaloneCodeEditor | null = null
    let cancelled = false

    // Mount-once by design: the parent remounts per file via `key`.
    void setupMonacoWorkers()
      .then(() => import('monaco-editor'))
      .then((monaco) => {
        if (cancelled || !mountRef.current) return
        editor = monaco.editor.create(mount, {
          value: mountProps.current.value,
          language: mountProps.current.language,
          theme: document.documentElement.classList.contains('dark')
            ? 'vs-dark'
            : 'vs',
          minimap: { enabled: false },
          fontSize: 13,
          padding: { top: 8 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          renderWhitespace: 'selection',
          tabSize: 2,
          ...MONACO_SUGGEST_OPTIONS,
        })
        registerCompletionSource(markdownSource)
        registerCompletionSource(studySource)
        registerStudyLanguage(monaco)
        installCompletions(monaco, ['markdown', 'stmd'])
        editor.onDidChangeModelContent(() => {
          const current = editor?.getModel()?.getValue()
          if (typeof current === 'string') cbRef.current.onChange(current)
        })
        editor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
          () => cbRef.current.onSave(),
        )
        handleRef.current = {
          undo: () => editor?.trigger('menubar', 'undo', null),
          redo: () => editor?.trigger('menubar', 'redo', null),
          focus: () => editor?.focus(),
          wrapSelection: (before, after) => {
            const ed = editor
            const model = ed?.getModel()
            if (!ed || !model) return
            const sel =
              ed.getSelection() ?? new monaco.Range(1, 1, 1, 1)
            const selected = model.getValueInRange(sel)
            const start = model.getOffsetAt(sel.getStartPosition())
            ed.executeEdits('stmd-toolbar', [
              { range: sel, text: `${before}${selected}${after}` },
            ])
            const end = start + before.length + selected.length + after.length
            const cursor = model.getPositionAt(
              selected ? end : start + before.length,
            )
            ed.setSelection(
              new monaco.Selection(
                cursor.lineNumber,
                cursor.column,
                cursor.lineNumber,
                cursor.column,
              ),
            )
            ed.focus()
          },
          insertAtCursor: (text) => {
            const ed = editor
            const model = ed?.getModel()
            if (!ed || !model) return
            const sel =
              ed.getSelection() ?? new monaco.Range(1, 1, 1, 1)
            const lineStart = /^(#{1,6}\s|> |-(\s\[[ x]\])?\s?)/.test(text)
            let range = sel
            let insert = text
            if (lineStart) {
              const lineNo = sel.startLineNumber
              range = new monaco.Range(lineNo, 1, lineNo, 1)
              insert =
                model.getLineContent(lineNo).trim() === '' ? text : `\n${text}`
            }
            ed.executeEdits('stmd-toolbar', [{ range, text: insert }])
            const cursor = model.getPositionAt(
              model.getOffsetAt(range.getStartPosition()) + insert.length,
            )
            ed.setSelection(
              new monaco.Selection(
                cursor.lineNumber,
                cursor.column,
                cursor.lineNumber,
                cursor.column,
              ),
            )
            ed.focus()
          },
        }
      })

    return () => {
      cancelled = true
      handleRef.current = null
      editor?.dispose()
    }
  }, [handleRef])

  return <div ref={mountRef} className="h-full w-full" />
}

export default CodeEditor
