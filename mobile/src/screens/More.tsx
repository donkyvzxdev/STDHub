import { Calculator, CalendarDays, FolderOpen, Settings } from 'lucide-react'
import { useI18n } from '../state/i18n'
import { useApp } from '../state/app'
import { TopBar } from '../components/navigation'

export function MoreScreen() {
  const { t } = useI18n()
  const { go } = useApp()
  const items = [
    { icon: Calculator, label: t('more.calculator'), go: () => go({ name: 'calc' }) },
    { icon: CalendarDays, label: t('more.calendar'), go: () => go({ name: 'calendar' }) },
    { icon: FolderOpen, label: t('more.files'), go: () => go({ name: 'files' }) },
    { icon: Settings, label: t('more.settings'), go: () => go({ name: 'settings' }) },
  ]
  return (
    <>
      <TopBar title={t('more.title')} />
      <div className="m-content" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.go}
            className="m-card"
            style={{ width: '100%', textAlign: 'left', fontSize: 17 }}
          >
            <item.icon aria-hidden style={{ marginRight: 10, verticalAlign: -4 }} />
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
