import { describe, expect, it } from 'vitest'
import {
  getInitialAccount,
  signIn,
  signUp,
  subscribeAccount,
  validateCredentials,
  type AuthChangeEvent,
  type AuthLike,
  type AuthSession,
  type AuthUser,
} from './auth'

function makeUser(): AuthUser {
  return { id: 'user-1', email: 'a@b.co' }
}

function makeSession(): AuthSession {
  return { user: makeUser() }
}

function fakeClient(
  overrides: Partial<AuthLike> = {},
): AuthLike & {
  emit: (session: AuthSession | null) => void
  calls: string[]
} {
  const calls: string[] = []
  let listener: ((event: AuthChangeEvent, session: AuthSession | null) => void) | null =
    null
  const client: AuthLike = {
    signInWithPassword: async () => ({
      data: { user: makeUser(), session: makeSession() },
      error: null,
    }),
    signUp: async () => ({
      data: { user: makeUser(), session: makeSession() },
      error: null,
    }),
    signOut: async () => {
      calls.push('signOut')
      return { error: null }
    },
    getSession: async () => ({
      data: { session: makeSession() },
    }),
    onAuthStateChange: (cb) => {
      listener = cb
      return { data: { subscription: { unsubscribe: () => undefined } } }
    },
    ...overrides,
  }
  return {
    ...client,
    calls,
    emit: (session) => listener?.('SIGNED_IN', session),
  }
}

describe('auth lib (provider-agnostic)', () => {
  it('validates email and password locally', () => {
    expect(validateCredentials('not-an-email', '123456')).toBe(
      'auth.invalidEmail',
    )
    expect(validateCredentials('a@b.co', '123')).toBe('auth.shortPassword')
    expect(validateCredentials('a@b.co', '123456')).toBeNull()
  })

  it('refuses without a configured client', async () => {
    expect(await signIn(null, 'a@b.co', '123456')).toEqual({
      ok: false,
      key: 'auth.notConfigured',
    })
    expect(await signUp(null, 'a@b.co', '123456')).toEqual({
      ok: false,
      key: 'auth.notConfigured',
    })
    expect(await getInitialAccount(null)).toBeNull()
  })

  it('signs in and maps the account', async () => {
    const result = await signIn(fakeClient(), 'a@b.co', '123456')
    expect(result).toEqual({
      ok: true,
      account: { userId: 'user-1', email: 'a@b.co' },
      needsConfirmation: false,
    })
  })

  it('flags accounts waiting for email confirmation', async () => {
    const client = fakeClient({
      signUp: async () => ({
        data: { user: makeUser(), session: null },
        error: null,
      }),
    })
    const result = await signUp(client, 'a@b.co', '123456')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.needsConfirmation).toBe(true)
  })

  it('surfaces provider errors with the raw message', async () => {
    const client = fakeClient({
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      }),
    })
    const result = await signIn(client, 'a@b.co', '123456')
    expect(result).toEqual({
      ok: false,
      key: 'auth.failed',
      raw: 'Invalid login credentials',
    })
  })

  it('restores the session and follows auth events', async () => {
    const client = fakeClient()
    expect(await getInitialAccount(client)).toEqual({
      userId: 'user-1',
      email: 'a@b.co',
    })
    const seen: unknown[] = []
    const stop = subscribeAccount(client, (acc) => seen.push(acc))
    client.emit(null)
    expect(seen).toEqual([null])
    stop()
    expect(subscribeAccount(null, () => undefined)).toBeTypeOf('function')
  })
})
