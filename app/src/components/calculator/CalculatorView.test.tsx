import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CalculatorView from './CalculatorView'
import '../../lib/i18n'

beforeEach(() => {
  window.localStorage.clear()
})

describe('T12 calculator view', () => {
  it('types, previews and commits a result', async () => {
    render(<CalculatorView />)
    const input = screen.getByRole('textbox', { name: /expression/i })
    fireEvent.change(input, { target: { value: '2*(3+4)' } })
    expect(screen.getByTestId('calc-preview')).toHaveTextContent('14')
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    expect(input).toHaveValue('14')
    expect(screen.getByText('2*(3+4) = 14')).toBeTruthy()
  })

  it('shows scientific keys on toggle', async () => {
    render(<CalculatorView />)
    expect(screen.queryByRole('button', { name: 'sin(' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /scientific/i }))
    expect(screen.getByRole('button', { name: 'sin(' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'sin(' }))
    fireEvent.change(screen.getByRole('textbox', { name: /expression/i }), {
      target: { value: 'sin(30)' },
    })
    expect(screen.getByTestId('calc-preview')).toHaveTextContent('0.5')
  })

  it('shows an error on invalid input', async () => {
    render(<CalculatorView />)
    fireEvent.change(screen.getByRole('textbox', { name: /expression/i }), {
      target: { value: '1/0' },
    })
    fireEvent.click(screen.getByRole('button', { name: '=' }))
    expect(screen.getByTestId('calc-preview')).toHaveTextContent(/invalid/i)
  })

  it('copies the result to the clipboard', async () => {
    const writes: string[] = []
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          writes.push(text)
          return Promise.resolve()
        },
      },
      configurable: true,
    })
    render(<CalculatorView />)
    fireEvent.change(screen.getByRole('textbox', { name: /expression/i }), {
      target: { value: '6*7' },
    })
    fireEvent.click(screen.getByRole('button', { name: /copy result/i }))
    await vi.waitFor(() => expect(writes).toEqual(['42']))
  })
})
