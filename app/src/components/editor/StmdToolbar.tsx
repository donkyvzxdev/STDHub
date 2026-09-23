import { useTranslation } from 'react-i18next'
import {
  Bold,
  Calculator,
  Highlighter,
  Heading1,
  Italic,
  Layers,
  Link,
  List,
  ListChecks,
  ListTodo,
  Paintbrush,
  PenTool,
  Quote,
  Sigma,
  SquareFunction,
  StickyNote,
  Table,
  Underline,
} from 'lucide-react'

interface StmdToolbarProps {
  onWrap: (before: string, after: string) => void
  onInsert: (text: string) => void
  onOpenDrawing: () => void
}

/**
 * StudyMD formatting bar: GUI clicks for every study module, mirroring the
 * `/`-style snippet commands (`flash`, `quiz`, `calc`…). Wiring (selection
 * handling) lives in the parent through the three callbacks.
 */
function StmdToolbar({ onWrap, onInsert, onOpenDrawing }: StmdToolbarProps) {
  const { t } = useTranslation()
  const btn =
    'rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  return (
    <div
      role="toolbar"
      aria-label="StudyMD"
      className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1"
    >
      <button type="button" title={t('study.toolBold')} aria-label={t('study.toolBold')} onClick={() => onWrap('**', '**')} className={btn}>
        <Bold className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolItalic')} aria-label={t('study.toolItalic')} onClick={() => onWrap('*', '*')} className={btn}>
        <Italic className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolHighlight')} aria-label={t('study.toolHighlight')} onClick={() => onWrap('==', '==')} className={btn}>
        <Highlighter className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolUnderline')} aria-label={t('study.toolUnderline')} onClick={() => onWrap('++', '++')} className={btn}>
        <Underline className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolMath')} aria-label={t('study.toolMath')} onClick={() => onWrap('$', '$')} className={btn}>
        <Sigma className="size-4" aria-hidden />
      </button>
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <button type="button" title={t('study.toolHeading')} aria-label={t('study.toolHeading')} onClick={() => onInsert('## ')} className={btn}>
        <Heading1 className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolQuote')} aria-label={t('study.toolQuote')} onClick={() => onInsert('> ')} className={btn}>
        <Quote className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolList')} aria-label={t('study.toolList')} onClick={() => onInsert('- ')} className={btn}>
        <List className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolTask')} aria-label={t('study.toolTask')} onClick={() => onInsert('- [ ] ')} className={btn}>
        <ListTodo className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolLink')} aria-label={t('study.toolLink')} onClick={() => onWrap('[', '](https://)')} className={btn}>
        <Link className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolTable')} aria-label={t('study.toolTable')} onClick={() => onInsert('| A | B |\n| --- | --- |\n| 1 | 2 |')} className={btn}>
        <Table className="size-4" aria-hidden />
      </button>
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <button type="button" title={t('study.toolFlash')} aria-label={t('study.toolFlash')} onClick={() => onInsert(':::flashcard\npergunta\n---\nresposta\n:::')} className={btn}>
        <Layers className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolQuiz')} aria-label={t('study.toolQuiz')} onClick={() => onInsert(':::quiz\npergunta\n- [ ] opção 1\n- [x] opção certa\n:::')} className={btn}>
        <ListChecks className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolCalc')} aria-label={t('study.toolCalc')} onClick={() => onInsert('```calc\n2*(3+4)\n```')} className={btn}>
        <Calculator className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolInlineCalc')} aria-label={t('study.toolInlineCalc')} onClick={() => onWrap('#stdcalc ', ' =')} className={btn}>
        <SquareFunction className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolInlineMarker')} aria-label={t('study.toolInlineMarker')} onClick={() => onWrap('#stdmarker ', ' /stdmarker')} className={btn}>
        <Paintbrush className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolCallout')} aria-label={t('study.toolCallout')} onClick={() => onInsert(':::nota\ntexto\n:::')} className={btn}>
        <StickyNote className="size-4" aria-hidden />
      </button>
      <button type="button" title={t('study.toolDrawing')} aria-label={t('study.toolDrawing')} onClick={onOpenDrawing} className={btn}>
        <PenTool className="size-4" aria-hidden />
      </button>
    </div>
  )
}

export default StmdToolbar
