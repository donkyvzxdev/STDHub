import { describe, expect, it } from 'vitest'
import { getLanguageId, iconKind, imageMime } from './editorLanguages'

describe('T08 language map', () => {
  it('maps code extensions to Monaco ids', () => {
    expect(getLanguageId('calc.ts')).toBe('typescript')
    expect(getLanguageId('app.tsx')).toBe('typescript')
    expect(getLanguageId('main.js')).toBe('javascript')
    expect(getLanguageId('notes.md')).toBe('markdown')
    expect(getLanguageId('data.json')).toBe('json')
    expect(getLanguageId('style.css')).toBe('css')
  })

  it('falls back to plaintext', () => {
    expect(getLanguageId('Makefile')).toBe('plaintext')
    expect(getLanguageId('weird.zqx')).toBe('plaintext')
  })

  it('buckets explorer icons', () => {    expect(iconKind('notes.md')).toBe('md')
    expect(iconKind('calc.ts')).toBe('ts')
    expect(iconKind('app.jsx')).toBe('ts')
    expect(iconKind('data.json')).toBe('json')
    expect(iconKind('run.sh')).toBe('terminal')
    expect(iconKind('logo.png')).toBe('image')
    expect(iconKind('main.py')).toBe('code')
    expect(iconKind('LICENSE')).toBe('file')
  })

  it('maps StudyMD to its own language and icon', () => {
    expect(getLanguageId('guia.stmd')).toBe('stmd')
    expect(getLanguageId('GUIA.STMD')).toBe('stmd')
    expect(iconKind('guia.stmd')).toBe('stmd')
  })

  it('detects previewable images', () => {
    expect(imageMime('logo.png')).toBe('image/png')
    expect(imageMime('photo.JPG')).toBe('image/jpeg')
    expect(imageMime('notes.md')).toBeNull()
    expect(imageMime('LICENSE')).toBeNull()
  })
})
