import {
  Bot,
  CalendarDays,
  Info,
  Languages,
  Link2,
  NotebookPen,
  Palette,
  Search,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useApp, type SettingsSection } from '../state/app'
import { useI18n } from '../state/i18n'
import { TopBar, BackButton } from '../components/navigation'

const SECTIONS: { id: SettingsSection; icon: LucideIcon; titleKey: string; descKey?: string }[] = [
  { id: 'appearance', icon: Palette, titleKey: 'settings.appearance' },
  { id: 'language', icon: Languages, titleKey: 'settings.language' },
  { id: 'ai', icon: Bot, titleKey: 'settings.ai' },
  { id: 'search', icon: Search, titleKey: 'settings.search' },
  { id: 'notebook', icon: NotebookPen, titleKey: 'settings.notebook' },
  { id: 'calendar', icon: CalendarDays, titleKey: 'settings.calendarSettings' },
  { id: 'integrations', icon: Link2, titleKey: 'settings.integrations' },
  { id: 'advanced', icon: SlidersHorizontal, titleKey: 'settings.advanced', descKey: 'settings.advancedDesc' },
  { id: 'about', icon: Info, titleKey: 'settings.about' },
]

export function SettingsScreen() {
  const { t } = useI18n()
  const { go, back } = useApp()
  return (
    <>
      <TopBar
        title={t('settings.title')}
        left={<BackButton onBack={back} label={t('common.back')} />}
      />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => go({ name: 'settingsSection', section: section.id })}
            className="m-row"
          >
            <section.icon aria-hidden style={{ width: 22, height: 22, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>{t(section.titleKey)}</span>
              {section.descKey && (
                <span className="m-muted" style={{ display: 'block', fontSize: 13 }}>
                  {t(section.descKey)}
                </span>
              )}
            </span>
            <span aria-hidden className="m-muted">›</span>
          </button>
        ))}
      </div>
    </>
  )
}
