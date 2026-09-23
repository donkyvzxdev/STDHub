import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetStudyLanguage,
  registerStudyLanguage,
} from './studyLanguage'
import { studySource } from './studyCompletions'

function fakeMonaco() {
  return {
    languages: {
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
    },
  }
}

describe('study language registration', () => {
  beforeEach(() => {
    __resetStudyLanguage()
  })

  it('registers stmd once with study pairs and rules', () => {
    const fake = fakeMonaco()
    registerStudyLanguage(
      fake as unknown as typeof import('monaco-editor'),
    )
    registerStudyLanguage(
      fake as unknown as typeof import('monaco-editor'),
    )
    expect(fake.languages.register).toHaveBeenCalledTimes(1)
    expect(fake.languages.register).toHaveBeenCalledWith({ id: 'stmd' })
    const config = fake.languages.setLanguageConfiguration.mock.calls[0][1] as {
      surroundingPairs: { open: string; close: string }[]
    }
    const opens = config.surroundingPairs.map((p) => p.open)
    expect(opens).toContain('==')
    expect(opens).toContain('++')
    const def = fake.languages.setMonarchTokensProvider.mock.calls[0][1] as {
      tokenizer: Record<string, unknown[]>
    }
    expect(Object.keys(def.tokenizer)).toEqual(
      expect.arrayContaining(['root', 'inline', 'fence', 'container']),
    )
  })
})

describe('study completions', () => {
  it('targets the stmd language only', () => {
    expect(studySource.languages).toEqual(['stmd'])
  })

  it('suggests blocks by prefix', () => {
    const labels = studySource.provide('stmd', 'fl').map((s) => s.label)
    expect(labels).toContain('flash')
    const quiz = studySource.provide('stmd', 'quiz')
    expect(quiz[0].insertText).toContain(':::quiz')
    expect(quiz[0].snippet).toBe(true)
  })

  it('stays quiet on unknown words', () => {
    expect(studySource.provide('stmd', 'zzz')).toEqual([])
  })
})
