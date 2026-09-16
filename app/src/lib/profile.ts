export interface Profile {
  mode: 'guest'
  createdAt: string
}

const KEY = 'stdhub.profile'

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record['mode'] === 'guest' && typeof record['createdAt'] === 'string'
}

export function loadProfile(): Profile | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isProfile(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveGuestProfile(): Profile {
  const profile: Profile = { mode: 'guest', createdAt: new Date().toISOString() }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {
    // Storage unavailable — session still works until reload.
  }
  return profile
}

export function clearProfile(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing stored — nothing to clear.
  }
}
