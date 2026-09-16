import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Bot,
  Calculator,
  Cloud,
  FileCode2,
  Globe,
  HardDrive,
  Languages,
  Palette,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { SiMarkdown, SiTypescript } from 'react-icons/si'
import { VscFolder } from 'react-icons/vsc'
import HoneycombField from './components/landing/HoneycombField'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#compare', label: 'Compare' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

type DemoView = 'editor' | 'calc' | 'web' | 'chat' | 'settings'
type DemoFile = 'quantum' | 'calc' | 'ideas'

const DEMO_VIEWS: { id: DemoView; icon: LucideIcon; label: string }[] = [
  { id: 'editor', icon: FileCode2, label: 'Editor' },
  { id: 'calc', icon: Calculator, label: 'Calculator' },
  { id: 'web', icon: Globe, label: 'Research' },
  { id: 'chat', icon: Bot, label: 'Tutor' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

const DEMO_COMING: Record<
  Exclude<DemoView, 'editor'>,
  { title: string; text: string }
> = {
  calc: {
    title: 'Calculator',
    text: 'Clean calculator with a scientific toggle and one-click copy.',
  },
  web: {
    title: 'Web research',
    text: 'Search the web and get AI summaries without leaving the app.',
  },
  chat: {
    title: 'AI tutor',
    text: 'A study assistant with local agent actions.',
  },
  settings: {
    title: 'Settings',
    text: 'Themes, language, search and AI providers.',
  },
}

const DEMO_FILES: { id: DemoFile; name: string; kind: 'md' | 'ts' | 'folder' }[] = [
  { id: 'quantum', name: 'quantum.md', kind: 'md' },
  { id: 'calc', name: 'calc.ts', kind: 'ts' },
  { id: 'ideas', name: 'ideas/', kind: 'folder' },
]

const QUANTUM_MD = `# Quantum Notes

A study project in progress.

## Superposition

- A qubit holds 0 and 1 at once until measured.
- Measurement collapses it to a single outcome.

## Entanglement

1. Prepare two qubits together.
2. Separate them — results stay linked.

> Focus question: why does observation change the outcome?

## Next up

- **Double-slit** recap
- Practice set 3
`

const CALC_TS = `// calc.ts — tiny terminal calculator.
// Run: node calc.ts "12 / (2 + 4)"

const input = process.argv[2] ?? "";

if (!/^[0-9+\\-*/().\\s]+$/.test(input) || input.trim() === "") {
  console.error('Usage: node calc.ts "<expression>"');
  process.exit(1);
}

const result = Function('"use strict"; return (' + input + ');')();
console.log(result);
`

const TRUST = [
  { icon: HardDrive, title: '100% offline-ready', text: 'Runs fully local.' },
  { icon: ShieldCheck, title: 'Private by default', text: 'Yours until you share.' },
  { icon: Languages, title: 'English + Português', text: 'More languages later.' },
]

const FEATURES = [
  {
    icon: FileCode2,
    title: 'Editor that feels like VSCode',
    text: 'Explorer, tabs, per-language highlighting and completion. Local folders, GitHub or Drive as source.',
    soon: false,
  },
  {
    icon: Calculator,
    title: 'Calculator',
    text: 'Clean modern calculator with a scientific toggle and one-click copy.',
    soon: true,
  },
  {
    icon: Globe,
    title: 'Web research',
    text: 'Search the web and get AI summaries, Google-style, without leaving the app.',
    soon: true,
  },
  {
    icon: Bot,
    title: 'AI tutor',
    text: 'A study assistant with local agent actions: read files, summarize research, quiz you.',
    soon: true,
  },
  {
    icon: Cloud,
    title: 'Cloud of your choice',
    text: 'Stay on your machine, push to GitHub or Drive as a guest, sync to STDHub cloud logged in.',
    soon: false,
  },
  {
    icon: Palette,
    title: 'Your theme',
    text: 'Dark by default. Pick a preset or create your own — every component follows.',
    soon: false,
  },
]

const COMPARE_ROWS: { feature: string; stdhub: string; notes: string; editors: string }[] = [
  { feature: 'VSCode-style editor', stdhub: 'Yes', notes: 'No', editors: 'Yes' },
  { feature: 'Fully offline', stdhub: 'Yes', notes: 'Mostly', editors: 'Yes' },
  { feature: 'Private by default', stdhub: 'Yes', notes: 'Varies', editors: 'Yes' },
  { feature: 'Study AI tutor', stdhub: 'Soon', notes: 'No', editors: 'No' },
  { feature: 'Built-in calculator', stdhub: 'Soon', notes: 'No', editors: 'No' },
  { feature: 'User-created themes', stdhub: 'Yes', notes: 'No', editors: 'Partial' },
]

const FAQS = [
  {
    q: 'What is STDHub exactly?',
    a: 'A local-first study workspace: a VSCode-style editor, calculator, web research and an AI tutor in one calm desktop app.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Everything lives on your machine by default. Cloud (GitHub, Drive or STDHub sync) only happens when you choose it.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. You can continue as a guest with full local features, and create an account later without losing files.',
  },
  {
    q: 'Which languages does it speak?',
    a: 'English by default, with Português included. The app detects your region and asks your language on first run.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes — 100% of Phase 1 works with no connection. AI summaries and cloud sync need internet when you use them.',
  },
  {
    q: 'When do calculator, research and tutor arrive?',
    a: 'They are Phase 2. The app already ships their icons with a coming-soon screen, and they unlock via update.',
  },
]

function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
        <a href="#top" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileCode2 className="size-4" aria-hidden />
          </span>
          STDHub
        </a>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href="#get-started" className={buttonVariants({ variant: 'ghost' })}>
            Get the app
          </a>
          <a href="#get-started" className={buttonVariants({ variant: 'default' })}>
            Get started
          </a>
        </div>
      </div>
    </header>
  )
}

const TS_TOKEN =
  /(\/\/[^\n]*|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\b\d+(?:\.\d+)?\b|\b(?:const|let|var|function|return|if|else|for|of|import|from|export|new|process|console|argv)\b)/
const TS_KEYWORD =
  /^(const|let|var|function|return|if|else|for|of|import|from|export|new|process|console|argv)$/

function TsCode({ code }: { code: string }) {
  const parts = code.split(TS_TOKEN).filter((p) => p !== '')
  return (
    <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">
      {parts.map((p, i) => {
        let cls = 'text-zinc-200'
        if (p.startsWith('//')) cls = 'text-zinc-500'
        else if (p.startsWith("'") || p.startsWith('"')) cls = 'text-emerald-300'
        else if (/^\d/.test(p)) cls = 'text-amber-300'
        else if (TS_KEYWORD.test(p)) cls = 'text-sky-300'
        return (
          <span key={i} className={cls}>
            {p}
          </span>
        )
      })}
    </pre>
  )
}

function inlineMd(text: string, row: number) {
  return text.split('**').map((p, j) =>
    j % 2 === 1 ? (
      <strong key={`${row}-${j}`} className="font-semibold text-zinc-100">
        {p}
      </strong>
    ) : (
      <span key={`${row}-${j}`}>{p}</span>
    ),
  )
}

function MdDoc({ doc }: { doc: string }) {
  return (
    <div className="flex flex-col gap-2 p-4 text-left text-sm leading-6">
      {doc.split('\n').map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <h4 key={i} className="text-lg font-semibold text-zinc-100">
              {line.slice(2)}
            </h4>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h5 key={i} className="font-semibold text-zinc-100">
              {line.slice(3)}
            </h5>
          )
        }
        if (line.startsWith('- ')) {
          return (
            <p key={i} className="text-zinc-300">
              • {inlineMd(line.slice(2), i)}
            </p>
          )
        }
        if (/^\d+\. /.test(line)) {
          return (
            <p key={i} className="text-zinc-300">
              {inlineMd(line, i)}
            </p>
          )
        }
        if (line.startsWith('> ')) {
          return (
            <p
              key={i}
              className="border-l-2 border-primary pl-3 text-zinc-400"
            >
              {line.slice(2)}
            </p>
          )
        }
        if (line.trim() === '') return <span key={i} className="h-1" />
        return (
          <p key={i} className="text-zinc-300">
            {inlineMd(line, i)}
          </p>
        )
      })}
    </div>
  )
}

function TerminalDemo() {
  return (
    <div className="border-t font-mono text-[12px]">
      <p className="px-4 pt-2 tracking-wider text-zinc-500">TERMINAL</p>
      <div className="flex flex-col gap-1 p-4 pt-1">
        <p>
          <span className="text-emerald-400">$ </span>
          <span className="text-zinc-200">node calc.ts "12 / (2 + 4)"</span>
        </p>
        <p className="text-zinc-100">2</p>
      </div>
    </div>
  )
}

function ComingSoon({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon
  title: string
  text: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      <Badge variant="secondary">Coming soon</Badge>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function FileIcon({ kind }: { kind: 'md' | 'ts' | 'folder' }) {
  if (kind === 'folder')
    return <VscFolder className="size-4 shrink-0 text-sky-300" aria-hidden />
  if (kind === 'ts')
    return (
      <SiTypescript className="size-3 shrink-0 text-[#3178c6]" aria-hidden />
    )
  return <SiMarkdown className="size-3 shrink-0 text-zinc-200" aria-hidden />
}

function EditorDemo() {
  const [file, setFile] = useState<DemoFile>('quantum')
  return (
    <div className="flex min-h-0 flex-1">
      <div className="hidden w-44 flex-col gap-0.5 border-r p-2 text-xs sm:flex">
        <p className="px-2 py-1 font-semibold text-muted-foreground">EXPLORER</p>
        {DEMO_FILES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFile(f.id)}
            className={
              file === f.id
                ? 'flex items-center gap-1.5 rounded bg-accent px-2 py-1 text-left text-accent-foreground'
                : 'flex items-center gap-1.5 rounded px-2 py-1 text-left text-muted-foreground hover:text-foreground'
            }
          >
            <FileIcon kind={f.kind} />
            {f.name}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 border-b px-2 pt-2">
          {DEMO_FILES.filter((f) => f.id !== 'ideas').map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFile(f.id)}
              className={
                file === f.id
                  ? 'flex items-center gap-1.5 rounded-t-md bg-muted px-3 py-1.5 text-xs font-medium'
                  : 'flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground'
              }
            >
              <FileIcon kind={f.kind} />
              {f.name}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {file === 'ideas' ? (
            <p className="p-4 text-sm text-muted-foreground">
              This folder is empty.
            </p>
          ) : file === 'quantum' ? (
            <MdDoc doc={QUANTUM_MD} />
          ) : (
            <>
              <TsCode code={CALC_TS} />
              <TerminalDemo />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AppMock() {
  const [view, setView] = useState<DemoView>('editor')
  return (
    <div className="flex h-[440px] flex-col overflow-hidden rounded-xl border bg-card text-left shadow-2xl">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="size-3 rounded-full bg-muted-foreground/30 transition-colors hover:bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-muted-foreground/30 transition-colors hover:bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-muted-foreground/30 transition-colors hover:bg-[#28c840]" />
        <span className="ml-3 text-xs text-muted-foreground">
          STDHub — interactive demo
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex flex-col items-center gap-1 border-r px-2 py-3">
          {DEMO_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              title={v.label}
              aria-label={v.label}
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={
                view === v.id
                  ? 'rounded-md bg-accent p-2 text-accent-foreground'
                  : 'rounded-md p-2 text-muted-foreground hover:text-foreground'
              }
            >
              <v.icon className="size-5" aria-hidden />
            </button>
          ))}
        </div>
        {view === 'editor' ? (
          <EditorDemo />
        ) : (
          <ComingSoon
            icon={DEMO_VIEWS.find((v) => v.id === view)?.icon ?? Settings}
            title={DEMO_COMING[view].title}
            text={DEMO_COMING[view].text}
          />
        )}
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="group/hero relative overflow-hidden">
      <HoneycombField />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[450px] bg-background/30 backdrop-blur-[1px] [mask-image:linear-gradient(to_bottom,black_65%,transparent)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 pt-20 pb-14 text-center">
        <Badge variant="secondary">Local-first • Free for individuals</Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Your studies deserve more than scattered files.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          STDHub is a calm desktop workspace with a VSCode-style editor, calculator,
          web research and an AI tutor. Your files stay on your machine — the cloud
          only if you want it.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href="#get-started" className={buttonVariants({ variant: 'default', size: 'lg' })}>
            Download free
          </a>
          <a href="#features" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            See features
          </a>
        </div>
        <div className="mt-8 w-full max-w-4xl">
          <AppMock />
        </div>
      </div>
    </section>
  )
}

function TrustStrip() {
  return (
    <section className="border-y bg-muted/40">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-8 sm:grid-cols-3">
        {TRUST.map((t) => (
          <div key={t.title} className="flex items-center gap-3">
            <t.icon className="size-6 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-muted-foreground">{t.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-16 px-6 py-20">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">Everything you need, one workspace.</h2>
        <p className="text-muted-foreground">
          Phase 1 ships the editor and settings. Calculator, research and tutor
          arrive in Phase 2 — their spots are already reserved.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <f.icon className="size-5 text-primary" aria-hidden />
              </CardDescription>
              <CardTitle>{f.title}</CardTitle>
              <CardAction>
                {f.soon ? <Badge variant="secondary">Coming soon</Badge> : null}
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{f.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Compare() {
  return (
    <section id="compare" className="mx-auto w-full max-w-6xl scroll-mt-16 px-6 py-20">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">Why STDHub.</h2>
        <p className="text-muted-foreground">Note apps scatter. Editors overwhelm. STDHub studies.</p>
      </div>
      <Card className="mt-10">
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>STDHub</TableHead>
                <TableHead>Note apps</TableHead>
                <TableHead>Code editors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARE_ROWS.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="font-medium">{row.feature}</TableCell>
                  <TableCell>{row.stdhub}</TableCell>
                  <TableCell className="text-muted-foreground">{row.notes}</TableCell>
                  <TableCell className="text-muted-foreground">{row.editors}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="border-y bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">Start free, stay local.</h2>
          <p className="text-muted-foreground">Free forever for individuals. Cloud plans arrive later.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Free</CardDescription>
              <CardTitle className="text-4xl">$0</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li>VSCode-style editor + explorer</li>
                <li>Works 100% offline, guest mode</li>
                <li>Themes, English + Português</li>
                <li>Export to GitHub or Drive</li>
              </ul>
              <a href="#get-started" className={buttonVariants({ variant: 'default' })}>
                Download free
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Pro</CardDescription>
              <CardTitle className="text-4xl">Planned</CardTitle>
              <CardAction>
                <Badge variant="secondary">Coming soon</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li>STDHub cloud sync</li>
                <li>Chat history everywhere</li>
                <li>Priority features</li>
              </ul>
              <Button variant="outline" disabled>
                Coming soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-16 px-6 py-20">
      <h2 className="text-3xl font-semibold tracking-tight">Questions?</h2>
      <Accordion className="mt-8">
        {FAQS.map((f, i) => (
          <AccordionItem key={f.q} value={`q${i}`}>
            <AccordionTrigger>{f.q}</AccordionTrigger>
            <AccordionContent>
              <p>{f.a}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

function FinalCta() {
  return (
    <section id="get-started" className="mx-auto w-full max-w-6xl scroll-mt-16 px-6 pb-20">
      <Card className="items-center py-12 text-center">
        <CardHeader className="w-full justify-items-center text-center">
          <CardTitle className="text-3xl">Start free, stay local.</CardTitle>
          <CardDescription className="max-w-xl">
            Download STDHub for Windows. No account needed — continue as a guest
            and create one only if you want the cloud.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button size="lg" disabled>
            Windows build in progress
          </Button>
          <p className="text-xs text-muted-foreground">Prototype — the installer lands on this page soon.</p>
        </CardContent>
      </Card>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center">
        <p className="font-semibold text-foreground">STDHub</p>
        <p>A calm, local-first study workspace.</p>
        <Separator orientation="vertical" className="hidden h-4 md:block" />
        <p className="md:ml-auto">© 2026 STDHub. Prototype page.</p>
      </div>
    </footer>
  )
}

function App() {
  return (
    <div id="top" className="flex min-h-svh flex-col bg-background text-foreground">
      <Nav />
      <main className="flex flex-col">
        <Hero />
        <TrustStrip />
        <Features />
        <Compare />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

export default App
