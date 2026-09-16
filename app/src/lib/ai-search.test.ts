import { describe, expect, it, vi } from 'vitest'
import { AI_PRESETS, AiError, chatCompletion } from './ai'
import { SearchError, summaryPrompt, webSearch } from './search'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('T13 AI client', () => {
  it('has working keyless defaults', () => {
    expect(AI_PRESETS.pollinations.needsKey).toBe(false)
    expect(AI_PRESETS.ollama.baseUrl).toContain('11434')
    expect(AI_PRESETS.openai.needsKey).toBe(true)
  })

  it('returns the assistant text', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: '  hi  ' } }] }),
    )
    const out = await chatCompletion(
      { baseUrl: 'https://x.test/v1/', apiKey: '', model: 'm' },
      [{ role: 'user', content: 'hi' }],
      fetchFn as unknown as typeof fetch,
    )
    expect(out).toBe('  hi  ')
    const calls = fetchFn.mock.calls as unknown as Array<[string, RequestInit]>
    const [, init] = calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it('sends the key and joins content parts', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: [{ text: 'a' }, { text: 'b' }] } }],
      }),
    )
    const out = await chatCompletion(
      { baseUrl: 'https://x.test/v1', apiKey: 'sk-1', model: 'm' },
      [{ role: 'user', content: 'hi' }],
      fetchFn as unknown as typeof fetch,
    )
    expect(out).toBe('ab')
    const calls = fetchFn.mock.calls as unknown as Array<[string, RequestInit]>
    const [, init] = calls[0]
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer sk-1',
    )
  })

  it('surfaces provider errors and empty replies', async () => {
    const failing = vi.fn(async () =>
      jsonResponse({ error: { message: 'bad key' } }, 401),
    )
    await expect(
      chatCompletion(
        { baseUrl: 'https://x/v1', apiKey: 'k', model: 'm' },
        [{ role: 'user', content: 'hi' }],
        failing as unknown as typeof fetch,
      ),
    ).rejects.toThrow('bad key')
    const empty = vi.fn(async () => jsonResponse({ choices: [] }))
    await expect(
      chatCompletion(
        { baseUrl: 'https://x/v1', apiKey: '', model: 'm' },
        [{ role: 'user', content: 'hi' }],
        empty as unknown as typeof fetch,
      ),
    ).rejects.toThrow(AiError)
    const down = vi.fn(async () => {
      throw new Error('nope')
    })
    await expect(
      chatCompletion(
        { baseUrl: 'https://x/v1', apiKey: '', model: 'm' },
        [{ role: 'user', content: 'hi' }],
        down as unknown as typeof fetch,
      ),
    ).rejects.toThrow('ai-unreachable')
  })

  it('refuses without configuration', async () => {
    await expect(
      chatCompletion({ baseUrl: '', apiKey: '', model: '' }, [
        { role: 'user', content: 'hi' },
      ]),
    ).rejects.toThrow('ai-not-configured')
  })
})

describe('T13 search client', () => {
  it('parses DuckDuckGo instant answers', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        Heading: 'Cat',
        AbstractText: 'A small cat.',
        AbstractURL: 'https://duckduckgo.com/cat',
        AbstractSource: 'Wikipedia',
        RelatedTopics: [
          { Text: 'Kitten - A young cat', FirstURL: 'https://x.test/k' },
          {
            Name: 'Breeds',
            Topics: [{ Text: 'Siamese - A breed', FirstURL: 'https://x.test/s' }],
          },
        ],
        Results: [],
      }),
    )
    const out = await webSearch('cat', {
      provider: 'duckduckgo',
      braveKey: '',
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out.answer?.abstract).toBe('A small cat.')
    expect(out.results.map((r) => r.url)).toEqual([
      'https://x.test/k',
      'https://x.test/s',
    ])
  })

  it('parses Brave results and requires a key', async () => {
    await expect(
      webSearch('cat', { provider: 'brave', braveKey: '  ' }),
    ).rejects.toThrow('search-needs-key')
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        web: {
          results: [
            { title: 'T', url: 'https://x.test/t', description: 'D' },
            { title: '', url: 'https://x.test/skip' },
          ],
        },
      }),
    )
    const out = await webSearch('cat', {
      provider: 'brave',
      braveKey: 'k',
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(out.results).toEqual([
      { title: 'T', url: 'https://x.test/t', snippet: 'D' },
    ])
    const calls = fetchFn.mock.calls as unknown as Array<[string, RequestInit?]>
    const [, init] = calls[0]
    expect((init?.headers as Record<string, string>)?.['X-Subscription-Token']).toBe('k')
  })

  it('rejects empty queries and bad responses', async () => {
    await expect(
      webSearch('   ', { provider: 'duckduckgo', braveKey: '' }),
    ).rejects.toThrow('search-empty')
    const bad = vi.fn(async () => new Response('nope', { status: 500 }))
    await expect(
      webSearch('cat', {
        provider: 'duckduckgo',
        braveKey: '',
        fetchFn: bad as unknown as typeof fetch,
      }),
    ).rejects.toThrow('search-http-500')
  })

  it('builds a grounded summary prompt', () => {
    const prompt = summaryPrompt('cats?', [
      { title: 'A', url: 'https://a.test', snippet: 'S1' },
      { title: 'B', url: 'https://b.test', snippet: 'S2' },
    ])
    expect(prompt).toHaveLength(2)
    expect(prompt[1].content).toContain('[1] A')
    expect(prompt[1].content).toContain('https://b.test')
  })
})

describe('T13 error types', () => {
  it('are distinguishable Errors', () => {
    expect(new AiError('x').name).toBe('AiError')
    expect(new SearchError('y').name).toBe('SearchError')
  })
})
