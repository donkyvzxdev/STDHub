import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EditorPanel from './EditorPanel'
import '../../lib/i18n'

let host: HTMLDivElement | null = null

afterEach(() => {
  host?.remove()
  host = null
})

function setup(): void {
  host = document.createElement('div')
  document.body.appendChild(host)
  const noop = vi.fn()
  render(<EditorPanel hostRef={() => undefined} onOpenFolder={noop} />)
}

describe('T07c editor panel', () => {
  it('shows the open-folder button before any folder', () => {
    setup()
    expect(
      screen.getByRole('button', { name: /open folder/i }),
    ).toBeTruthy()
  })

  it('hides the open-folder button once a folder is open', () => {
    setup()
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:root', { detail: { root: 'C:/x' } }),
      )
    })
    expect(screen.queryByRole('button', { name: /open folder/i })).toBeNull()
    expect(
      screen.getByRole('button', { name: /change folder/i }),
    ).toBeTruthy()
  })

  it('opens the picker from the panel button', () => {
    const onOpenFolder = vi.fn()
    host = document.createElement('div')
    document.body.appendChild(host)
    render(
      <EditorPanel hostRef={() => undefined} onOpenFolder={onOpenFolder} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open folder/i }))
    expect(onOpenFolder).toHaveBeenCalledTimes(1)
  })

  it('shows filesystem errors in the panel and clears them on root', async () => {
    setup()
    expect(screen.queryByRole('alert')).toBeNull()
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:fs-error', { detail: { code: 'unsupported' } }),
      )
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /needs the desktop app/i,
    )
    act(() => {
      window.dispatchEvent(
        new CustomEvent('stdhub:root', { detail: { root: 'C:/x' } }),
      )
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
