import { describe, expect, it } from 'vitest'
import { MONACO_SUGGEST_OPTIONS } from './CodeEditor'

describe('CodeEditor suggest options', () => {
  it('enables completions for code and Markdown out of the box', () => {
    // Quick suggestions + document words cover every language (including
    // .md alongside the STDHub snippet source); Tab accepts.
    expect(MONACO_SUGGEST_OPTIONS.suggestOnTriggerCharacters).toBe(true)
    expect(MONACO_SUGGEST_OPTIONS.wordBasedSuggestions).toBe('currentDocument')
    expect(MONACO_SUGGEST_OPTIONS.tabCompletion).toBe('on')
    expect(MONACO_SUGGEST_OPTIONS.acceptSuggestionOnEnter).toBe('on')
    expect(MONACO_SUGGEST_OPTIONS.quickSuggestions).toMatchObject({
      other: true,
    })
  })
})
