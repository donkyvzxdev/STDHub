import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../state/i18n'
import { TourOverlay } from './TourOverlay'
import type { TourStep } from '../lib/tour'

const STEPS: TourStep[] = [
  { id: 'welcome', title: 'Welcome', text: 'Start here.' },
  { id: 'second', title: 'Second', text: 'Tap there.', tab: 'search', target: 'search-input' },
  { id: 'final', title: 'Done', text: 'Bye.', final: true },
]

function show(onNavigate = () => undefined, onDone = () => undefined) {
  return render(
    <I18nProvider initial="en">
      <TourOverlay steps={STEPS} onNavigate={onNavigate} onDone={onDone} />
    </I18nProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('tour overlay', () => {
  it('walks steps and navigates on arrival', () => {
    const onNavigate = vi.fn()
    const onDone = vi.fn()
    show(onNavigate, onDone)
    expect(screen.getByText('Welcome')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNavigate).toHaveBeenCalledWith('search')
    expect(screen.getByText('Second')).toBeTruthy()
    // No layout in jsdom: falls back to a centered card, never strands.
    expect(screen.queryByTestId('tour-ring')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Done')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('skips from any step', () => {
    const onDone = vi.fn()
    show(() => undefined, onDone)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('rings a real target', () => {
    const el = document.createElement('input')
    el.setAttribute('data-tour', 'search-input')
    document.body.appendChild(el)
    const rect = {
      x: 20, y: 300, width: 200, height: 48,
      top: 300, left: 20, bottom: 348, right: 220,
      toJSON: () => ({}),
    } as unknown as DOMRect
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect)
    try {
      const onNavigate = vi.fn()
      show(onNavigate, () => undefined)
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.getByTestId('tour-ring')).toBeTruthy()
      expect(screen.getByTestId('tour-card')).toBeTruthy()
    } finally {
      el.remove()
    }
  })
})
