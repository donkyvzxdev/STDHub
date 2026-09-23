/**
 * StudyMD (`.stmd`): Markdown-compatible study notebook format.
 * Plain Markdown renders as usual; study sugar degrades gracefully
 * elsewhere (it is just text): `==mark==`, `++underline++`, `$math$`,
 * `:::flashcard` / `:::quiz` / `:::dica|aviso|nota` containers,
 * ` ```calc ` fences evaluated by the calculator engine, and inline
 * `#std` markers (`#stdcalc 39 * 37 =`, `#stdmarker x /stdmarker`).
 */
import { evaluate, formatResult } from './calculator'

export function isStmdFile(name: string): boolean {
  return name.toLowerCase().endsWith('.stmd')
}

/**
 * New Notebook files default to StudyMD: a name without an extension
 * (after trimming trailing dots) gains `.stmd`. Explicit extensions and
 * dotfiles are kept as typed.
 */
export function ensureStudyExtension(name: string): string {
  const trimmed = name.trim().replace(/\.+$/, '')
  if (trimmed === '' || trimmed.startsWith('.')) {
    return trimmed === '' ? name : trimmed
  }
  const dot = trimmed.lastIndexOf('.')
  if (dot > 0 && dot < trimmed.length - 1) return trimmed
  return `${trimmed}.stmd`
}

export function drawingMarkdown(dataUrl: string, alt = 'desenho'): string {
  return `![${alt}](${dataUrl})`
}

/**
 * Line index where a gap right-click lands: the first block starting below
 * the pointer, else the end (append). Pure for testability — callers pass
 * measured block tops.
 */
export function insertionIndex(
  blockTops: { line: number; top: number }[],
  y: number,
  endLine: number,
): number {
  let at = endLine
  for (const b of blockTops) {
    if (b.top > y && b.line < at) at = b.line
  }
  return at
}

/**
 * Replaces source lines [start, endExclusive) with newText for block-level
 * live editing. Blank separators are normalized (exactly one blank line
 * between blocks, none at the edges); empty newText deletes the block.
 */
export function replaceBlockLines(
  content: string,
  start: number,
  endExclusive: number,
  newText: string,
): string {
  const lines = content.split('\n')
  const before = lines.slice(0, Math.max(0, start))
  while (before.length > 0 && before[before.length - 1] === '') before.pop()
  const after = lines.slice(Math.max(0, endExclusive))
  while (after.length > 0 && after[0] === '') after.shift()
  const mid = newText.split('\n')
  while (mid.length > 0 && mid[mid.length - 1].trim() === '') mid.pop()
  const out = [...before]
  if (mid.length > 0) {
    if (out.length > 0) out.push('')
    out.push(...mid)
  }
  if (after.length > 0) {
    out.push('')
    out.push(...after)
  }
  let result = out.join('\n')
  if (result !== '' && content.endsWith('\n') && !result.endsWith('\n')) {
    result += '\n'
  }
  return result
}

// ---------------------------------------------------------------------------
// #std inline markers: `#stdcalc 39 * 37 =` shows the result, `#stdmarker
// important /stdmarker` highlights. Closed with `/stdfunc` on the same line
// (calc also accepts a trailing `=`). Unknown funcs stay raw text.
// ---------------------------------------------------------------------------

export type StdFunc = 'calc' | 'marker'

export interface StdMarker {
  func: StdFunc
  /** Trimmed inner text. */
  inner: string
  /** Offsets within the line (end exclusive). */
  start: number
  end: number
  /** 0-based line number within the scanned source. */
  line: number
  /** Text shown when the marker collapses visually. */
  display: string
  tone: 'calc' | 'marker' | 'error'
}

/**
 * Square roots the way students write them: `√9`, `√(9+16)`, `raiz 9`,
 * `raiz de 9`, `raiz quadrada de 9` (any case) and native `sqrt(9)`.
 */
export function normalizeCalcSymbols(expr: string): string {
  let out = expr
  out = out.replace(/√/g, 'sqrt')
  out = out.replace(/\braiz\s+quadrada\s+de\s+/gi, 'sqrt ')
  out = out.replace(/\braiz\s+quadrada\s+/gi, 'sqrt ')
  out = out.replace(/\braiz\s+de\s+/gi, 'sqrt ')
  out = out.replace(/\braiz\b/gi, 'sqrt')
  out = out.replace(/\bsqrt\b/gi, 'sqrt')
  // Native calls keep their parens; bare `sqrt 9` / `sqrt9` gain them.
  out = out.replace(/sqrt\s+\(/g, 'sqrt(')
  out = out.replace(/sqrt(\d+(?:\.\d+)?)/g, 'sqrt($1)')
  out = out.replace(/sqrt\s+(\d+(?:\.\d+)?)/g, 'sqrt($1)')
  return out
}

export function evaluateStdCalc(rawExpr: string): {
  display: string
  result: string | null
} {
  const expr = rawExpr.trim()
  if (expr === '') return { display: '', result: null }
  try {
    const result = formatResult(evaluate(normalizeCalcSymbols(expr)))
    return { display: `${expr} = ${result}`, result }
  } catch {
    return { display: `${expr} = ?`, result: null }
  }
}

const STD_CLOSED_RE = /#std([A-Za-z]+)\s+([^\n]*?)\s*\/std\1/gi
const STD_CALC_EQ_RE = /#stdcalc\s+([^\n]*?)\s*=\s*$/gi

function overlaps(
  ranges: [number, number][],
  start: number,
  end: number,
): boolean {
  return ranges.some(([a, b]) => start < b && end > a)
}

/** Complete markers of one line (escapes `\#std` stay raw). */
export function findStdMarkersInLine(line: string, lineNo: number): StdMarker[] {
  const out: StdMarker[] = []
  const used: [number, number][] = []
  STD_CLOSED_RE.lastIndex = 0
  for (
    let m = STD_CLOSED_RE.exec(line);
    m;
    m = STD_CLOSED_RE.exec(line)
  ) {
    if (m.index > 0 && line[m.index - 1] === '\\') continue
    const func = m[1].toLowerCase()
    if (func !== 'calc' && func !== 'marker') continue
    let inner = m[2].trim()
    if (func === 'calc') inner = inner.replace(/\s*=\s*$/, '').trim()
    if (inner === '') continue
    const start = m.index
    const end = start + m[0].length
    used.push([start, end])
    if (func === 'calc') {
      const calc = evaluateStdCalc(inner)
      out.push({
        func,
        inner,
        start,
        end,
        line: lineNo,
        display: calc.display,
        tone: calc.result === null ? 'error' : 'calc',
      })
    } else {
      out.push({
        func,
        inner,
        start,
        end,
        line: lineNo,
        display: inner,
        tone: 'marker',
      })
    }
  }
  STD_CALC_EQ_RE.lastIndex = 0
  for (
    let m = STD_CALC_EQ_RE.exec(line);
    m;
    m = STD_CALC_EQ_RE.exec(line)
  ) {
    if (m.index > 0 && line[m.index - 1] === '\\') continue
    const start = m.index
    const end = start + m[0].length
    if (overlaps(used, start, end)) continue
    const inner = m[1].replace(/\s*=\s*$/, '').trim()
    if (inner === '') continue
    used.push([start, end])
    const calc = evaluateStdCalc(inner)
    out.push({
      func: 'calc',
      inner,
      start,
      end,
      line: lineNo,
      display: calc.display,
      tone: calc.result === null ? 'error' : 'calc',
    })
  }
  return out
}

/** Complete markers of a whole source, with line numbers. */
export function findStdMarkers(source: string): StdMarker[] {
  return source
    .split('\n')
    .flatMap((line, i) => findStdMarkersInLine(line, i))
}

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'strike'; text: string }
  | { kind: 'mark'; text: string }
  | { kind: 'underline'; text: string }
  | { kind: 'math'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'image'; alt: string; src: string }
  | { kind: 'stdcalc'; expr: string; result: string | null }
  | { kind: 'stdmarker'; text: string }

const INLINE_RE =
  /(`[^`\n]+`)|(!\[[^\]\n]*\]\([^)\s\n]+\))|(\[[^\]\n]+\]\([^)\s\n]+\))|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(==[^=\n]+==)|(\+\+[^+\n]+\+\+)|(\$[^$\n]+\$)/g

function splitMedia(
  full: string,
): { alt: string; src: string } | { text: string; href: string } {
  const closeBracket = full.indexOf('](')
  const inner = full.slice(full.startsWith('!') ? 2 : 1, closeBracket)
  const target = full.slice(closeBracket + 2, -1)
  if (full.startsWith('!')) return { alt: inner, src: target }
  return { text: inner, href: target }
}

/** Flat inline tokenization (no nesting v1 — matches the renderer). */
export function tokenizeInline(text: string): InlineToken[] {
  const markers = findStdMarkersInLine(text, 0).sort((a, b) => a.start - b.start)
  const out: InlineToken[] = []
  let pos = 0
  for (const marker of markers) {
    if (marker.start > pos) {
      out.push(...tokenizePlain(text.slice(pos, marker.start)))
    }
    if (marker.func === 'calc') {
      const calc = evaluateStdCalc(marker.inner)
      out.push({ kind: 'stdcalc', expr: marker.inner, result: calc.result })
    } else {
      out.push({ kind: 'stdmarker', text: marker.inner })
    }
    pos = marker.end
  }
  if (pos < text.length) {
    out.push(...tokenizePlain(text.slice(pos)))
  }
  return out
}

function tokenizePlain(text: string): InlineToken[] {
  const out: InlineToken[] = []
  let last = 0
  INLINE_RE.lastIndex = 0
  for (
    let m = INLINE_RE.exec(text);
    m;
    m = INLINE_RE.exec(text)
  ) {
    if (m.index > last) {
      out.push({ kind: 'text', text: text.slice(last, m.index) })
    }
    last = m.index + m[0].length
    const [
      full,
      code,
      image,
      link,
      strongStars,
      strongUnder,
      emStar,
      emUnder,
      strike,
      mark,
      underline,
      math,
    ] = m
    void full
    if (code) out.push({ kind: 'code', text: code.slice(1, -1) })
    else if (image) {
      const { alt, src } = splitMedia(image) as {
        alt: string
        src: string
      }
      out.push({ kind: 'image', alt, src })
    } else if (link) {
      const { text: label, href } = splitMedia(link) as {
        text: string
        href: string
      }
      out.push({ kind: 'link', text: label, href })
    } else if (strongStars) {
      out.push({ kind: 'strong', text: strongStars.slice(2, -2) })
    } else if (strongUnder) {
      out.push({ kind: 'strong', text: strongUnder.slice(2, -2) })
    } else if (emStar) {
      out.push({ kind: 'em', text: emStar.slice(1, -1) })
    } else if (emUnder) {
      out.push({ kind: 'em', text: emUnder.slice(1, -1) })
    } else if (strike) {
      out.push({ kind: 'strike', text: strike.slice(2, -2) })
    } else if (mark) {
      out.push({ kind: 'mark', text: mark.slice(2, -2) })
    } else if (underline) {
      out.push({ kind: 'underline', text: underline.slice(2, -2) })
    } else if (math) {
      out.push({ kind: 'math', text: math.slice(1, -1) })
    }
  }
  if (last < text.length) {
    out.push({ kind: 'text', text: text.slice(last) })
  }
  return out
}

export interface StmdQuizOption {
  text: string
  correct: boolean
  line: number
}

export interface StmdListItem {
  text: string
  task: boolean
  checked: boolean
  line: number
}

export type StmdBlock =
  | { kind: 'heading'; level: number; text: string; line: number }
  | { kind: 'paragraph'; text: string; line: number }
  | { kind: 'code'; lang: string; code: string; line: number }
  | { kind: 'calc'; expressions: string[]; line: number }
  | { kind: 'list'; ordered: boolean; items: StmdListItem[]; line: number }
  | { kind: 'quote'; text: string; line: number }
  | { kind: 'hr'; line: number }
  | { kind: 'table'; head: string[]; rows: string[][]; line: number }
  | { kind: 'flashcard'; front: string; back: string; line: number }
  | { kind: 'quiz'; question: string; options: StmdQuizOption[]; line: number }
  | { kind: 'callout'; tone: string; text: string; line: number }

const FENCE_RE = /^```\s*(\S*)\s*$/
const CONTAINER_RE = /^:::(\w+)\s*(.*)$/
const HEADING_RE = /^(#{1,6})(?:\s+(.*))?$/
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const QUOTE_RE = /^>\s?(.*)$/
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const TASK_RE = /^\[([ xX])\]\s?(.*)$/
const TABLE_SEP_RE = /^\|?[\s:|-]+\|?$/

function isHeadingLine(line: string): boolean {
  const m = HEADING_RE.exec(line)
  return !!m && (m[2] !== undefined || /^#{1,6}$/.test(line.trim()))
}

function isContainerOpen(line: string): boolean {
  return CONTAINER_RE.test(line) && line.trim() !== ':::'
}

function splitCells(line: string): string[] {
  let cells = line.trim()
  if (cells.startsWith('|')) cells = cells.slice(1)
  if (cells.endsWith('|')) cells = cells.slice(0, -1)
  return cells.split('|').map((c) => c.trim())
}

function parseQuiz(inner: string[], baseLine: number): {
  question: string
  options: StmdQuizOption[]
} {
  const question: string[] = []
  const options: StmdQuizOption[] = []
  inner.forEach((raw, i) => {
    const line = baseLine + i
    const item = raw.replace(/^(\s*)([-*+]|\d+[.)])\s+/, '')
    const task = TASK_RE.exec(item)
    if (task && raw.match(LIST_RE)) {
      options.push({
        text: task[2],
        correct: task[1].toLowerCase() === 'x',
        line,
      })
    } else if (options.length === 0 && raw.trim() !== '') {
      question.push(raw.trim())
    }
  })
  return { question: question.join('\n'), options }
}

export function parseStmd(source: string): StmdBlock[] {
  const lines = source.split('\n')
  const blocks: StmdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const lineNo = i

    const fence = FENCE_RE.exec(line)
    if (fence) {
      const lang = (fence[1] ?? '').toLowerCase()
      let j = i + 1
      while (j < lines.length && !/^```\s*$/.test(lines[j])) j++
      const body = lines.slice(i + 1, j)
      if (lang === 'calc') {
        blocks.push({
          kind: 'calc',
          expressions: body.map((b) => b.trim()).filter((b) => b !== ''),
          line: lineNo,
        })
      } else {
        blocks.push({ kind: 'code', lang, code: body.join('\n'), line: lineNo })
      }
      i = j + 1
      continue
    }

    if (isContainerOpen(line)) {
      const container = CONTAINER_RE.exec(line)
      const name = (container?.[1] ?? '').toLowerCase()
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== ':::') j++
      const content = lines.slice(i + 1, j)
      const baseLine = i + 1
      if (name === 'flashcard') {
        const sep = content.findIndex((l) => /^---\s*$/.test(l))
        const front =
          sep < 0 ? content.join('\n').trim() : content.slice(0, sep).join('\n').trim()
        const back =
          sep < 0 ? '' : content.slice(sep + 1).join('\n').trim()
        blocks.push({ kind: 'flashcard', front, back, line: lineNo })
      } else if (name === 'quiz') {
        const { question, options } = parseQuiz(content, baseLine)
        blocks.push({ kind: 'quiz', question, options, line: lineNo })
      } else {
        blocks.push({
          kind: 'callout',
          tone: name,
          text: content.join('\n').trim(),
          line: lineNo,
        })
      }
      i = j + 1
      continue
    }

    const heading = isHeadingLine(line) ? HEADING_RE.exec(line) : null
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        text: (heading[2] ?? '').trim(),
        line: lineNo,
      })
      i++
      continue
    }

    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr', line: lineNo })
      i++
      continue
    }

    const quote = QUOTE_RE.exec(line)
    if (quote) {
      const quoted: string[] = []
      while (i < lines.length) {
        const q = QUOTE_RE.exec(lines[i])
        if (!q) break
        quoted.push(q[1])
        i++
      }
      blocks.push({ kind: 'quote', text: quoted.join('\n'), line: lineNo })
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const head = splitCells(line)
      const rows: string[][] = []
      let j = i + 2
      while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '') {
        rows.push(splitCells(lines[j]))
        j++
      }
      blocks.push({ kind: 'table', head, rows, line: lineNo })
      i = j
      continue
    }

    const list = LIST_RE.exec(line)
    if (list) {
      const ordered = /^\d/.test(list[2].trim())
      const items: StmdListItem[] = []
      while (i < lines.length) {
        const lm = LIST_RE.exec(lines[i])
        if (!lm) break
        const task = TASK_RE.exec(lm[3])
        items.push(
          task
            ? {
                text: task[2],
                task: true,
                checked: task[1].toLowerCase() === 'x',
                line: i,
              }
            : { text: lm[3], task: false, checked: false, line: i },
        )
        i++
      }
      blocks.push({ kind: 'list', ordered, items, line: lineNo })
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !FENCE_RE.test(lines[i]) &&
      !isContainerOpen(lines[i]) &&
      !isHeadingLine(lines[i]) &&
      !HR_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !LIST_RE.test(lines[i])
    ) {
      // A table header also breaks the paragraph (handled above).
      if (
        lines[i].includes('|') &&
        i + 1 < lines.length &&
        TABLE_SEP_RE.test(lines[i + 1])
      ) {
        break
      }
      para.push(lines[i])
      i++
    }
    // Defensive: the guards above always take at least one line, but never
    // hang on a future divergence.
    if (para.length === 0) {
      i++
      continue
    }
    blocks.push({ kind: 'paragraph', text: para.join('\n'), line: lineNo })
  }
  return blocks
}
