import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useApp } from '../state/app'
import { useI18n } from '../state/i18n'
import {
  dayLabel,
  eventsOn,
  loadEvents,
  monthGrid,
  newEventId,
  storeEvents,
  toKey,
  validateEvent,
  type CalendarEvent,
} from '../lib/calendar'
import { errorKey } from '../lib/errors'
import {
  cancelReminder,
  reminderAtSeconds,
  reminderIdFor,
  scheduleReminder,
} from '../services/notify'
import { TopBar, BackButton } from '../components/navigation'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Btn, Field } from '../components/ui/primitives'

const REMIND_OPTIONS = [-1, 0, 5, 30, 1440]

function remindLabel(minutes: number, t: (k: string) => string): string {
  switch (minutes) {
    case -1:
      return t('calendar.remindNone')
    case 0:
      return t('calendar.remindAt')
    case 5:
      return t('calendar.remind5')
    case 30:
      return t('calendar.remind30')
    default:
      return t('calendar.remindDay')
  }
}

export function CalendarScreen() {
  const { t, lang } = useI18n()
  const { back, settings, showToast } = useApp()
  const now = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [selected, setSelected] = useState(toKey(now.getFullYear(), now.getMonth() + 1, now.getDate()))
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(selected)
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [remind, setRemind] = useState(settings.defaultReminder)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [askRemind, setAskRemind] = useState(false)

  const monthName = new Date(cursor.y, cursor.m - 1, 1).toLocaleDateString(
    lang === 'pt' ? 'pt-BR' : 'en-US',
    { month: 'long', year: 'numeric' },
  )
  const grid = monthGrid(cursor.y, cursor.m, settings.weekStartsMonday)
  const dayEvents = eventsOn(events, selected)
  const weekDays = settings.weekStartsMonday
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  function persist(next: CalendarEvent[]): void {
    setEvents(next)
    storeEvents(next)
  }

  function openNew(): void {
    setEditing(null)
    setTitle('')
    setDate(selected)
    setTime('')
    setNotes('')
    setRemind(settings.defaultReminder)
    setError(null)
    setFormOpen(true)
  }

  function openEdit(event: CalendarEvent): void {
    setEditing(event)
    setTitle(event.title)
    setDate(event.date)
    setTime(event.time)
    setNotes(event.notes)
    setRemind(event.remindMinutes)
    setError(null)
    setFormOpen(true)
  }

  async function save(): Promise<void> {
    const invalid = validateEvent({ title, date, time })
    if (invalid) {
      setError(t(errorKey(invalid)))
      return
    }
    const event: CalendarEvent = editing
      ? { ...editing, title: title.trim(), date, time, notes, remindMinutes: remind }
      : {
          id: newEventId(),
          title: title.trim(),
          date,
          time,
          notes,
          remindMinutes: remind,
        }
    await cancelReminder(reminderIdFor(event.id))
    const at = reminderAtSeconds(event.date, event.time, event.remindMinutes)
    if (at !== null && at * 1000 > Date.now()) {
      const ok = await scheduleReminder(
        reminderIdFor(event.id),
        event.title,
        `${dayLabel(event.date)}${event.time !== '' ? ` • ${event.time}` : ''}`,
        at,
      )
      if (!ok && event.remindMinutes >= 0) {
        setAskRemind(true)
      }
    }
    persist(
      editing
        ? events.map((e) => (e.id === editing.id ? event : e))
        : [...events, event],
    )
    // Jump to the event's day so creation feedback is immediate.
    const [year, month] = date.split('-').map(Number)
    setCursor({ y: year, m: month })
    setSelected(date)
    setFormOpen(false)
    showToast(t('common.saved'))
  }

  async function remove(id: string): Promise<void> {
    await cancelReminder(reminderIdFor(id))
    persist(events.filter((e) => e.id !== id))
    setConfirmDelete(null)
  }

  function shiftMonth(dir: -1 | 1): void {
    setCursor((prev) => {
      const next = new Date(prev.y, prev.m - 1 + dir, 1)
      return { y: next.getFullYear(), m: next.getMonth() + 1 }
    })
  }

  return (
    <>
      <TopBar
        title={t('calendar.title')}
        left={<BackButton onBack={back} label={t('common.back')} />}
        right={
          <button
            type="button"
            onClick={openNew}
            aria-label={t('calendar.newEvent')}
            style={{
              minWidth: 44,
              minHeight: 44,
              background: 'var(--accent)',
              color: 'var(--accent-text)',
              border: 0,
              borderRadius: 12,
            }}
          >
            <Plus aria-hidden style={{ width: 24, height: 24 }} />
          </button>
        }
      />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="m-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="←" style={navBtn}>
              <ChevronLeft aria-hidden style={{ width: 26, height: 26 }} />
            </button>
            <strong style={{ textTransform: 'capitalize' }}>{monthName}</strong>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="→" style={navBtn}>
              <ChevronRight aria-hidden style={{ width: 26, height: 26 }} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {weekDays.map((d, i) => (
              <div key={i} className="m-muted" style={{ textAlign: 'center', fontSize: 11 }}>
                {d}
              </div>
            ))}
            {grid.map((key, i) => {
              if (key === null) return <div key={`p${i}`} />
              const has = events.some((e) => e.date === key)
              const isSel = key === selected
              const isToday = key === toKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-label={key}
                  aria-pressed={isSel}
                  style={{
                    minHeight: 44,
                    borderRadius: 10,
                    border: isSel ? '2px solid var(--accent)' : '1px solid transparent',
                    background: isToday && !isSel ? 'var(--bg-soft)' : 'transparent',
                    fontWeight: has ? 700 : 400,
                    position: 'relative',
                  }}
                >
                  {Number(key.slice(8))}
                  {has && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        background: 'var(--accent)',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <strong style={{ fontSize: 14 }}>
            {dayLabel(selected, now, lang)}
          </strong>
          {dayEvents.length === 0 ? (
            <p className="m-muted" style={{ fontSize: 14 }}>
              {t('calendar.empty')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => openEdit(event)}
                  className="m-card"
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {event.time !== '' ? `${event.time} • ` : ''}{event.title}
                  </div>
                  {event.notes !== '' && (
                    <div className="m-muted" style={{ fontSize: 13 }}>
                      {event.notes}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Btn primary onClick={openNew}>
          + {t('calendar.newEvent')}
        </Btn>
      </div>

      {formOpen && (
        <BottomSheet title={editing ? editing.title : t('calendar.newEvent')} onClose={() => setFormOpen(false)}>
          <Field label={t('calendar.eventTitle')}>
            <input
              aria-label={t('calendar.eventTitle')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="m-input"
              maxLength={80}
            />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label={t('calendar.eventDate')}>
              <input
                aria-label={t('calendar.eventDate')}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="m-input"
              />
            </Field>
            <Field label={t('calendar.eventTime')}>
              <input
                aria-label={t('calendar.eventTime')}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="m-input"
              />
            </Field>
          </div>
          <Field label={t('calendar.eventNotes')}>
            <textarea
              aria-label={t('calendar.eventNotes')}
              value={notes}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
              className="m-textarea"
              style={{ minHeight: 64 }}
            />
          </Field>
          <Field label={t('calendar.eventRemind')}>
            <select
              aria-label={t('calendar.eventRemind')}
              value={remind}
              onChange={(e) => setRemind(Number(e.target.value))}
              className="m-select"
            >
              {REMIND_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {remindLabel(minutes, t)}
                </option>
              ))}
            </select>
          </Field>
          {error !== null && (
            <p role="alert" style={{ color: 'var(--danger)', fontSize: 14 }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn primary onClick={() => void save()} style={{ flex: 1 }}>
              {t('calendar.saveEvent')}
            </Btn>
            {editing && (
              <Btn onClick={() => setConfirmDelete(editing.id)} style={{ flex: 1 }}>
                {t('calendar.deleteEvent')}
              </Btn>
            )}
          </div>
        </BottomSheet>
      )}

      {confirmDelete !== null && (
        <BottomSheet title={t('calendar.deleteConfirm')} onClose={() => setConfirmDelete(null)}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setConfirmDelete(null)} style={{ flex: 1 }}>
              {t('common.cancel')}
            </Btn>
            <Btn
              onClick={() => {
                const id = confirmDelete
                setConfirmDelete(null)
                setFormOpen(false)
                void remove(id)
              }}
              style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              {t('common.delete')}
            </Btn>
          </div>
        </BottomSheet>
      )}

      {askRemind && (
        <BottomSheet title={t('calendar.remindAskTitle')} onClose={() => setAskRemind(false)}>
          <p className="m-muted" style={{ fontSize: 14 }}>
            {t('calendar.remindAskText')}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn onClick={() => setAskRemind(false)} style={{ flex: 1 }}>
              {t('calendar.later')}
            </Btn>
            <Btn
              primary
              onClick={() => {
                setAskRemind(false)
                void ensurePermissionFlow()
              }}
              style={{ flex: 1 }}
            >
              {t('calendar.allow')}
            </Btn>
          </div>
        </BottomSheet>
      )}
    </>
  )

  async function ensurePermissionFlow(): Promise<void> {
    const { ensureNotificationPermission } = await import('../services/notify')
    await ensureNotificationPermission()
  }
}

const navBtn: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  background: 'none',
  border: 0,
  fontSize: 24,
  color: 'var(--text)',
}
