import { describe, expect, it } from 'vitest'
import en from './en.json'
import pt from './pt.json'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => keys(item, `${prefix}[${i}]`))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, child]) => keys(child, prefix === '' ? key : `${prefix}.${key}`),
    )
  }
  return [prefix]
}

describe('mobile locales', () => {
  it('en and pt expose the same keys', () => {
    const enKeys = new Set(keys(en))
    const ptKeys = new Set(keys(pt))
    const missingInPt = [...enKeys].filter((k) => !ptKeys.has(k))
    const missingInEn = [...ptKeys].filter((k) => !enKeys.has(k))
    expect({ missingInPt, missingInEn }).toEqual({
      missingInPt: [],
      missingInEn: [],
    })
  })

  it('has no empty translations', () => {
    const check = (value: unknown, where: string): void => {
      if (typeof value === 'string') {
        expect(value.trim(), where).not.toBe('')
        return
      }
      if (Array.isArray(value)) {
        value.forEach((item, i) => check(item, `${where}[${i}]`))
        return
      }
      if (typeof value === 'object' && value !== null) {
        for (const [key, child] of Object.entries(value)) {
          check(child, `${where}.${key}`)
        }
      }
    }
    check(en, 'en')
    check(pt, 'pt')
  })
})
