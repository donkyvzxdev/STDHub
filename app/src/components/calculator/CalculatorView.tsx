import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Delete, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  evaluate,
  formatResult,
  type AngleMode,
} from '@/lib/calculator'
import { cn } from 'cn'

const HISTORY_KEY = 'stdhub.calc.history'
const HISTORY_MAX = 20

function loadHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string').slice(0, HISTORY_MAX)
    }
  } catch {
    // ignore corrupt history
  }
  return []
}

function tryEval(expr: string, mode: AngleMode): string | null {
  if (expr.trim() === '') return null
  try {
    return formatResult(evaluate(expr, mode))
  } catch {
    return null
  }
}

const BASIC_KEYS = [
  'C',
  '⌫',
  '(',
  ')',
  '7',
  '8',
  '9',
  '/',
  '4',
  '5',
  '6',
  '*',
  '1',
  '2',
  '3',
  '-',
  '0',
  '.',
  '%',
  '+',
]

const SCI_KEYS = [
  'sin(',
  'cos(',
  'tan(',
  'asin(',
  'acos(',
  'atan(',
  'log(',
  'ln(',
  'sqrt(',
  'cbrt(',
  'abs(',
  'exp(',
  'pi',
  'e',
  '^',
  '!',
  'DEG',
  'RAD',
]

function CalculatorView() {
  const { t } = useTranslation()
  const [expr, setExpr] = useState('')
  const [mode, setMode] = useState<AngleMode>('deg')
  const [scientific, setScientific] = useState(false)
  const [history, setHistory] = useState<string[]>(loadHistory)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  const preview = tryEval(expr, mode)

  function pushHistory(entry: string): void {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h !== entry)].slice(0, HISTORY_MAX)
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // ignore write failures
      }
      return next
    })
  }

  function press(key: string): void {
    setError(false)
    setCopied(false)
    if (key === 'C') {
      setExpr('')
      return
    }
    if (key === '⌫') {
      setExpr((prev) => prev.slice(0, -1))
      return
    }
    if (key === 'DEG' || key === 'RAD') {
      setMode(key.toLowerCase() as AngleMode)
      return
    }
    setExpr((prev) => prev + key)
  }

  function equals(): void {
    const result = tryEval(expr, mode)
    if (result === null) {
      setError(true)
      return
    }
    setError(false)
    pushHistory(`${expr} = ${result}`)
    setExpr(result)
  }

  async function copyResult(): Promise<void> {
    if (preview === null) return
    try {
      if (!navigator.clipboard) throw new Error('clipboard')
      await navigator.clipboard.writeText(preview)
      setCopied(true)
    } catch {
      setError(true)
    }
  }

  function clearHistory(): void {
    setHistory([])
    try {
      window.localStorage.removeItem(HISTORY_KEY)
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md animate-in flex-col gap-3 p-6 fade-in duration-300">
      <div className="flex items-center justify-between">
        <ToggleGroup
          variant="outline"
          value={[scientific ? 'sci' : 'basic']}
          onValueChange={(v) => {
            if (v[0] === 'sci') setScientific(true)
            else if (v[0] === 'basic') setScientific(false)
          }}
        >
          <ToggleGroupItem value="basic" aria-label={t('calc.basic')}>
            123
          </ToggleGroupItem>
          <ToggleGroupItem value="sci" aria-label={t('calc.scientific')}>
            <FlaskConical aria-hidden />
            {t('calc.scientific')}
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          variant="outline"
          value={[mode]}
          onValueChange={(v) => {
            if (v[0] === 'deg' || v[0] === 'rad') setMode(v[0])
          }}
        >
          <ToggleGroupItem value="deg" aria-label="DEG">
            DEG
          </ToggleGroupItem>
          <ToggleGroupItem value="rad" aria-label="RAD">
            RAD
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
        <Input
          aria-label={t('calc.expression')}
          value={expr}
          placeholder="2*(3+4)"
          onChange={(e) => {
            setExpr(e.target.value)
            setError(false)
            setCopied(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') equals()
            else if (e.key === 'Escape') setExpr('')
          }}
          className="border-0 bg-transparent px-0 text-right font-mono text-2xl shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          aria-label={t('calc.copyResult')}
          title={t('calc.copyResult')}
          onClick={() => void copyResult()}
          className={cn(
            'flex items-center justify-end gap-2 text-right font-mono text-lg',
            preview === null
              ? 'text-muted-foreground/50'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span data-testid="calc-preview">
            {error ? t('calc.error') : (preview ?? ' ')}
          </span>
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
        </button>
      </div>

      {scientific ? (
        <div className="grid animate-in grid-cols-6 gap-1.5 fade-in duration-200">
          {SCI_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="secondary"
              size="sm"
              className="font-mono text-xs"
              onClick={() => press(key)}
            >
              {key}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-1.5">
        {BASIC_KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            variant={key === 'C' ? 'destructive' : 'outline'}
            onClick={() => press(key)}
            aria-label={key === '⌫' ? t('calc.backspace') : key}
          >
            {key === '⌫' ? <Delete aria-hidden /> : key}
          </Button>
        ))}
        <Button
          type="button"
          variant="default"
          className="col-span-4"
          onClick={equals}
        >
          =
        </Button>
      </div>

      {history.length > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {t('calc.history')}
            </p>
            <button
              type="button"
              onClick={clearHistory}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {t('calc.clearHistory')}
            </button>
          </div>
          <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {history.map((entry) => (
              <li key={entry}>
                <button
                  type="button"
                  onClick={() => setExpr(entry.split(' = ')[0] ?? entry)}
                  className="w-full truncate rounded-md px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {entry}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default CalculatorView
