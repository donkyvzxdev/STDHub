import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Check,
  Info,
  Lightbulb,
  RotateCcw,
} from 'lucide-react'
import { evaluate, formatResult } from '@/lib/calculator'
import {
  parseStmd,
  tokenizeInline,
  type InlineToken,
  type StmdBlock,
  type StmdQuizOption,
} from '@/lib/stmd'

interface StudyNotebookProps {
  source: string
  /** File task toggles write back to the source; quiz options never do. */
  onToggleTask?: (line: number) => void
}

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, i) => {
        switch (token.kind) {
          case 'text':
            return <span key={i}>{token.text}</span>
          case 'code':
            return (
              <code
                key={i}
                className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
              >
                {token.text}
              </code>
            )
          case 'strong':
            return <strong key={i}>{token.text}</strong>
          case 'em':
            return <em key={i}>{token.text}</em>
          case 'strike':
            return <s key={i}>{token.text}</s>
          case 'mark':
            return <mark key={i}>{token.text}</mark>
          case 'underline':
            return <u key={i}>{token.text}</u>
          case 'math':
            return (
              <span
                key={i}
                className="rounded border border-muted-foreground/30 bg-muted px-1 font-serif italic"
              >
                {token.text}
              </span>
            )
          case 'stdcalc':
            return (
              <span
                key={i}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
              >
                {token.expr} ={' '}
                {token.result ?? (
                  <span className="text-muted-foreground">?</span>
                )}
              </span>
            )
          case 'stdmarker':
            return <mark key={i}>{token.text}</mark>
          case 'link':
            return /^https?:|^mailto:/.test(token.href) ? (
              <a
                key={i}
                href={token.href}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                {token.text}
              </a>
            ) : (
              <span key={i}>{token.text}</span>
            )
          case 'image':
            return (
              <img
                key={i}
                src={token.src}
                alt={token.alt}
                className="max-w-full rounded-md border"
              />
            )
        }
      })}
    </>
  )
}

/** Multi-line text with study marks (paragraphs, quotes, callouts...). */
function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          <Inline tokens={tokenizeInline(line)} />
        </span>
      ))}
    </>
  )
}

function Flashcard({ front, back }: { front: string; back: string }) {
  const { t } = useTranslation()
  const [flipped, setFlipped] = useState(false)
  if (back === '') {
    return (
      <div className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-4">
        <RichText text={front} />
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setFlipped((v) => !v)}
      aria-label={t('study.flip')}
      className="block w-full rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-left transition hover:bg-amber-300/20"
    >
      <RichText text={flipped ? back : front} />
      <span className="mt-2 block text-[11px] text-muted-foreground">
        {t('study.flip')}
      </span>
    </button>
  )
}

function Quiz({
  question,
  options,
}: {
  question: string
  options: StmdQuizOption[]
}) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [verified, setVerified] = useState(false)
  if (options.length === 0) return null
  const okCount = options.filter(
    (o, i) => o.correct === picked.has(i),
  ).length

  function toggle(i: number): void {
    if (verified) return
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 font-medium">
        <RichText text={question} />
      </p>
      <div className="flex flex-col gap-2">
        {options.map((option, i) => {
          const isPicked = picked.has(i)
          const tone = verified
            ? isPicked && option.correct
              ? 'border-emerald-400/60 bg-emerald-400/10'
              : isPicked
                ? 'border-red-400/60 bg-red-400/10'
                : option.correct
                  ? 'border-amber-300/60'
                  : 'border-transparent'
            : isPicked
              ? 'border-primary/60 bg-primary/5'
              : 'border-transparent hover:bg-accent/50'
          return (
            <label
              key={i}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${tone}`}
            >
              <input
                type="checkbox"
                checked={isPicked}
                disabled={verified}
                onChange={() => toggle(i)}
                className="mt-0.5"
              />
              <span className="flex-1">
                <RichText text={option.text} />
              </span>
              {verified ? (
                <span
                  className={`text-xs font-medium ${isPicked === option.correct ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {isPicked === option.correct
                    ? t('study.correct')
                    : t('study.wrong')}
                </span>
              ) : null}
            </label>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {verified ? (
          <>
            <span className="text-sm text-muted-foreground">
              {t('study.score', { ok: okCount, total: options.length })}
            </span>
            <button
              type="button"
              onClick={() => {
                setPicked(new Set())
                setVerified(false)
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t('study.retry')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setVerified(true)}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Check className="size-3.5" aria-hidden />
            {t('study.check')}
          </button>
        )}
      </div>
    </div>
  )
}

function CalcBlock({ expressions }: { expressions: string[] }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-lg border font-mono text-sm">
      {expressions.map((expr, i) => {
        let result: string
        try {
          result = formatResult(evaluate(expr))
        } catch {
          result = `— ${t('study.calcError')}`
        }
        return (
          <div
            key={i}
            className="flex items-baseline justify-between gap-4 border-b px-3 py-1.5 last:border-b-0 odd:bg-muted/40"
          >
            <span className="min-w-0 flex-1 truncate">{expr}</span>
            <span className="font-semibold">{result}</span>
          </div>
        )
      })}
    </div>
  )
}

function Callout({ tone, text }: { tone: string; text: string }) {
  const name = tone.toLowerCase()
  const style =
    name === 'aviso'
      ? 'border-red-400/50 bg-red-400/10'
      : name === 'dica'
        ? 'border-sky-400/50 bg-sky-400/10'
        : 'border-muted-foreground/30 bg-muted/40'
  const Icon = name === 'aviso' ? AlertTriangle : name === 'dica' ? Lightbulb : Info
  return (
    <div className={`flex gap-2 rounded-lg border p-3 text-sm ${style}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <RichText text={text} />
      </div>
    </div>
  )
}

export function StudyBlock({
  block,
  onToggleTask,
}: {
  block: StmdBlock
  onToggleTask?: (line: number) => void
}) {
  switch (block.kind) {
    case 'heading': {
      const sizes: Record<number, string> = {
        1: 'text-xl font-bold',
        2: 'text-lg font-bold',
        3: 'text-base font-semibold',
      }
      return (
        <div className={sizes[block.level] ?? 'text-sm font-semibold'}>
          {block.text === '' ? (
            <span className="text-muted-foreground/60">
              {'#'.repeat(block.level)}
            </span>
          ) : (
            <Inline tokens={tokenizeInline(block.text)} />
          )}
        </div>
      )
    }
    case 'paragraph':
      return (
        <p className="text-sm leading-6">
          <RichText text={block.text} />
        </p>
      )
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-5">
          {block.code}
        </pre>
      )
    case 'calc':
      return <CalcBlock expressions={block.expressions} />
    case 'list':
      return block.ordered ? (
        <ol className="list-decimal space-y-1 pl-6 text-sm">
          {block.items.map((item) => (
            <li key={item.line}>
              <Inline tokens={tokenizeInline(item.text)} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-1 text-sm">
          {block.items.map((item) =>
            item.task ? (
              <li key={item.line}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => onToggleTask?.(item.line)}
                    className="mt-1"
                  />
                  <span
                    className={item.checked ? 'text-muted-foreground line-through' : undefined}
                  >
                    <Inline tokens={tokenizeInline(item.text)} />
                  </span>
                </label>
              </li>
            ) : (
              <li key={item.line} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                <span>
                  <Inline tokens={tokenizeInline(item.text)} />
                </span>
              </li>
            ),
          )}
        </ul>
      )
    case 'quote':
      return (
        <blockquote className="border-l-2 border-muted-foreground/40 pl-3 text-sm text-muted-foreground">
          {block.text === '' ? (
            <span className="text-muted-foreground/60">{'>'}</span>
          ) : (
            <RichText text={block.text} />
          )}
        </blockquote>
      )
    case 'hr':
      return <hr className="border-border" />
    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60">
                {block.head.map((cell, i) => (
                  <th key={i} className="px-3 py-1.5 text-left font-semibold">
                    <Inline tokens={tokenizeInline(cell)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-t odd:bg-muted/20">
                  {row.map((cell, i) => (
                    <td key={i} className="px-3 py-1.5">
                      <Inline tokens={tokenizeInline(cell)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'flashcard':
      return <Flashcard front={block.front} back={block.back} />
    case 'quiz':
      return <Quiz question={block.question} options={block.options} />
    case 'callout':
      return <Callout tone={block.tone} text={block.text} />
  }
}

function StudyNotebook({ source, onToggleTask }: StudyNotebookProps) {  const blocks = useMemo(() => parseStmd(source), [source])
  return (
    <article
      data-testid="study-notebook"
      className="mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-y-auto px-6 py-5"
    >
      {blocks.map((block, i) => (
        <StudyBlock key={`${block.line}-${i}`} block={block} onToggleTask={onToggleTask} />
      ))}
    </article>
  )
}

export default StudyNotebook
