import { describe, expect, it } from 'vitest'
import { UndoStack } from './undo'
import { renderMarkdown } from './markdown'
import { renderToStaticMarkup } from 'react-dom/server'

describe('undo stack', () => {
  it('undoes and redoes', () => {
    const stack = new UndoStack('a')
    expect(stack.canUndo).toBe(false)
    stack.push('ab')
    stack.push('abc')
    expect(stack.undo()).toBe('ab')
    expect(stack.undo()).toBe('a')
    expect(stack.undo()).toBe('a')
    expect(stack.redo()).toBe('ab')
    stack.push('ax')
    expect(stack.canRedo).toBe(false)
    stack.reset('z')
    expect(stack.value).toBe('z')
    expect(stack.canUndo).toBe(false)
  })
})

describe('markdown subset', () => {
  it('renders headings, emphasis, lists and code', () => {
    const html = renderToStaticMarkup(
      <>{renderMarkdown('# Title\n**bold** and *italic* and `code`')}</>,
    )
    expect(html).toContain('Title')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code')
  })

  it('renders lists, checklist, quotes and links', () => {
    const html = renderToStaticMarkup(
      <>{renderMarkdown('- [x] done\n- item\n1. first\n> quote\n[a](https://a.test)')}</>,
    )
    expect(html).toContain('☑')
    expect(html).toContain('•')
    expect(html).toContain('quote')
    expect(html).toContain('href="https://a.test"')
  })

  it('never interprets raw HTML', () => {
    const html = renderToStaticMarkup(
      <>{renderMarkdown('<script>alert(1)</script>')}</>,
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders images through the resolver', () => {
    const html = renderToStaticMarkup(
      <>{renderMarkdown('![alt](pic.png)', (src) => `file://${src}`)}</>,
    )
    expect(html).toContain('src="file://pic.png"')
  })
})
