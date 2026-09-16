import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetCompletionState,
  installCompletions,
  listCompletionSources,
  registerCompletionSource,
  type CompletionSource,
} from './completion'
import { markdownSource } from './markdownCompletions'

function fakeMonaco() {
  const providers: Record<string, unknown> = {}
  return {
    providers,
    languages: {
      CompletionItemKind: { Keyword: 1, Snippet: 2, Function: 3, Text: 4 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      registerCompletionItemProvider: vi.fn(
        (language: string, provider: unknown) => {
          providers[language] = provider
        },
      ),
    },
  }
}

type FakeMonaco = ReturnType<typeof fakeMonaco>

function invoke(
  monaco: FakeMonaco,
  language: string,
  word: string,
): { label: string }[] {
  const provider = monaco.providers[language] as {
    provideCompletionItems(
      model: { getWordUntilPosition(p: unknown): { word: string; startColumn: number; endColumn: number } },
      position: { lineNumber: number },
    ): { suggestions: { label: string }[] }
  }
  return provider
    .provideCompletionItems(
      {
        getWordUntilPosition: () => ({
          word,
          startColumn: 1,
          endColumn: 1 + word.length,
        }),
      },
      { lineNumber: 1 },
    )
    .suggestions.map((s) => ({ label: s.label }))
}

beforeEach(() => {
  __resetCompletionState()
})

describe('T08 completion registry (STDHub hook)', () => {
  it('registers, lists and unregisters sources', () => {
    const source: CompletionSource = {
      name: 'stdhub-test',
      languages: ['markdown'],
      provide: () => [],
    }
    const unregister = registerCompletionSource(source)
    expect(listCompletionSources()).toContain('stdhub-test')
    unregister()
    expect(listCompletionSources()).not.toContain('stdhub-test')
  })

  it('merges sources per language through one adapter', () => {
    const monaco = fakeMonaco()
    registerCompletionSource(markdownSource)
    registerCompletionSource({
      name: 'stdhub-future',
      languages: ['markdown'],
      provide: () => [
        { label: 'stdhub: explain', insertText: 'explain', kind: 'function' },
      ],
    })
    registerCompletionSource({
      name: 'other-lang',
      languages: ['typescript'],
      provide: () => [{ label: 'nope', insertText: 'nope' }],
    })
    installCompletions(
      monaco as unknown as typeof import('monaco-editor'),
      ['markdown'],
    )
    const labels = invoke(monaco, 'markdown', '').map((s) => s.label)
    expect(labels).toContain('bold')
    expect(labels).toContain('stdhub: explain')
    expect(labels).not.toContain('nope')
  })

  it('filters markdown snippets by prefix', () => {
    const monaco = fakeMonaco()
    registerCompletionSource(markdownSource)
    installCompletions(
      monaco as unknown as typeof import('monaco-editor'),
      ['markdown'],
    )
    const labels = invoke(monaco, 'markdown', 'h').map((s) => s.label)
    expect(labels).toEqual(
      expect.arrayContaining(['h1', 'h2', 'h3']),
    )
    expect(labels).not.toContain('bold')
  })

  it('installs once per language', () => {
    const monaco = fakeMonaco()
    registerCompletionSource(markdownSource)
    installCompletions(
      monaco as unknown as typeof import('monaco-editor'),
      ['markdown', 'markdown'],
    )
    expect(
      monaco.languages.registerCompletionItemProvider,
    ).toHaveBeenCalledTimes(1)
  })
})
