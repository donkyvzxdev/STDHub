import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudyNotebook from './StudyNotebook'
import '../../lib/i18n'

describe('StudyNotebook', () => {
  it('renders study marks and headings', () => {
    render(
      <StudyNotebook source={'# Guia\n\n==destaque== e ++sub++\n'} />,
    )
    expect(screen.getByText('Guia')).toBeTruthy()
    expect(screen.getByText('destaque').tagName).toBe('MARK')
    expect(screen.getByText('sub').tagName).toBe('U')
  })

  it('flips flashcards on click', () => {
    render(
      <StudyNotebook source={':::flashcard\nfrente\n---\nverso\n:::'} />,
    )
    expect(screen.getByText('frente')).toBeTruthy()
    expect(screen.queryByText('verso')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /flip/i }))
    expect(screen.getByText('verso')).toBeTruthy()
  })

  it('checks quizzes and scores without touching the file', () => {
    const onToggleTask = vi.fn()
    render(
      <StudyNotebook
        source={':::quiz\nQ?\n- [ ] errada\n- [x] certa\n:::'}
        onToggleTask={onToggleTask}
      />,
    )
    fireEvent.click(screen.getByText('certa'))
    fireEvent.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByText(/2 of 2 correct/i)).toBeTruthy()
    expect(onToggleTask).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.queryByText(/2 of 2 correct/i)).toBeNull()
  })

  it('evaluates calc blocks and flags bad lines', () => {
    render(<StudyNotebook source={'```calc\n2*(3+4)\n1/0\n```'} />)
    expect(screen.getByText('14')).toBeTruthy()
    expect(screen.getByText(/couldn't evaluate/i)).toBeTruthy()
  })

  it('writes task toggles back by source line', () => {
    const onToggleTask = vi.fn()
    render(
      <StudyNotebook source={'- [ ] uma\n- [x] outra'} onToggleTask={onToggleTask} />,
    )
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes[0]).not.toBeChecked()
    expect(boxes[1]).toBeChecked()
    fireEvent.click(boxes[0])
    expect(onToggleTask).toHaveBeenCalledWith(0)
  })

  it('renders callouts, tables and code', () => {    render(
      <StudyNotebook
        source={':::aviso\ncuidado\n:::\n\n| A |\n| --- |\n| 1 |\n\n```js\nx\n```'}
      />,
    )
    expect(screen.getByText('cuidado')).toBeTruthy()
    const table = screen.getByRole('table')
    expect(within(table).getByText('1')).toBeTruthy()
    expect(screen.getByText('x')).toBeTruthy()
  })

  it('renders #std inline markers as widgets', () => {
    render(
      <StudyNotebook
        source={'#stdcalc 39 * 37 =\n\n#stdmarker texto importante /stdmarker\n\n#stdcalc 2+ =\n'}
      />,
    )
    expect(screen.getByTestId('study-notebook').textContent).toContain(
      '39 * 37 = 1443',
    )
    expect(screen.getByText('texto importante').tagName).toBe('MARK')
    expect(screen.getByText('?')).toBeTruthy()
  })

  it('leaves incomplete #std syntax raw', () => {
    render(<StudyNotebook source={'#stdcalc 2+2\n'} />)
    expect(screen.getByText('#stdcalc 2+2')).toBeTruthy()
  })

  it('shows bare markers instead of an empty sliver', () => {
    render(<StudyNotebook source={'#\n\n##\n\n>\n'} />)
    expect(screen.getByText('#')).toBeTruthy()
    expect(screen.getByText('##')).toBeTruthy()
    expect(screen.getByText('>')).toBeTruthy()
  })
})
