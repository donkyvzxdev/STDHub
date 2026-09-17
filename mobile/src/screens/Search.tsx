import { useEffect, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { useApp } from '../state/app'
import { useI18n } from '../state/i18n'
import { chatCompletion } from '@shared/lib/ai'
import {
  summaryPrompt,
  webSearch,
  type SearchAnswer,
  type SearchResultItem,
} from '@shared/lib/search'
import {
  clearSearchHistory,
  loadSearchHistory,
  pushSearchHistory,
} from '../lib/searchHistory'
import { errorKey } from '../lib/errors'
import { copyText, shareText } from '../lib/share'
import { getFs } from '../lib/fs'
import { writeNote } from '../lib/notes'
import { TopBar } from '../components/navigation'
import { EmptyState } from '../components/ui/primitives'

export function SearchScreen() {
  const { t } = useI18n()
  const { go, goTab, setTutorDraft, settings, showToast, searchDraft, setSearchDraft } = useApp()
  const [query, setQuery] = useState(searchDraft ?? '')
  const [busy, setBusy] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [answer, setAnswer] = useState<SearchAnswer | null>(null)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [history, setHistory] = useState<string[]>(loadSearchHistory)

  // A prefilled query (e.g. from Home recents) runs once on arrival.
  useEffect(() => {
    if (searchDraft && searchDraft.trim() !== '') {
      const q = searchDraft
      setSearchDraft(null)
      void run(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(q?: string): Promise<void> {
    const text = (q ?? query).trim()
    if (text === '' || busy) return
    if (q !== undefined) setQuery(text)
    if (!navigator.onLine) {
      setError(t('errors.searchOffline'))
      setSearched(true)
      return
    }
    setBusy(true)
    setSummarizing(false)
    setError(null)
    setSummary(null)
    setExpanded(false)
    try {
      const res = await webSearch(text, {
        provider: settings.search.provider,
        braveKey: settings.search.braveKey,
      })
      setAnswer(res.answer)
      setResults(res.results)
      setSearched(true)
      setHistory(pushSearchHistory(text))
      if (res.results.length > 0) {
        setSummarizing(true)
        try {
          const out = await chatCompletion(
            {
              baseUrl: settings.ai.baseUrl,
              apiKey: settings.ai.apiKey,
              model: settings.ai.model,
            },
            summaryPrompt(text, res.results),
          )
          setSummary(out)
        } catch (e) {
          setError(t(errorKey(e instanceof Error ? e.message : 'generic')))
        } finally {
          setSummarizing(false)
        }
      }
    } catch (e) {
      setError(t(errorKey(e instanceof Error ? e.message : 'generic')))
      setSearched(true)
    } finally {
      setBusy(false)
    }
  }

  async function askTutor(prompt: string): Promise<void> {
    setTutorDraft(`${prompt}\n\n${t('tutor.contextFrom')}: "${query}"`)
    goTab('tutor')
  }

  async function saveToNotebook(): Promise<void> {
    if (!summary && results.length === 0) return
    const lines = [
      `# ${query}`,
      '',
      summary ? `## ${t('search.summaryByAi')}` : '',
      summary ?? '',
      '',
      `## ${t('search.sources')}`,
      ...results.map((r, i) => `${i + 1}. [${r.title}](${r.url})`),
      '',
    ]
    try {
      const path = await writeNote(getFs(), '', query.slice(0, 40), lines.join('\n'))
      showToast(t('common.saved'))
      go({ name: 'note', path })
    } catch (e) {
      setError(t(errorKey(e instanceof Error ? e.message : 'generic')))
    }
  }

  return (
    <>
      <TopBar title={t('search.title')} />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            aria-label={t('search.placeholder')}
            data-tour="search-input"
            value={query}
            placeholder={t('search.placeholder')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run()
            }}
            className="m-input"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            aria-label={t('search.search')}
            style={{
              minWidth: 52,
              minHeight: 'var(--tap)',
              borderRadius: 10,
              border: 0,
              background: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            {busy ? '…' : <SearchIcon aria-hidden style={{ width: 22, height: 22 }} />}
          </button>
        </div>

        {!searched && history.length > 0 && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>{t('search.recent')}</strong>
              <button
                type="button"
                onClick={() => {
                  clearSearchHistory()
                  setHistory([])
                }}
                style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 13 }}
              >
                {t('search.clearHistory')}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {history.map((h) => (
                <button key={h} type="button" onClick={() => void run(h)} className="m-card" style={{ textAlign: 'left' }}>
                  🔎 {h}
                </button>
              ))}
            </div>
          </section>
        )}

        {error !== null && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: 14 }}>
            {error}
          </p>
        )}

        {summarizing && <p className="m-muted">⏳ {t('search.summarizing')}</p>}

        {summary !== null && (
          <section className="m-card">
            <strong>✨ {t('search.summaryByAi')}</strong>
            <p style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {expanded || summary.length < 400 ? summary : `${summary.slice(0, 400)}…`}
            </p>
            {summary.length >= 400 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                style={{ background: 'none', border: 0, color: 'var(--accent)', padding: '6px 0' }}
              >
                {expanded ? t('search.showLess') : t('search.showMore')}
              </button>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <button type="button" className="m-btn" onClick={() => void askTutor(t('search.explainSimple'))}>
                {t('search.explainSimple')}
              </button>
              <button type="button" className="m-btn" onClick={() => void askTutor(t('search.makeTopics'))}>
                {t('search.makeTopics')}
              </button>
              <button type="button" className="m-btn" onClick={() => void askTutor(t('search.makeQuiz'))}>
                {t('search.makeQuiz')}
              </button>
              <button type="button" className="m-btn m-btn-primary" onClick={() => void saveToNotebook()}>
                {t('search.saveNotebook')}
              </button>
            </div>
          </section>
        )}

        {answer && (
          <section className="m-card">
            <strong>{answer.heading || t('search.summaryByAi')}</strong>
            <p className="m-muted" style={{ fontSize: 14 }}>{answer.abstract}</p>
          </section>
        )}

        {searched && results.length > 0 && (
          <section>
            <strong style={{ fontSize: 14 }}>{t('search.sources')}</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {results.map((r, i) => (
                <div key={r.url} className="m-card">
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {i + 1}. {r.title}
                  </div>
                  <div className="m-muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>
                    {r.snippet}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <a href={r.url} style={{ color: 'var(--accent)', fontSize: 14 }}>
                      {t('search.openLink')}
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyText(r.url).then((ok) => ok && showToast(t('calc.copied')))}
                      style={{ background: 'none', border: 0, color: 'var(--accent)', fontSize: 14 }}
                    >
                      {t('search.copyLink')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareText(`${r.title}\n${r.url}`, r.title)}
                      style={{ background: 'none', border: 0, color: 'var(--accent)', fontSize: 14 }}
                    >
                      {t('search.shareResult')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!searched && (
          <EmptyState title={t('search.noResults')} />
        )}
      </div>
    </>
  )
}
