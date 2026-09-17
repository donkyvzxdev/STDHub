import type { ReactNode } from 'react'

/**
 * Minimal Markdown renderer for exactly the toolbar's syntax subset
 * (headings, bold, italic, code, links, images, lists, checklists,
 * blockquotes, paragraphs). Raw HTML is never interpreted — anything
 * looking like a tag renders as plain text — so preview is safe by
 * construction with zero dependencies.
 */
export function renderMarkdown(source: string, resolveSrc?: (src: string) => string): ReactNode[] {
  return source.split('\n').map((line, i) => (
    <MdBlock key={i} line={line} resolveSrc={resolveSrc} />
  ))
}

function MdBlock({ line, resolveSrc }: { line: string; resolveSrc?: (src: string) => string }) {
  if (/^\s*$/.test(line)) return <div style={{ height: 8 }} />
  const heading = line.match(/^(#{1,4})\s+(.*)$/)
  if (heading) {
    const level = heading[1].length
    const sizes = ['22px', '19px', '17px', '15px']
    return (
      <div style={{ fontSize: sizes[level - 1], fontWeight: 700, margin: '10px 0 4px' }}>
        {inline(heading[2], resolveSrc)}
      </div>
    )
  }
  const quote = line.match(/^>\s?(.*)$/)
  if (quote) {
    return (
      <div
        style={{
          borderLeft: '3px solid var(--accent)',
          paddingLeft: 10,
          color: 'var(--muted)',
          margin: '6px 0',
        }}
      >
        {inline(quote[1], resolveSrc)}
      </div>
    )
  }
  const check = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/)
  if (check) {
    return (
      <div style={{ display: 'flex', gap: 8, margin: '3px 0', fontSize: 15 }}>
        <span aria-hidden>{check[1].toLowerCase() === 'x' ? '☑' : '☐'}</span>
        <span>{inline(check[2], resolveSrc)}</span>
      </div>
    )
  }
  const bullet = line.match(/^[-*]\s+(.*)$/)
  if (bullet) {
    return (
      <div style={{ display: 'flex', gap: 8, margin: '3px 0', fontSize: 15 }}>
        <span aria-hidden>•</span>
        <span>{inline(bullet[1], resolveSrc)}</span>
      </div>
    )
  }
  const ordered = line.match(/^\d+\.\s+(.*)$/)
  if (ordered) {
    const n = line.match(/^(\d+)\./)?.[1] ?? '1'
    return (
      <div style={{ display: 'flex', gap: 8, margin: '3px 0', fontSize: 15 }}>
        <span aria-hidden>{n}.</span>
        <span>{inline(ordered[1], resolveSrc)}</span>
      </div>
    )
  }
  return (
    <div style={{ margin: '3px 0', fontSize: 15, lineHeight: 1.6 }}>
      {inline(line, resolveSrc)}
    </div>
  )
}

function inline(text: string, resolveSrc?: (src: string) => string): ReactNode {
  // Split by code spans first so nothing formats inside them.
  const parts = text.split(/(`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          style={{
            background: 'var(--bg-soft)',
            borderRadius: 6,
            padding: '1px 6px',
            fontSize: 13,
          }}
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <RichText key={i} text={part} resolveSrc={resolveSrc} />
  })
}

function RichText({ text, resolveSrc }: { text: string; resolveSrc?: (src: string) => string }) {
  const out: ReactNode[] = []
  // Images, links, bold, italic — in that precedence order.
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let match: RegExpExecArray | null
  let k = 0
  const pushText = (chunk: string): void => {
    if (chunk !== '') out.push(<span key={`t${k++}`}>{chunk}</span>)
  }
  while ((match = pattern.exec(text)) !== null) {
    pushText(text.slice(last, match.index))
    last = match.index + match[0].length
    if (match[1] !== undefined) {
      const src = resolveSrc ? resolveSrc(match[2]) : match[2]
      out.push(
        <img
          key={`i${k++}`}
          src={src}
          alt={match[1]}
          style={{ maxWidth: '100%', borderRadius: 10, margin: '6px 0' }}
        />,
      )
    } else if (match[3] !== undefined) {
      out.push(
        <a key={`a${k++}`} href={match[4]} style={{ color: 'var(--accent)' }}>
          {match[3]}
        </a>,
      )
    } else if (match[5] !== undefined) {
      out.push(
        <strong key={`b${k++}`}>{match[5]}</strong>,
      )
    } else if (match[6] !== undefined) {
      out.push(
        <em key={`e${k++}`}>{match[6]}</em>,
      )
    }
  }
  pushText(text.slice(last))
  return <>{out}</>
}
