import type { ReactNode } from 'react'
import {
  Bot,
  ChevronLeft,
  FileText,
  Home,
  Menu,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { useI18n } from '../state/i18n'
import type { MainTab } from '../state/app'

export function BackButton({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={label}
      style={{ minWidth: 44, minHeight: 44, background: 'none', border: 0 }}
    >
      <ChevronLeft aria-hidden style={{ width: 24, height: 24 }} />
    </button>
  )
}

export function TopBar({
  title,
  left,
  right,
}: {
  title: string
  left?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="m-topbar">
      {left}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      {right}
    </div>
  )
}

const TABS: { id: MainTab; icon: LucideIcon }[] = [
  { id: 'home', icon: Home },
  { id: 'notebook', icon: FileText },
  { id: 'search', icon: Search },
  { id: 'tutor', icon: Bot },
  { id: 'more', icon: Menu },
]

export function BottomNav({
  tab,
  onTab,
}: {
  tab: MainTab
  onTab: (tab: MainTab) => void
}) {
  const { t } = useI18n()
  const labels: Record<MainTab, string> = {
    home: 'Home',
    notebook: t('notebook.title'),
    search: t('search.title'),
    tutor: t('tutor.title'),
    more: t('more.title'),
  }
  return (
    <nav className="m-bottomnav" aria-label="main">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={tab === item.id}
          aria-label={labels[item.id]}
          data-tour={`nav-${item.id}`}
          onClick={() => onTab(item.id)}
        >
          <item.icon aria-hidden style={{ width: 22, height: 22 }} />
          <span>{labels[item.id]}</span>
        </button>
      ))}
    </nav>
  )
}
