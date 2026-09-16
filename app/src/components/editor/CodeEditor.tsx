import { useEffect, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import { installCompletions, registerCompletionSource } from '@/lib/completion'
import { markdownSource } from '@/lib/markdownCompletions'
import { setupMonacoWorkers } from '@/lib/monacoEnv'

export interface EditorHandle {
  undo(): void
  redo(): void
  focus(): void
}

interface CodeEditorProps {
  language: string
  value: string
  onChange: (value: string) => void
  onSave: () => void
  handleRef: { current: EditorHandle | null }
}

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
        })
        registerCompletionSource(markdownSource)
        installCompletions(monaco, ['markdown'])
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
