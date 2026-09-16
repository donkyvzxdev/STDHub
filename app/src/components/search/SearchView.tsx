import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, ExternalLink, Loader2, Search as SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { chatCompletion, type AiProviderConfig } from '@/lib/ai'
import {
  summaryPrompt,
  webSearch,
  type SearchAnswer,
  type SearchResultItem,
} from '@/lib/search'
import { loadSettings } from '@/lib/settings'

async function aiConfig(): Promise<AiProviderConfig> {
  const settings = await loadSettings()
  return {
    baseUrl: settings.ai.baseUrl,
    apiKey: settings.ai.apiKey,
    model: settings.ai.model,
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function AnswerCard({ answer }: { answer: SearchAnswer }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <p className="font-medium">{answer.heading || t('search.answer')}</p>
        {answer.source !== '' ? (
          <Badge variant="secondary">{answer.source}</Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{answer.abstract}</p>
      {answer.url !== '' ? (
        <a
          href={answer.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
        >
          <ExternalLink className="size-3" aria-hidden />
          {answer.url}
        </a>
      ) : null}
    </div>
  )
}

function ResultRow({ item }: { item: SearchResultItem }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        {item.title}
      </a>
      <p className="text-sm text-muted-foreground">{item.snippet}</p>
      <div className="flex items-center gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
        >
          <ExternalLink className="size-3" aria-hidden />
          {t('search.open')}
        </a>
        <button
          type="button"
          aria-label={t('search.copyLink', { title: item.title })}
          onClick={() => void copyText(item.url)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Copy className="size-3" aria-hidden />
          {t('search.copyLinkShort')}
        </button>
      </div>
    </div>
  )
}

function SearchView() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [answer, setAnswer] = useState<SearchAnswer | null>(null)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function run(): Promise<void> {
    const q = query.trim()
    if (q === '' || busy) return
    setBusy(true)
    setSummarizing(false)
    setError(null)
    setSummary(null)
    try {
      const settings = await loadSettings()
      const res = await webSearch(q, {
        provider: settings.search.provider,
        braveKey: settings.search.braveKey,
      })
      setAnswer(res.answer)
      setResults(res.results)
      setSearched(true)
      if (res.results.length > 0) {
        setSummarizing(true)
        try {
          const text = await chatCompletion(
            await aiConfig(),
            summaryPrompt(q, res.results),
          )
          setSummary(text)
        } catch (e) {
          setSummary(null)
          setError(e instanceof Error ? e.message : 'search-summary-failed')
        } finally {
          setSummarizing(false)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'search-failed')
      setSearched(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl animate-in flex-col gap-3 p-6 fade-in duration-300">
      <div className="flex gap-2">
        <Input
          aria-label={t('search.query')}
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run()
          }}
        />
        <Button type="button" disabled={busy} onClick={() => void run()}>
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <SearchIcon aria-hidden />
          )}
          {t('search.search')}
        </Button>
      </div>

      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {summarizing ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('search.summarizing')}
        </div>
      ) : null}

      {summary !== null ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">{t('search.summary')}</p>
            <button
              type="button"
              aria-label={t('search.copySummary')}
              onClick={() => void copyText(summary)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="size-3" aria-hidden />
              {t('search.copySummary')}
            </button>
          </div>
          <p className="text-sm whitespace-pre-wrap">{summary}</p>
        </div>
      ) : null}

      {answer ? <AnswerCard answer={answer} /> : null}

      {searched && !busy && results.length === 0 && error === null ? (
        <p className="text-sm text-muted-foreground">{t('search.noResults')}</p>
      ) : null}

      {results.map((item) => (
        <ResultRow key={item.url} item={item} />
      ))}
    </div>
  )
}

export default SearchView
