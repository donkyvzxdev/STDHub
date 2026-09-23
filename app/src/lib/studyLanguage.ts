import type * as Monaco from 'monaco-editor'

let registered = false

/**
 * StudyMD (`.stmd`): Markdown-compatible study notebook language.
 * Highlight (`== ==`), underline (`++ ++`), math (`$ $`) and `:::` study
 * blocks (flashcard, quiz, callouts, calc fences) on top of Markdown.
 * The renderer (`StudyNotebook`) stays the source of truth for semantics;
 * this only colors the editor. Safe to call repeatedly (StrictMode, HMR).
 */
export function registerStudyLanguage(
  monaco: typeof import('monaco-editor'),
): void {
  if (registered) return
  registered = true
  monaco.languages.register({ id: 'stmd' })
  monaco.languages.setLanguageConfiguration('stmd', {
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    surroundingPairs: [
      { open: '**', close: '**' },
      { open: '*', close: '*' },
      { open: '==', close: '==' },
      { open: '++', close: '++' },
      { open: '`', close: '`' },
      { open: '$', close: '$' },
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    folding: {
      markers: {
        start: /^:::\w+/,
        end: /^:::\s*$/,
      },
    },
  })
  const tokenizer: Monaco.languages.IMonarchLanguage = {
    tokenizer: {
      root: [
        [/^#{1,6}(?=\s|$)/, 'keyword'],
        [/^```.*$/, { token: 'string', next: '@fence' }],
        [/^:::\w+.*$/, { token: 'comment', next: '@container' }],
        [/^:::\s*$/, 'comment'],
        [/^>\s?.*$/, 'comment'],
        [/^\s*(?:[-*+]|\d+[.)])\s/, 'keyword'],
        [/^\s*[-*]\s*\[[ xX]\]/, 'keyword'],
        [/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/, 'keyword'],
        { include: '@inline' },
      ],
      inline: [
        [/`[^`\n]+`/, 'string'],
        [/\*\*[^*\n]+\*\*/, 'strong'],
        [/__[^_\n]+__/, 'strong'],
        [/\*[^*\n]+\*/, 'emphasis'],
        [/_[^_\n]+_/, 'emphasis'],
        [/~~[^~\n]+~~/, 'comment'],
        [/==[^=\n]+==/, 'strong'],
        [/\+\+[^+\n]+\+\+/, 'emphasis'],
        [/\$[^$\n]+\$/, 'number'],
        [/!?\[.*?\]\(.*?\)/, 'string'],
      ],
      fence: [
        [/^```\s*$/, { token: 'string', next: '@pop' }],
        [/.*$/, 'string'],
      ],
      container: [
        [/^:::\s*$/, { token: 'comment', next: '@pop' }],
        { include: '@inline' },
      ],
    },
  }
  monaco.languages.setMonarchTokensProvider('stmd', tokenizer)
}

/** Test-only: lets a fresh fake re-register. */
export function __resetStudyLanguage(): void {
  registered = false
}
