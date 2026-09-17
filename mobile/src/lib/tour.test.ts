import { describe, expect, it } from 'vitest'
import { measureTourTarget, placeCard } from './tour'

describe('tour placement', () => {
  it('centers without a target', () => {
    const card = placeCard(null, { width: 390, height: 844 })
    expect(card.placement).toBe('center')
    expect(card.left).toBeGreaterThanOrEqual(16)
  })

  it('places below when there is room', () => {
    const card = placeCard(
      { x: 100, y: 100, width: 120, height: 48 },
      { width: 390, height: 844 },
    )
    expect(card.placement).toBe('below')
    expect(card.top).toBe(100 + 48 + 12)
  })

  it('places above when below does not fit', () => {
    const card = placeCard(
      { x: 100, y: 700, width: 120, height: 48 },
      { width: 390, height: 844 },
    )
    expect(card.placement).toBe('above')
    expect(card.top).toBeLessThan(700)
  })

  it('centers in tiny viewports', () => {
    const card = placeCard(
      { x: 10, y: 10, width: 50, height: 30 },
      { width: 200, height: 200 },
      400,
    )
    expect(card.placement).toBe('center')
  })

  it('clamps horizontally', () => {
    const card = placeCard(
      { x: 350, y: 100, width: 60, height: 40 },
      { width: 390, height: 844 },
    )
    expect(card.left).toBeGreaterThanOrEqual(16)
    expect(card.left + card.width).toBeLessThanOrEqual(390 - 16)
  })

  it('returns null for missing or zero-size targets', () => {
    expect(measureTourTarget('nope-missing')).toBeNull()
    const el = document.createElement('div')
    el.setAttribute('data-tour', 'zero-size')
    document.body.appendChild(el)
    try {
      // jsdom reports zero rects: treated as missing, never strands.
      expect(measureTourTarget('zero-size')).toBeNull()
    } finally {
      el.remove()
    }
  })
})
