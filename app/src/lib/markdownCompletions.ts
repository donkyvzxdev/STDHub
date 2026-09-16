import type { CompletionSource } from './completion'

const SNIPPETS: { label: string; insertText: string; detail: string }[] = [
  { label: 'h1', insertText: '# ${1:title}', detail: 'Heading 1' },
  { label: 'h2', insertText: '## ${1:title}', detail: 'Heading 2' },
  { label: 'h3', insertText: '### ${1:title}', detail: 'Heading 3' },
  { label: 'bold', insertText: '**${1:text}**', detail: 'Bold' },
  { label: 'italic', insertText: '*${1:text}*', detail: 'Italic' },
  { label: 'code', insertText: '`${1:code}`', detail: 'Inline code' },
  {
    label: 'fence',
    insertText: '```${1:lang}\n$0\n```',
    detail: 'Code fence',
  },
  { label: 'task', insertText: '- [ ] ${1:task}', detail: 'Task item' },
  { label: 'quote', insertText: '> $0', detail: 'Quote' },
  { label: 'link', insertText: '[${1:text}](${2:url})', detail: 'Link' },
]

/** Built-in Markdown snippets (headings, emphasis, fences, tasks...). */
export const markdownSource: CompletionSource = {
  name: 'markdown-snippets',
  languages: ['markdown'],
  provide(_language, word) {
    const q = word.toLowerCase()
    return SNIPPETS.filter((s) => s.label.startsWith(q)).map((s) => ({
      label: s.label,
      insertText: s.insertText,
      detail: s.detail,
      kind: 'snippet' as const,
      snippet: true,
    }))
  },
}
