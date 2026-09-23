import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StmdToolbar from './StmdToolbar'
import '../../lib/i18n'

describe('StmdToolbar', () => {
  it('wraps marks through the callback', () => {
    const onWrap = vi.fn()
    render(
      <StmdToolbar onWrap={onWrap} onInsert={vi.fn()} onOpenDrawing={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^bold$/i }))
    expect(onWrap).toHaveBeenCalledWith('**', '**')
    fireEvent.click(screen.getByRole('button', { name: /^highlight$/i }))
    expect(onWrap).toHaveBeenCalledWith('==', '==')
  })

  it('inserts blocks and opens the drawing pad', () => {
    const onInsert = vi.fn()
    const onWrap = vi.fn()
    const onOpenDrawing = vi.fn()
    render(
      <StmdToolbar onWrap={onWrap} onInsert={onInsert} onOpenDrawing={onOpenDrawing} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^flashcard$/i }))
    expect(onInsert).toHaveBeenCalledWith(
      expect.stringContaining(':::flashcard'),
    )
    fireEvent.click(screen.getByRole('button', { name: /^quiz$/i }))
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining(':::quiz'))
    fireEvent.click(screen.getByRole('button', { name: /^calculation$/i }))
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('```calc'))
    fireEvent.click(screen.getByRole('button', { name: /^quick calc$/i }))
    expect(onWrap).toHaveBeenCalledWith('#stdcalc ', ' =')
    fireEvent.click(screen.getByRole('button', { name: /^marker$/i }))
    expect(onWrap).toHaveBeenCalledWith('#stdmarker ', ' /stdmarker')
    fireEvent.click(screen.getByRole('button', { name: /^pen drawing$/i }))
    expect(onOpenDrawing).toHaveBeenCalledTimes(1)
  })
})
