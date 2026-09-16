import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SearchView from './SearchView'
import '../../lib/i18n'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(
  impl: (url: string) => Promise<Response>,
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => impl(url)),
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('T13 search view', () => {
  it('searches, summarizes with AI and lists results', async () => {
    mockFetch(async (url) => {
      if (url.includes('duckduckgo')) {
        return jsonResponse({
          Heading: 'Cat',
          AbstractText: 'A small cat.',
          AbstractURL: 'https://duckduckgo.com/cat',
          AbstractSource: 'Wikipedia',
          RelatedTopics: [
            { Text: 'Kitten - Young', FirstURL: 'https://x.test/k' },
          ],
          Results: [],
        })
      }
      return jsonResponse({
        choices: [{ message: { content: 'Cats are small. [1]' } }],
      })
    })
    render(<SearchView />)
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), {
      target: { value: 'cat' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(await screen.findByText('A small cat.')).toBeTruthy()
    expect(await screen.findByText('Cats are small. [1]')).toBeTruthy()
    expect(screen.getByRole('link', { name: /open/i })).toBeTruthy()
  })

  it('shows provider errors honestly', async () => {
    mockFetch(async () => {
      throw new Error('offline')
    })
    render(<SearchView />)
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), {
      target: { value: 'cat' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
