export type SearchProviderId = 'duckduckgo' | 'brave'

export interface SearchResultItem {
  title: string
  url: string
  snippet: string
}

export interface SearchAnswer {
  heading: string
  abstract: string
  url: string
  source: string
}

export interface SearchResponse {
  answer: SearchAnswer | null
  results: SearchResultItem[]
}

export class SearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SearchError'
  }
}

type FetchFn = typeof fetch;

export interface SearchOptions {
  provider: SearchProviderId
  braveKey: string
  fetchFn?: FetchFn
}

export async function webSearch(
  query: string,
  options: SearchOptions,
): Promise<SearchResponse> {
  const q = query.trim()
  if (q === '') throw new SearchError('search-empty')
  const fetchFn = options.fetchFn ?? fetch
  if (options.provider === 'brave') return braveSearch(q, options.braveKey, fetchFn)
  return duckSearch(q, fetchFn)
}

async function readJson(fetchFn: FetchFn, url: string, headers?: Record<string, string>) {
  let res: Response
  try {
    res = await fetchFn(url, headers ? { headers } : undefined)
  } catch {
    throw new SearchError('search-unreachable')
  }
  if (!res.ok) throw new SearchError(`search-http-${res.status}`)
  try {
    return (await res.json()) as unknown
  } catch {
    throw new SearchError('search-bad-response')
  }
}

/** DuckDuckGo Instant Answer API: free, no key, CORS-open. */
async function duckSearch(q: string, fetchFn: FetchFn): Promise<SearchResponse> {
  const url =
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}` +
    `&format=json&no_html=1&skip_disambig=1`
  const body = (await readJson(fetchFn, url)) as Record<string, unknown>
  const text = (v: unknown): string => (typeof v === 'string' ? v : '')
  const abstract = text(body['AbstractText'])
  const answer: SearchAnswer | null =
    abstract !== ''
      ? {
          heading: text(body['Heading']),
          abstract,
          url: text(body['AbstractURL']),
          source: text(body['AbstractSource']),
        }
      : null
  const results: SearchResultItem[] = []
  const pushTopic = (topic: unknown): void => {
    if (typeof topic !== 'object' || topic === null) return
    const rec = topic as Record<string, unknown>
    if (Array.isArray(rec['Topics'])) {
      for (const sub of rec['Topics'] as unknown[]) pushTopic(sub)
      return
    }
    const title = text(rec['Text']).split(' - ')[0] || text(rec['Text'])
    const link = text(rec['FirstURL'])
    if (title === '' || link === '') return
    results.push({ title, url: link, snippet: text(rec['Text']) })
  }
  const related = body['RelatedTopics']
  if (Array.isArray(related)) {
    for (const topic of related) {
      pushTopic(topic)
      if (results.length >= 10) break
    }
  }
  const direct = body['Results']
  if (Array.isArray(direct)) {
    for (const item of direct) {
      pushTopic(item)
      if (results.length >= 10) break
    }
  }
  return { answer, results: results.slice(0, 10) }
}

/** Brave Web Search API: needs a (free-tier eligible) API key. */
async function braveSearch(
  q: string,
  key: string,
  fetchFn: FetchFn,
): Promise<SearchResponse> {
  if (key.trim() === '') throw new SearchError('search-needs-key')
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`
  const body = (await readJson(fetchFn, url, {
    'X-Subscription-Token': key.trim(),
    Accept: 'application/json',
  })) as Record<string, unknown>
  const web = body['web'] as Record<string, unknown> | undefined
  const raw = web && Array.isArray(web['results']) ? (web['results'] as unknown[]) : []
  const text = (v: unknown): string => (typeof v === 'string' ? v : '')
  const results: SearchResultItem[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    const title = text(rec['title'])
    const link = text(rec['url'])
    if (title === '' || link === '') continue
    results.push({ title, url: link, snippet: text(rec['description']) })
  }
  return { answer: null, results: results.slice(0, 10) }
}

/** Google-style AI overview: summarize the top hits with the chosen model. */
export function summaryPrompt(query: string, results: SearchResultItem[]): ChatMsgLike[] {
  const context = results
    .slice(0, 6)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
    .join('\n\n')
  return [
    {
      role: 'system',
      content:
        'You are a study assistant. Summarize the search results below in the query language (default English). Be short, factual, cite sources as [n]. If the results do not answer the query, say so plainly.',
    },
    {
      role: 'user',
      content: `Query: ${query}\n\nResults:\n${context}`,
    },
  ]
}

interface ChatMsgLike {
  role: 'user' | 'assistant' | 'system'
  content: string
}
