import { useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '../state/i18n'
import type { MainTab } from '../state/app'
import {
  measureTourTarget,
  placeCard,
  type TourRect,
  type TourStep,
} from '../lib/tour'
import { Btn } from './ui/primitives'

/**
 * In-app guided tour: spotlights the REAL control the step talks about
 * (not a separate tour screen). Steps may switch tabs on arrival so the
 * target always exists. Missing/invisible targets fall back to a
 * centered card — the tour never strands.
 */
export function TourOverlay({
  steps,
  onNavigate,
  onDone,
}: {
  steps: TourStep[]
  onNavigate: (tab: MainTab) => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const [at, setAt] = useState(0)
  const [rect, setRect] = useState<TourRect | null>(null)
  const step = steps[at] ?? steps[steps.length - 1]

  useEffect(() => {
    function measure(): void {
      if (!step.target) {
        setRect(null)
        return
      }
      setRect(measureTourTarget(step.target))
    }
    measure()
    const settled = window.requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.cancelAnimationFrame(settled)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step])

  function next(): void {
    const coming = steps[at + 1]
    if (!coming) {
      onDone()
      return
    }
    if (coming.tab) onNavigate(coming.tab)
    setAt(at + 1)
  }

  const viewport = {
    width: typeof window === 'undefined' ? 390 : window.innerWidth,
    height: typeof window === 'undefined' ? 844 : window.innerHeight,
  }
  const card = placeCard(rect, viewport)
  const pad = 6
  const frame = rect
    ? {
        x: Math.max(0, rect.x - pad),
        y: Math.max(0, rect.y - pad),
        w: rect.width + pad * 2,
        h: rect.height + pad * 2,
      }
    : null

  return (
    <div
      role="dialog"
      aria-label={step.title}
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 70 }}
    >
      {frame ? (
        <>
          <div data-tour-backdrop style={backdrop({ top: 0, left: 0, right: 0, height: frame.y })} />
          <div
            data-tour-backdrop
            style={backdrop({
              top: frame.y + frame.h,
              left: 0,
              right: 0,
              bottom: 0,
            })}
          />
          <div data-tour-backdrop style={backdrop({ top: frame.y, left: 0, width: frame.x, height: frame.h })} />
          <div
            data-tour-backdrop
            style={backdrop({ top: frame.y, left: frame.x + frame.w, right: 0, height: frame.h })}
          />
          <div
            aria-hidden
            data-testid="tour-ring"
            style={{
              position: 'fixed',
              left: frame.x,
              top: frame.y,
              width: frame.w,
              height: frame.h,
              border: '3px solid var(--accent)',
              borderRadius: 14,
              boxShadow: '0 0 0 4px rgba(59,130,246,0.25)',
              pointerEvents: 'none',
            }}
          />
        </>
      ) : (
        <div data-tour-backdrop style={backdrop({ top: 0, left: 0, right: 0, bottom: 0 })} />
      )}
      <div
        className="m-tour-card"
        data-testid="tour-card"
        style={{
          position: 'fixed',
          top: card.top,
          left: card.left,
          width: card.width,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}
      >
        <p className="m-muted" style={{ fontSize: 12, margin: '0 0 4px' }}>
          {at + 1} / {steps.length}
        </p>
        <h2 style={{ fontSize: 19, margin: '0 0 6px' }}>{step.title}</h2>
        <p style={{ fontSize: 15, color: 'var(--muted)', margin: '0 0 12px' }}>
          {step.text}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn primary onClick={next} style={{ flex: 1 }}>
            {step.final ? t('common.gotIt') : t('common.next')}
          </Btn>
          {!step.final && (
            <Btn onClick={onDone} style={{ flex: 1 }}>
              {t('common.skip')}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

function backdrop(style: CSSProperties): CSSProperties {
  return {
    position: 'fixed',
    background: 'rgba(0,0,0,0.62)',
    ...style,
  }
}
