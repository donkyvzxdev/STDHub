import type { MainTab } from '../state/app'

export interface TourStep {
  id: string
  title: string
  text: string
  /** Tab to navigate to when ARRIVING at this step. */
  tab?: MainTab
  /** `data-tour` target to spotlight. Absent = centered card. */
  target?: string
  final?: boolean
}

export interface TourRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CardPlacement {
  top: number
  left: number
  width: number
  placement: 'below' | 'above' | 'center'
}

export const TOUR_CARD_WIDTH = 340
const MARGIN = 16
const GAP = 12

/** Pure placement math (tested): card below the target when it fits. */
export function placeCard(
  rect: TourRect | null,
  viewport: { width: number; height: number },
  cardHeight = 230,
): CardPlacement {
  const width = Math.min(viewport.width - MARGIN * 2, TOUR_CARD_WIDTH)
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return {
      top: Math.max(MARGIN, (viewport.height - cardHeight) / 2),
      left: (viewport.width - width) / 2,
      width,
      placement: 'center',
    }
  }
  const centerX = rect.x + rect.width / 2
  const left = Math.min(
    Math.max(MARGIN, centerX - width / 2),
    Math.max(MARGIN, viewport.width - MARGIN - width),
  )
  const belowTop = rect.y + rect.height + GAP
  if (belowTop + cardHeight + MARGIN <= viewport.height) {
    return { top: belowTop, left, width, placement: 'below' }
  }
  const aboveTop = rect.y - GAP - cardHeight
  if (aboveTop >= MARGIN) {
    return { top: aboveTop, left, width, placement: 'above' }
  }
  return {
    top: Math.max(MARGIN, (viewport.height - cardHeight) / 2),
    left,
    width,
    placement: 'center',
  }
}

export function findTourTarget(id: string): Element | null {
  try {
    return document.querySelector(`[data-tour="${id}"]`)
  } catch {
    return null
  }
}

export function measureTourTarget(id: string): TourRect | null {
  const el = findTourTarget(id)
  if (!el || typeof el.getBoundingClientRect !== 'function') return null
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return null
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}
