import { beforeEach, describe, expect, it } from 'vitest'
import {
  addDaysKey,
  dayLabel,
  eventsOn,
  loadEvents,
  monthGrid,
  storeEvents,
  toKey,
  upcoming,
  validateEvent,
  type CalendarEvent,
} from './calendar'

const EVT = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: `e${Math.random()}`,
  title: 'T',
  date: '2026-09-20',
  time: '08:00',
  notes: '',
  remindMinutes: -1,
  ...over,
})

beforeEach(() => {
  window.localStorage.clear()
})

describe('mobile calendar', () => {
  it('builds keys and labels', () => {
    expect(toKey(2026, 9, 5)).toBe('2026-09-05')
    expect(addDaysKey('2026-09-20', 1)).toBe('2026-09-21')
    const now = new Date(2026, 8, 20)
    expect(dayLabel('2026-09-20', now, 'en')).toBe('Today')
    expect(dayLabel('2026-09-21', now, 'pt')).toBe('Amanhã')
  })

  it('persists and sorts', () => {
    storeEvents([EVT({ date: '2026-09-22' }), EVT({ date: '2026-09-20', time: '' })])
    const loaded = loadEvents()
    expect(loaded).toHaveLength(2)
    expect(upcoming(loaded, new Date(2026, 8, 19))).toHaveLength(2)
    expect(upcoming(loaded, new Date(2026, 8, 21))).toHaveLength(1)
    expect(eventsOn(loaded, '2026-09-20')).toHaveLength(1)
    window.localStorage.setItem('stdhub.mobile.calendar', '[[bad')
    expect(loadEvents()).toEqual([])
  })

  it('builds a 42-cell month grid', () => {
    const grid = monthGrid(2026, 9, false)
    expect(grid).toHaveLength(42)
    expect(grid.filter(Boolean)).toHaveLength(30)
    expect(grid[0]).toBeNull()
    // 2026-09-01 is a Tuesday: Sunday-first grid starts Mon 31st pad.
    expect(grid[2]).toBe('2026-09-01')
    const monday = monthGrid(2026, 9, true)
    expect(monday[1]).toBe('2026-09-01')
  })

  it('validates the form', () => {
    expect(validateEvent({ title: '  ', date: '2026-09-20', time: '' })).toBe('empty')
    expect(validateEvent({ title: 'T', date: '20/09', time: '' })).toBe('generic')
    expect(validateEvent({ title: 'T', date: '2026-09-20', time: '25:00' })).toBe('generic')
    expect(validateEvent({ title: 'T', date: '2026-09-20', time: '08:00' })).toBeNull()
  })
})
