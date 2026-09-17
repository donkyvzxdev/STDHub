import { useI18n } from '../state/i18n'
import { useApp } from '../state/app'
import { TopBar, BackButton } from '../components/navigation'
import { CalcPad } from '../components/calculator/CalcPad'
import { useState } from 'react'

const HISTORY_KEY = 'stdhub.calc.history'

function readHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string').slice(0, 20)
      : []
  } catch {
    return []
  }
}

export function CalcScreen() {
  const { t } = useI18n()
  const { back } = useApp()
  const [history, setHistory] = useState<string[]>(readHistory)

  function commit(expr: string, result: string): void {
    setHistory((prev) => {
      const next = [`${expr} = ${result}`, ...prev.filter((h) => h !== `${expr} = ${result}`)].slice(0, 20)
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <>
      <TopBar
        title={t('calc.title')}
        left={<BackButton onBack={back} label={t('common.back')} />}
      />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CalcPad onCommit={commit} />
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 14 }}>{t('calc.history')}</strong>
            <button
              type="button"
              onClick={() => {
                setHistory([])
                try {
                  window.localStorage.removeItem('stdhub.calc.history')
                } catch {
                  // ignore
                }
              }}
              style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 13 }}
            >
              {t('calc.clearHistory')}
            </button>
          </div>
          <p className="m-muted" style={{ fontSize: 13 }}>{t('calc.tapReuse')}</p>
          {history.length === 0 ? null : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {history.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => {
                    try {
                      const nav = globalThis.navigator as Navigator & {
                        clipboard?: { writeText: (t: string) => Promise<void> }
                      }
                      void nav.clipboard?.writeText(entry.split(' = ')[1] ?? entry)
                    } catch {
                      // ignore
                    }
                  }}
                  className="m-card"
                  style={{ textAlign: 'left', fontFamily: 'monospace' }}
                >
                  {entry}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
