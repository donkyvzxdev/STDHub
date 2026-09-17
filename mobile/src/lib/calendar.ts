export interface CalendarEvent {
  id: string
  title: string
  /** ISO date `YYYY-MM-DD` (local calendar day). */
  date: string
  /** `HH:MM` 24h, or '' for all-day. */
  time: string
  notes: string
  /** Minutes before; 0 = at the time, -1 = none. */
  remindMinutes: number
}

const STORAGE_KEY = 'stdhub.mobile.calendar'
let counter = 0

export function newEventId(): string {
  counter += 1
  return `evt-${Date.now().toString(36)}-${counter}`
}

export function todayKey(now = new Date()): string {
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function toKey(year: number, month: number, day: number): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${year}-${p(month)}-${p(day)}`
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** Human day label relative to today: Today / Tomorrow / weekday / date. */
export function dayLabel(key: string, now = new Date(), lang = 'en'): string {
  const today = todayKey(now)
  if (key === today) return lang === 'pt' ? 'Hoje' : 'Today'
  if (key === addDaysKey(today, 1)) return lang === 'pt' ? 'Amanhã' : 'Tomorrow'
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const diffDays = Math.round(
    (date.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86400000,
  )
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', {
      weekday: 'long',
    })
  }
  return date.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', {
    day: '2-digit',
    month: 'short',
  })
}

function isEvent(value: unknown): value is CalendarEvent {
  if (typeof value !== 'object' || value === null) return false
  const rec = value as Record<string, unknown>
  return (
    typeof rec['id'] === 'string' &&
    typeof rec['title'] === 'string' &&
    typeof rec['date'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(rec['date'] as string) &&
    typeof rec['time'] === 'string' &&
    typeof rec['notes'] === 'string' &&
    typeof rec['remindMinutes'] === 'number'
  )
}

export function loadEvents(): CalendarEvent[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEvent)
  } catch {
    return []
  }
}

export function storeEvents(events: CalendarEvent[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // ignore
  }
}

function timeRank(time: string): number {
  if (time === '') return 24 * 60 + 1
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || timeRank(a.time) - timeRank(b.time),
  )
}

/** Upcoming from today onward, sorted, optionally capped. */
export function upcoming(
  events: CalendarEvent[],
  now = new Date(),
  limit = 3,
): CalendarEvent[] {
  const today = todayKey(now)
  return sortEvents(events.filter((e) => e.date >= today)).slice(0, limit)
}

export function eventsOn(events: CalendarEvent[], key: string): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.date === key))
}

/** 6x7 month grid cells; null pads days outside the month. */
export function monthGrid(
  year: number,
  month: number,
  weekStartsMonday: boolean,
): (string | null)[] {
  const first = new Date(year, month - 1, 1)
  let lead = first.getDay()
  if (weekStartsMonday) lead = (lead + 6) % 7
  const days = new Date(year, month, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(toKey(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  while (cells.length < 42) cells.push(null)
  return cells
}

export function validateEvent(input: {
  title: string
  date: string
  time: string
}): string | null {
  if (input.title.trim() === '') return 'empty'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'generic'
  if (input.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    return 'generic'
  }
  return null
}
