import { describe, expect, it } from 'vitest'
import { errorKey } from './errors'

describe('friendly errors', () => {
  it('never leaks technical codes', () => {
    expect(errorKey('ai-unreachable')).toBe('errors.offline')
    expect(errorKey('search-unreachable')).toBe('errors.offline')
    expect(errorKey('ai-not-configured')).toBe('errors.aiFailed')
    expect(errorKey('ai-http-401')).toBe('errors.aiFailed')
    expect(errorKey('search-needs-key')).toBe('errors.aiFailed')
    expect(errorKey('search-http-500')).toBe('errors.generic')
    expect(errorKey('exists')).toBe('errors.exists')
    expect(errorKey('invalid-name')).toBe('errors.invalidName')
    expect(errorKey('not-found')).toBe('errors.notFound')
    expect(errorKey('empty')).toBe('errors.empty')
    expect(errorKey('whatever')).toBe('errors.generic')
  })
})
