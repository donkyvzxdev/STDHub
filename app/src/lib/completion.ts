import type * as Monaco from 'monaco-editor'

export interface CompletionSuggestion {
  label: string
  insertText: string
  detail?: string
  documentation?: string
  kind?: 'keyword' | 'snippet' | 'function' | 'text'
  sortText?: string
  snippet?: boolean
}

/**
 * A completion source plugs suggestions into the editor (e.g. the built-in
 * Markdown snippets, or the future STDHub AI assistant). Sources are merged
 * by the adapter installed with {@link installCompletions}.
 */
export interface CompletionSource {
  readonly name: string
  readonly languages: readonly string[]
  provide(language: string, word: string): CompletionSuggestion[]
}

const sources = new Map<string, CompletionSource>()

/** STDHub hook: register a named completion source. Returns an unregister. */
export function registerCompletionSource(
  source: CompletionSource,
): () => void {
  sources.set(source.name, source)
  return () => {
    if (sources.get(source.name) === source) sources.delete(source.name)
  }
}

export function unregisterCompletionSource(name: string): void {
  sources.delete(name)
}

export function listCompletionSources(): string[] {
  return [...sources.keys()]
}

/** Test-only: clears installed adapters and sources. */
export function __resetCompletionState(): void {
  installed.clear()
  sources.clear()
}

function toKind(
  monaco: typeof import('monaco-editor'),
  kind: CompletionSuggestion['kind'],
): Monaco.languages.CompletionItemKind {
  const kinds = monaco.languages.CompletionItemKind
  switch (kind) {
    case 'keyword':
      return kinds.Keyword
    case 'snippet':
      return kinds.Snippet
    case 'function':
      return kinds.Function
    default:
      return kinds.Text
  }
}

const installed = new Set<string>()

/**
 * Installs one adapter per language. The adapter merges every registered
 * source for that language at request time, so sources can come and go
 * without reinstalling. Safe to call repeatedly (StrictMode, HMR).
 */
export function installCompletions(
  monaco: typeof import('monaco-editor'),
  languages: readonly string[],
): void {
  for (const language of languages) {
    if (installed.has(language)) continue
    installed.add(language)
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems(model, position) {
        const wordInfo = model.getWordUntilPosition(position)
        const suggestions: Monaco.languages.CompletionItem[] = []
        for (const source of sources.values()) {
          if (!source.languages.includes(language)) continue
          for (const [index, s] of source.provide(language, wordInfo.word).entries()) {
            suggestions.push({
              label: s.label,
              kind: toKind(monaco, s.kind),
              detail: s.detail,
              documentation: s.documentation,
              insertText: s.insertText,
              insertTextRules: s.snippet
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              sortText: s.sortText ?? `${source.name}-${index}`,
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: wordInfo.startColumn,
                endColumn: wordInfo.endColumn,
              },
            })
          }
        }
        return { suggestions }
      },
    })
  }
}
