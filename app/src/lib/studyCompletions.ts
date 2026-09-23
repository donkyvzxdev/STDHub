import type { CompletionSource } from './completion'

const BLOCKS: { label: string; insertText: string; detail: string }[] = [
  {
    label: 'flash',
    insertText:
      ':::flashcard\n${1:pergunta}\n---\n${2:resposta}\n:::$0',
    detail: 'Flashcard (vira ao clicar)',
  },
  {
    label: 'quiz',
    insertText:
      ':::quiz\n${1:pergunta}\n- [ ] ${2:opção 1}\n- [x] ${3:opção certa}\n- [ ] ${4:opção 3}\n:::$0',
    detail: 'Quiz de múltipla escolha',
  },
  {
    label: 'calc',
    insertText: '```calc\n${1:2*(3+4)}\n```$0',
    detail: 'Bloco de cálculos (mostra o resultado)',
  },
  {
    label: 'dica',
    insertText: ':::dica\n${1:texto}\n:::$0',
    detail: 'Caixa de dica',
  },
  {
    label: 'aviso',
    insertText: ':::aviso\n${1:texto}\n:::$0',
    detail: 'Caixa de aviso',
  },
  {
    label: 'nota',
    insertText: ':::nota\n${1:texto}\n:::$0',
    detail: 'Caixa de nota',
  },
  {
    label: 'task',
    insertText: '- [ ] ${1:tarefa}$0',
    detail: 'Tarefa clicável',
  },
  {
    label: 'hl',
    insertText: '==${1:destaque}==$0',
    detail: 'Marca-texto',
  },
  {
    label: 'ul',
    insertText: '++${1:sublinhado}++$0',
    detail: 'Sublinhado',
  },
  {
    label: 'math',
    insertText: '$${1:x^2}$$0',
    detail: 'Matemática em linha',
  },
  {
    label: 'table',
    insertText:
      '| ${1:A} | ${2:B} |\n| --- | --- |\n| ${3:1} | ${4:2} |$0',
    detail: 'Tabela',
  },
]

/**
 * StudyMD blocks and marks as snippets. Labels double as `/`-style
 * commands (type `flash`, `quiz`, `calc`…); the shared adapter in
 * `./completion` merges them at request time.
 */
export const studySource: CompletionSource = {
  name: 'stmd-blocks',
  languages: ['stmd'],
  provide(_language, word) {
    const q = word.toLowerCase()
    return BLOCKS.filter((s) => s.label.startsWith(q)).map((s) => ({
      label: s.label,
      insertText: s.insertText,
      detail: s.detail,
      kind: 'snippet' as const,
      snippet: true,
    }))
  },
}
