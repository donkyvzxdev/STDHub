export type AngleMode = 'deg' | 'rad'

export class CalcError extends Error {
  constructor() {
    super('calc-error')
    this.name = 'CalcError'
  }
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '%' | '^' | 'u-' }
  | { kind: 'func'; name: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'fact' }

const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'log',
  'ln',
  'sqrt',
  'cbrt',
  'abs',
  'exp',
])

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  'π': Math.PI,
  e: Math.E,
}

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  '^': 4,
  'u-': 5,
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === 'π'
}

/** Tokenize, inserting implicit multiplication (`2pi`, `2(3)`, `)(`). */
export function tokenize(raw: string): Token[] {
  const out: Token[] = []
  const push = (t: Token): void => {
    const prev = out[out.length - 1]
    const needsMult =
      prev &&
      (prev.kind === 'num' ||
        prev.kind === 'rparen' ||
        prev.kind === 'fact') &&
      (t.kind === 'num' || t.kind === 'func' || t.kind === 'lparen')
    if (needsMult) out.push({ kind: 'op', op: '*' })
    out.push(t)
  }
  let i = 0
  const s = raw.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  let expectOperand = true
  while (i < s.length) {
    const ch = s[i]
    if (ch === ' ' || ch === '\t') {
      i++
      continue
    }
    if (isDigit(ch) || ch === '.') {
      let j = i
      let dots = 0
      while (j < s.length && (isDigit(s[j]) || s[j] === '.')) {
        if (s[j] === '.') dots++
        j++
      }
      const num = Number(s.slice(i, j))
      if (dots > 1 || Number.isNaN(num)) throw new CalcError()
      push({ kind: 'num', value: num })
      expectOperand = false
      i = j
      continue
    }
    if (isLetter(ch)) {
      let j = i
      while (j < s.length && isLetter(s[j])) j++
      const word = s.slice(i, j).toLowerCase()
      if (word in CONSTANTS) {
        push({ kind: 'num', value: CONSTANTS[word] })
        expectOperand = false
      } else if (FUNCTIONS.has(word)) {
        push({ kind: 'func', name: word })
        expectOperand = true
      } else {
        throw new CalcError()
      }
      i = j
      continue
    }
    if (ch === '(') {
      push({ kind: 'lparen' })
      expectOperand = true
      i++
      continue
    }
    if (ch === ')') {
      push({ kind: 'rparen' })
      expectOperand = false
      i++
      continue
    }
    if (ch === '!') {
      if (expectOperand) throw new CalcError()
      push({ kind: 'fact' })
      expectOperand = false
      i++
      continue
    }
    if ('+-*/%^'.includes(ch)) {
      if ((ch === '-' || ch === '+') && expectOperand) {
        if (ch === '-') push({ kind: 'op', op: 'u-' })
        i++
        continue
      }
      if (expectOperand) throw new CalcError()
      push({ kind: 'op', op: ch as '+' | '-' | '*' | '/' | '%' | '^' })
      expectOperand = true
      i++
      continue
    }
    throw new CalcError()
  }
  return out
}

function toRpn(tokens: Token[]): Token[] {
  const out: Token[] = []
  const stack: Token[] = []
  for (const t of tokens) {
    if (t.kind === 'num') {
      out.push(t)
    } else if (t.kind === 'func') {
      stack.push(t)
    } else if (t.kind === 'op') {
      while (stack.length > 0) {
        const top = stack[stack.length - 1]
        if (top.kind === 'lparen') break
        if (top.kind === 'func') {
          out.push(stack.pop() as Token)
          continue
        }
        if (top.kind !== 'op') break
        const pTop = PRECEDENCE[top.op] ?? 0
        const pCur = PRECEDENCE[t.op] ?? 0
        const rightAssoc = t.op === '^' || t.op === 'u-'
        if (pTop > pCur || (pTop === pCur && !rightAssoc)) {
          out.push(stack.pop() as Token)
        } else {
          break
        }
      }
      stack.push(t)
    } else if (t.kind === 'lparen') {
      stack.push(t)
    } else if (t.kind === 'rparen') {
      let found = false
      while (stack.length > 0) {
        const top = stack.pop() as Token
        if (top.kind === 'lparen') {
          found = true
          break
        }
        out.push(top)
      }
      if (!found) throw new CalcError()
      const maybeFunc = stack[stack.length - 1]
      if (maybeFunc && maybeFunc.kind === 'func') {
        out.push(stack.pop() as Token)
      }
    } else if (t.kind === 'fact') {
      out.push(t)
    }
  }
  while (stack.length > 0) {
    const top = stack.pop() as Token
    if (top.kind === 'lparen') throw new CalcError()
    out.push(top)
  }
  return out
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new CalcError()
  let acc = 1
  for (let i = 2; i <= n; i++) acc *= i
  return acc
}

function applyFunc(name: string, x: number, mode: AngleMode): number {
  const toRad = (d: number): number => (d * Math.PI) / 180
  const toDeg = (r: number): number => (r * 180) / Math.PI
  switch (name) {
    case 'sin':
      return Math.sin(mode === 'deg' ? toRad(x) : x)
    case 'cos':
      return Math.cos(mode === 'deg' ? toRad(x) : x)
    case 'tan': {
      const v = Math.tan(mode === 'deg' ? toRad(x) : x)
      if (!Number.isFinite(v) || Math.abs(v) > 1e15) throw new CalcError()
      return v
    }
    case 'asin':
    case 'acos': {
      if (x < -1 || x > 1) throw new CalcError()
      const v = name === 'asin' ? Math.asin(x) : Math.acos(x)
      return mode === 'deg' ? toDeg(v) : v
    }
    case 'atan': {
      const v = Math.atan(x)
      return mode === 'deg' ? toDeg(v) : v
    }
    case 'log':
      if (x <= 0) throw new CalcError()
      return Math.log10(x)
    case 'ln':
      if (x <= 0) throw new CalcError()
      return Math.log(x)
    case 'sqrt':
      if (x < 0) throw new CalcError()
      return Math.sqrt(x)
    case 'cbrt':
      return Math.cbrt(x)
    case 'abs':
      return Math.abs(x)
    case 'exp':
      return Math.exp(x)
    default:
      throw new CalcError()
  }
}

function evalRpn(rpn: Token[], mode: AngleMode): number {
  const stack: number[] = []
  const pop = (): number => {
    const v = stack.pop()
    if (v === undefined) throw new CalcError()
    return v
  }
  for (const t of rpn) {
    if (t.kind === 'num') {
      stack.push(t.value)
    } else if (t.kind === 'fact') {
      stack.push(factorial(pop()))
    } else if (t.kind === 'func') {
      stack.push(applyFunc(t.name, pop(), mode))
    } else if (t.kind === 'op') {
      if (t.op === 'u-') {
        stack.push(-pop())
        continue
      }
      const b = pop()
      const a = pop()
      switch (t.op) {
        case '+':
          stack.push(a + b)
          break
        case '-':
          stack.push(a - b)
          break
        case '*':
          stack.push(a * b)
          break
        case '/':
          if (b === 0) throw new CalcError()
          stack.push(a / b)
          break
        case '%':
          if (b === 0) throw new CalcError()
          stack.push(a % b)
          break
        case '^':
          stack.push(Math.pow(a, b))
          break
        default:
          throw new CalcError()
      }
    }
  }
  if (stack.length !== 1) throw new CalcError()
  const result = stack[0]
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new CalcError()
  }
  // Scrub float dust (e.g. sin(pi) = 1.2e-16).
  return Math.abs(result) < 1e-12 ? 0 : result
}

/** Evaluate an expression string. Throws CalcError on any invalid input. */
export function evaluate(expr: string, mode: AngleMode = 'deg'): number {
  const tokens = tokenize(expr)
  if (tokens.length === 0) throw new CalcError()
  return evalRpn(toRpn(tokens), mode)
}

/** Display formatting: trims float dust, avoids scientific noise. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) throw new CalcError()
  if (Object.is(value, -0)) return '0'
  const rounded = Math.abs(value) < 1e-12 ? 0 : value
  if (Number.isInteger(rounded) && Math.abs(rounded) < 1e15) {
    return String(rounded)
  }
  const fixed = Number(rounded.toPrecision(10))
  return String(fixed)
}
