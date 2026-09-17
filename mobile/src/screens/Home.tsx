import { useEffect, useState } from 'react'
import { Bot, Calculator, FileText, NotebookPen, Search } from 'lucide-react'
import { useApp } from '../state/app'
import { useI18n } from '../state/i18n'
import { getFs } from '../lib/fs'
import { listNotes, type NoteEntry } from '../lib/notes'
import { loadEvents, upcoming, dayLabel } from '../lib/calendar'
import { loadSearchHistory } from '../lib/searchHistory'
import { loadSessions } from '@shared/lib/chat'
import { TopBar } from '../components/navigation'

const QUICK_META = [
  { id: 'note', icon: NotebookPen, labelKey: 'home.newNote' },
  { id: 'search', icon: Search, labelKey: 'home.search' },
  { id: 'tutor', icon: Bot, labelKey: 'home.askAi' },
  { id: 'calc', icon: Calculator, labelKey: 'more.calculator' },
] as const

export function HomeScreen() {
  const { t } = useI18n()
  const { go, goTab, setSearchDraft, setTutorDraft, settings } = useApp()
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [lastChat, setLastChat] = useState<string | null>(null)
  const [searches, setSearches] = useState<string[]>([])
  const [events, setEvents] = useState(() => upcoming(loadEvents(), new Date(), 3))

  useEffect(() => {
    let alive = true
    void listNotes(getFs()).then((all) => {
      if (alive) setNotes(all.slice(-5).reverse())
    })
    const chats = loadSessions()
    if (chats.length > 0) setLastChat(chats[0].title)
    setSearches(loadSearchHistory().slice(0, 3))
    setEvents(upcoming(loadEvents(), new Date(), 3))
    return () => {
      alive = false
    }
  }, [])

  const actions = QUICK_META.filter((a) => settings.quickActions.includes(a.id))

  const recents: { key: string; icon: 'note' | 'chat' | 'search'; text: string; go: () => void }[] = [
    ...notes.slice(0, 2).map((n) => ({
      key: `note:${n.path}`,
      icon: 'note' as const,
      text: n.title,
      go: () => go({ name: 'note', path: n.path }),
    })),
    ...(lastChat
      ? [
          {
            key: 'chat:last',
            icon: 'chat' as const,
            text: lastChat,
            go: () => goTab('tutor'),
          },
        ]
      : []),
    ...searches.slice(0, 2).map((q) => ({
      key: `search:${q}`,
      icon: 'search' as const,
      text: q,
      go: () => {
        setSearchDraft(q)
        goTab('search')
      },
    })),
  ]

  function RecentIcon({ kind }: { kind: 'note' | 'chat' | 'search' }) {
    const style = { marginRight: 10, verticalAlign: -4 } as const
    if (kind === 'note') return <FileText aria-hidden style={style} />
    if (kind === 'chat') return <Bot aria-hidden style={style} />
    return <Search aria-hidden style={style} />
  }

  return (
    <>
      <TopBar title="STDHub" />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section>
          <h1 style={{ fontSize: 24, margin: '4px 0' }}>{t('home.hello')}</h1>
          <p className="m-muted" style={{ margin: '0 0 12px' }}>
            {t('home.whatNext')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  if (a.id === 'note') go({ name: 'note', path: null })
                  else if (a.id === 'search') goTab('search')
                  else if (a.id === 'tutor') goTab('tutor')
                  else go({ name: 'calc' })
                }}
                className="m-card"
                style={{ width: '100%', textAlign: 'left', fontSize: 17 }}
                data-tour={a.id === 'note' ? 'new-note' : undefined}
              >
                <a.icon aria-hidden style={{ marginRight: 10, verticalAlign: -4 }} />
                {t(a.labelKey)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>
            {t('home.continueStudying')}
          </h2>
          {recents.length === 0 ? (
            <p className="m-muted" style={{ fontSize: 14 }}>
              {t('home.emptyRecents')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recents.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={r.go}
                  className="m-card"
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  <RecentIcon kind={r.icon} />
                  {r.text}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>{t('home.upcoming')}</h2>
          {events.length === 0 ? (
            <p className="m-muted" style={{ fontSize: 14 }}>
              {t('home.emptyEvents')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => go({ name: 'calendar' })}
                  className="m-card"
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div className="m-muted" style={{ fontSize: 13 }}>
                    {dayLabel(e.date)}
                    {e.time !== '' ? ` • ${e.time}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => go({ name: 'calendar' })}
            style={{
              background: 'none',
              border: 0,
              color: 'var(--accent)',
              padding: '10px 0',
              fontSize: 14,
            }}
          >
            {t('home.openCalendar')}
          </button>
        </section>

        <section>
          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>{t('home.shortcuts')}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => go({ name: 'calc' })}
              className="m-card"
              style={{ flex: 1 }}
              aria-label={t('more.calculator')}
            >
              <Calculator aria-hidden style={{ width: 24, height: 24 }} />
            </button>
            <button
              type="button"
              onClick={() => goTab('tutor')}
              className="m-card"
              style={{ flex: 1 }}
              aria-label={t('tutor.title')}
            >
              <Bot aria-hidden style={{ width: 24, height: 24 }} />
            </button>
            <button
              type="button"
              onClick={() => {
                setTutorDraft(null)
                goTab('notebook')
              }}
              className="m-card"
              style={{ flex: 1 }}
              aria-label={t('notebook.title')}
            >
              <FileText aria-hidden style={{ width: 24, height: 24 }} />
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
