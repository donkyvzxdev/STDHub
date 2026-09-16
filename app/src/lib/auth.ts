/** Provider-agnostic auth shapes (no vendor SDK). The future database —
 * own SQL or Supabase, still to be chosen — plugs in behind `AuthLike`. */
export interface AuthUser {
  id: string
  email?: string | null
}

export interface AuthSession {
  user: AuthUser
}

export type AuthChangeEvent = string

export interface Account {
  userId: string
  email: string | null
}

export type AuthErrorKey =
  | 'auth.invalidEmail'
  | 'auth.shortPassword'
  | 'auth.notConfigured'
  | 'auth.failed'

/** Minimal structural surface we use — the future client and test fakes both fit. */
export interface AuthLike {
  signInWithPassword(args: {
    email: string
    password: string
  }): Promise<{
    data: { user: AuthUser | null; session: AuthSession | null }
    error: { message: string } | null
  }>
  signUp(args: {
    email: string
    password: string
  }): Promise<{
    data: { user: AuthUser | null; session: AuthSession | null }
    error: { message: string } | null
  }>
  signOut(): Promise<{ error: { message: string } | null }>
  getSession(): Promise<{ data: { session: AuthSession | null } }>
  onAuthStateChange(
    cb: (event: AuthChangeEvent, session: AuthSession | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } }
}

/**
 * Cloud auth client seam. No database chosen yet (own SQL vs Supabase is
 * still open), so this returns null and the app runs local-first. The
 * winning provider plugs in here behind `AuthLike` — nothing else changes.
 */
export function getCloudAuthClient(): AuthLike | null {
  return null
}

export type AuthResult =
  | { ok: true; account: Account; needsConfirmation: boolean }
  | { ok: false; key: AuthErrorKey; raw?: string }

/** Returns an i18n key when invalid, null when the pair looks fine. */
export function validateCredentials(
  email: string,
  password: string,
): AuthErrorKey | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'auth.invalidEmail'
  }
  if (password.length < 6) return 'auth.shortPassword'
  return null
}

function toAccount(user: AuthUser): Account {
  return { userId: user.id, email: user.email ?? null }
}

export async function signIn(
  client: AuthLike | null,
  email: string,
  password: string,
): Promise<AuthResult> {
  const invalid = validateCredentials(email, password)
  if (invalid) return { ok: false, key: invalid }
  if (!client) return { ok: false, key: 'auth.notConfigured' }
  const { data, error } = await client.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error || !data.user) {
    return { ok: false, key: 'auth.failed', raw: error?.message }
  }
  return {
    ok: true,
    account: toAccount(data.user),
    needsConfirmation: data.session === null,
  }
}

export async function signUp(
  client: AuthLike | null,
  email: string,
  password: string,
): Promise<AuthResult> {
  const invalid = validateCredentials(email, password)
  if (invalid) return { ok: false, key: invalid }
  if (!client) return { ok: false, key: 'auth.notConfigured' }
  const { data, error } = await client.signUp({
    email: email.trim(),
    password,
  })
  if (error || !data.user) {
    return { ok: false, key: 'auth.failed', raw: error?.message }
  }
  return {
    ok: true,
    account: toAccount(data.user),
    needsConfirmation: data.session === null,
  }
}

export async function signOut(client: AuthLike | null): Promise<void> {
  try {
    await client?.signOut()
  } catch {
    // Already out — nothing to do.
  }
}

export async function getInitialAccount(
  client: AuthLike | null,
): Promise<Account | null> {
  if (!client) return null
  try {
    const { data } = await client.getSession()
    return data.session ? toAccount(data.session.user) : null
  } catch {
    return null
  }
}

export function subscribeAccount(
  client: AuthLike | null,
  cb: (account: Account | null) => void,
): () => void {
  if (!client) return () => undefined
  const { data } = client.onAuthStateChange((_event, session) => {
    cb(session ? toAccount(session.user) : null)
  })
  return () => data.subscription.unsubscribe()
}
