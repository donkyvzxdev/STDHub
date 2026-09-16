import { describe, expect, it } from 'vitest'
import { normalizePath } from './tauriFs'

describe('T07i paths', () => {
  it('normalizes Windows backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Users\\x\\file.ts')).toBe('C:/Users/x/file.ts')
    expect(normalizePath('C:/Users/x/file.ts')).toBe('C:/Users/x/file.ts')
    expect(normalizePath('relative\\dir/file')).toBe('relative/dir/file')
  })
})
