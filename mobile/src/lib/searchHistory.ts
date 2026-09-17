const STORAGE_KEY = 'stdhub.mobile.search-history'
const MAX = 20

export function loadSearchHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX)
  } catch {
    return []
  }
}

export function pushSearchHistory(query: string): string[] {
  const q = query.trim()
  const current = loadSearchHistory().filter((h) => h !== q)
  const next = (q === '' ? current : [q, ...current]).slice(0, MAX)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

export function clearSearchHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
