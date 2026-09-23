import { describe, expect, it } from 'vitest'
import {
  drawingMarkdown,
  ensureStudyExtension,
  evaluateStdCalc,
  findStdMarkers,
  findStdMarkersInLine,
  insertionIndex,
  isStmdFile,
  normalizeCalcSymbols,
  parseStmd,
  replaceBlockLines,
  tokenizeInline,
} from './stmd'

describe('stmd helpers', () => {
  it('detects StudyMD files', () => {
    expect(isStmdFile('guia.stmd')).toBe(true)
    expect(isStmdFile('GUIA.STMD')).toBe(true)
    expect(isStmdFile('guia.md')).toBe(false)
  })

  it('defaults extensionless names to .stmd', () => {
    expect(ensureStudyExtension('guia')).toBe('guia.stmd')
    expect(ensureStudyExtension('  aula  ')).toBe('aula.stmd')
    expect(ensureStudyExtension('guia.')).toBe('guia.stmd')
    expect(ensureStudyExtension('guia.md')).toBe('guia.md')
    expect(ensureStudyExtension('guia.stmd')).toBe('guia.stmd')
    expect(ensureStudyExtension('.gitignore')).toBe('.gitignore')
    expect(ensureStudyExtension('')).toBe('')
  })

  it('builds drawing image markdown', () => {
    expect(drawingMarkdown('data:image/png;base64,AAA')).toBe(
      '![desenho](data:image/png;base64,AAA)',
    )
  })
})

describe('stmd inline', () => {
  it('tokenizes study marks', () => {
    const kinds = tokenizeInline('==destaque== e ++sub++').map((t) => t.kind)
    expect(kinds).toEqual(['mark', 'text', 'underline'])
  })

  it('tokenizes classic markdown', () => {
    const tokens = tokenizeInline('**b** *i* ~~s~~ `c` $m$')
    expect(tokens.map((t) => t.kind)).toEqual([
      'strong',
      'text',
      'em',
      'text',
      'strike',
      'text',
      'code',
      'text',
      'math',
    ])
    expect(tokens[0]).toMatchObject({ kind: 'strong', text: 'b' })
  })

  it('parses links and images', () => {
    const tokens = tokenizeInline(
      '![alt](data:image/png;base64,AAA) [t](https://x.com)',
    )
    expect(tokens[0]).toMatchObject({
      kind: 'image',
      alt: 'alt',
      src: 'data:image/png;base64,AAA',
    })
    expect(tokens[2]).toMatchObject({
      kind: 'link',
      text: 't',
      href: 'https://x.com',
    })
  })

  it('leaves plain text alone', () => {
    expect(tokenizeInline('só texto')).toEqual([
      { kind: 'text', text: 'só texto' },
    ])
  })
})

describe('stmd blocks', () => {
  it('parses headings, paragraphs and rules', () => {
    const blocks = parseStmd('# Título\n\ntexto\n\n---')
    expect(blocks[0]).toMatchObject({
      kind: 'heading',
      level: 1,
      text: 'Título',
    })
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', text: 'texto' })
    expect(blocks[2]).toMatchObject({ kind: 'hr' })
  })

  it('parses calc and code fences', () => {
    const blocks = parseStmd('```calc\n2*(3+4)\n\nsqrt(16)\n```\n\n```js\nx\n```')
    expect(blocks[0]).toMatchObject({
      kind: 'calc',
      expressions: ['2*(3+4)', 'sqrt(16)'],
    })
    expect(blocks[1]).toMatchObject({ kind: 'code', lang: 'js' })
  })

  it('parses flashcards split by ---', () => {
    const blocks = parseStmd(':::flashcard\nQuanto é 2+2?\n---\n4\n:::')
    expect(blocks[0]).toEqual({
      kind: 'flashcard',
      front: 'Quanto é 2+2?',
      back: '4',
      line: 0,
    })
  })

  it('closes containers gracefully at EOF', () => {
    const blocks = parseStmd(':::flashcard\nsó frente')
    expect(blocks[0]).toMatchObject({ kind: 'flashcard', front: 'só frente' })
  })

  it('parses quizzes with correct options', () => {
    const blocks = parseStmd(
      ':::quiz\nCapital do Brasil?\n- [ ] São Paulo\n- [x] Brasília\n:::',
    )
    expect(blocks[0]).toMatchObject({
      kind: 'quiz',
      question: 'Capital do Brasil?',
    })
    const quiz = blocks[0]
    if (quiz.kind !== 'quiz') throw new Error('expected quiz')
    expect(quiz.options).toEqual([
      { text: 'São Paulo', correct: false, line: 2 },
      { text: 'Brasília', correct: true, line: 3 },
    ])
  })

  it('parses callouts, quotes, tables and task lists', () => {
    const blocks = parseStmd(
      ':::aviso\ncuidado\n:::\n\n> citou\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- [ ] uma\n- [x] outra',
    )
    expect(blocks[0]).toMatchObject({ kind: 'callout', tone: 'aviso' })
    expect(blocks[1]).toMatchObject({ kind: 'quote' })
    expect(blocks[2]).toMatchObject({
      kind: 'table',
      head: ['A', 'B'],
      rows: [['1', '2']],
    })
    const list = blocks[3]
    if (list.kind !== 'list') throw new Error('expected list')
    expect(list.items).toEqual([
      { text: 'uma', task: true, checked: false, line: 10 },
      { text: 'outra', task: true, checked: true, line: 11 },
    ])
  })

  it('never hangs on hashtag lines or stray markers', () => {
    const blocks = parseStmd('#hashtag\n\n:::\n\ntexto')
    expect(blocks[0]).toMatchObject({ kind: 'paragraph', text: '#hashtag' })
    expect(blocks.some((b) => b.kind === 'paragraph' && b.text === 'texto')).toBe(
      true,
    )
  })
})

describe('replaceBlockLines', () => {  const src = '# A\n\ntexto um\n\n- [ ] t\n'
  it('replaces a middle block keeping separators', () => {
    expect(replaceBlockLines(src, 2, 3, 'texto dois')).toBe(
      '# A\n\ntexto dois\n\n- [ ] t\n',
    )
  })
  it('appends at the end with one blank line', () => {
    expect(replaceBlockLines('# A\n', 2, 2, 'novo')).toBe('# A\n\nnovo\n')
  })
  it('prepends at the start without leading blanks', () => {
    expect(replaceBlockLines('b\n', 0, 0, 'a')).toBe('a\n\nb\n')
  })
  it('deletes a block when the text empties', () => {
    expect(replaceBlockLines(src, 2, 3, '  \n')).toBe('# A\n\n- [ ] t\n')
  })
  it('handles empty documents', () => {
    expect(replaceBlockLines('', 0, 0, 'oi')).toBe('oi')
  })
})

describe('insertionIndex', () => {
  it('lands on the first block below the pointer', () => {
    const tops = [
      { line: 0, top: 100 },
      { line: 3, top: 200 },
      { line: 6, top: 300 },
    ]
    expect(insertionIndex(tops, 50, 10)).toBe(0)
    expect(insertionIndex(tops, 150, 10)).toBe(3)
    expect(insertionIndex(tops, 250, 10)).toBe(6)
    expect(insertionIndex(tops, 500, 10)).toBe(10)
    expect(insertionIndex([], 500, 10)).toBe(10)
  })
})

describe('std inline markers', () => {
  it('normalizes every square-root spelling', () => {
    expect(normalizeCalcSymbols('√9')).toBe('sqrt(9)')
    expect(normalizeCalcSymbols('√(9+16)')).toBe('sqrt(9+16)')
    expect(normalizeCalcSymbols('raiz 9')).toBe('sqrt(9)')
    expect(normalizeCalcSymbols('raiz de 9')).toBe('sqrt(9)')
    expect(normalizeCalcSymbols('raiz quadrada de 9')).toBe('sqrt(9)')
    expect(normalizeCalcSymbols('RAIZ QUADRADA DE 16')).toBe('sqrt(16)')
    expect(normalizeCalcSymbols('sqrt(9)')).toBe('sqrt(9)')
    expect(evaluateStdCalc('39 * 37').display).toBe('39 * 37 = 1443')
    expect(evaluateStdCalc('raiz de 16').display).toBe('raiz de 16 = 4')
    expect(evaluateStdCalc('2+').result).toBeNull()
  })

  it('collapses trailing-= calc markers', () => {
    const [marker] = findStdMarkersInLine('#stdcalc 39 * 37 =', 0)
    expect(marker).toMatchObject({
      func: 'calc',
      inner: '39 * 37',
      display: '39 * 37 = 1443',
      tone: 'calc',
    })
    expect(marker.end).toBe('#stdcalc 39 * 37 ='.length)
  })

  it('collapses explicitly closed markers', () => {
    const markers = findStdMarkersInLine(
      '#stdmarker texto importante /stdmarker e #stdcalc 10/2 /stdcalc',
      2,
    )
    expect(markers).toHaveLength(2)
    expect(markers[0]).toMatchObject({
      func: 'marker',
      inner: 'texto importante',
      display: 'texto importante',
      tone: 'marker',
      line: 2,
    })
    expect(markers[1]).toMatchObject({
      func: 'calc',
      inner: '10/2',
      display: '10/2 = 5',
    })
  })

  it('leaves incomplete, unknown and escaped markers raw', () => {
    expect(findStdMarkersInLine('#stdcalc 2+2', 0)).toEqual([])
    expect(findStdMarkersInLine('#stdmarker solto', 0)).toEqual([])
    expect(
      findStdMarkersInLine('#stdbogus x /stdbogus', 0),
    ).toEqual([])
    expect(findStdMarkersInLine('\\#stdcalc 2+2 =', 0)).toEqual([])
    expect(findStdMarkersInLine('#stdcalc =', 0)).toEqual([])
  })

  it('flags bad calc expressions instead of hiding them', () => {
    const [marker] = findStdMarkersInLine('#stdcalc 2+ =', 0)
    expect(marker.tone).toBe('error')
    expect(marker.display).toBe('2+ = ?')
  })

  it('scans whole sources with line numbers', () => {
    const markers = findStdMarkers('nada\n#stdcalc 1+1 =\n#stdmarker a /stdmarker')
    expect(markers.map((m) => m.line)).toEqual([1, 2])
  })

  it('tokenizes std markers inline', () => {
    const calc = tokenizeInline('veja #stdcalc 1+1 =')
    expect(calc.map((t) => t.kind)).toEqual(['text', 'stdcalc'])
    expect(calc[1]).toMatchObject({
      kind: 'stdcalc',
      expr: '1+1',
      result: '2',
    })
    const marker = tokenizeInline('veja #stdmarker x /stdmarker fim')
    expect(marker.map((t) => t.kind)).toEqual(['text', 'stdmarker', 'text'])
    expect(marker[1]).toMatchObject({ kind: 'stdmarker', text: 'x' })
    // Mid-line `=` is not a trigger (ambiguous) — stays raw.
    expect(
      tokenizeInline('#stdcalc 1+1 = e continua').map((t) => t.kind),
    ).toEqual(['text'])
  })
})
