import { useState } from 'react'
import { evaluate, formatResult } from '@shared/lib/calculator'
import { useI18n } from '../../state/i18n'

/**
 * Compact calculator pad: basic keys + scientific toggle, reused by the
 * Calc screen and the Notebook bottom sheet. `%` divides by 100 here
 * (student-friendly); the shared engine keeps `%` as modulo.
 */
export function CalcPad({
  onInsert,
  onCommit,
}: {
  onInsert?: (text: string) => void
  onCommit?: (expr: string, result: string) => void
}) {
  const { t } = useI18n()
  const [expr, setExpr] = useState('')
  const [sci, setSci] = useState(false)
  const [copied, setCopied] = useState(false)

  let preview: string | null = null
  try {
    preview = expr.trim() === '' ? null : formatResult(evaluate(expr, 'deg'))
  } catch {
    preview = null
  }

  function press(key: string): void {
    setCopied(false)
    if (key === 'C') {
      setExpr('')
      return
    }
    if (key === '⌫') {
      setExpr((prev) => prev.slice(0, -1))
      return
    }
    if (key === '%') {
      setExpr((prev) => (prev === '' ? prev : `(${prev})/100`))
      return
    }
    setExpr((prev) => prev + key)
  }

  async function copy(): Promise<void> {
    if (preview === null) return
    try {
      const nav = globalThis.navigator as Navigator & {
        clipboard?: { writeText: (text: string) => Promise<void> }
      }
      await nav.clipboard?.writeText(preview)
      setCopied(true)
    } catch {
      // clipboard unavailable — nothing to do
    }
  }

  const basic = ['C', '⌫', '(', ')', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+']
  const scientific = ['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', 'pi', 'e', '^', '!']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        aria-live="polite"
        style={{ textAlign: 'right', fontSize: 30, minHeight: 40, overflowX: 'auto' }}
      >
        {expr === '' ? '0' : expr}
      </div>
      <div style={{ textAlign: 'right', fontSize: 18, color: 'var(--muted)', minHeight: 26 }}>
        {preview !== null ? `= ${preview}` : ''}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setSci((v) => !v)}
          aria-pressed={sci}
          className="m-btn"
          style={{ flex: 1 }}
        >
          {sci ? t('calc.basic') : t('calc.scientific')}
        </button>
        {onInsert && (
          <button
            type="button"
            disabled={preview === null}
            onClick={() => preview !== null && onInsert(preview)}
            className="m-btn m-btn-primary"
            style={{ flex: 1 }}
          >
            {t('notebook.insertCalc')}
          </button>
        )}
        <button type="button" onClick={() => void copy()} className="m-btn" style={{ flex: 1 }}>
          {copied ? '✓' : t('notebook.copyCalc')}
        </button>
      </div>
      {sci && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {scientific.map((key) => (
            <button key={key} type="button" onClick={() => press(key)} className="m-btn" style={{ minHeight: 44, padding: 0, fontSize: 13 }}>
              {key}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {basic.map((key) => (
          <button key={key} type="button" onClick={() => press(key)} className="m-btn" style={{ minHeight: 52, padding: 0, fontSize: 18 }} aria-label={key === '⌫' ? t('calc.backspace') : key}>
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (preview !== null) {
              onCommit?.(expr, preview)
              setExpr(preview)
            }
          }}
          className="m-btn m-btn-primary"
          style={{ gridColumn: 'span 4' }}
          aria-label="="
        >
          =
        </button>
      </div>
    </div>
  )
}
