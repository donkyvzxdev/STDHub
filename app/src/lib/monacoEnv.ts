let configured = false

/** Self-hosted Monaco workers (no CDN — the app works fully offline). */
export async function setupMonacoWorkers(): Promise<void> {
  if (configured) return
  configured = true
  const [editorMod, tsMod, jsonMod, cssMod, htmlMod] = await Promise.all([
    import('monaco-editor/editor/editor.worker.js?worker'),
    import('monaco-editor/language/typescript/ts.worker.js?worker'),
    import('monaco-editor/language/json/json.worker.js?worker'),
    import('monaco-editor/language/css/css.worker.js?worker'),
    import('monaco-editor/language/html/html.worker.js?worker'),
  ])
  const env = self as unknown as {
    MonacoEnvironment?: {
      getWorker(workerId: string, label: string): Worker
    }
  }
  env.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'json') return new jsonMod.default()
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssMod.default()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlMod.default()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsMod.default()
      }
      return new editorMod.default()
    },
  }
}
