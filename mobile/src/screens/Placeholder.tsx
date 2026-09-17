import { useI18n } from '../state/i18n'
import { TopBar } from '../components/navigation'

export function PlaceholderScreen({ title }: { title: string }) {
  const { t } = useI18n()
  return (
    <>
      <TopBar title={title} />
      <div className="m-content">
        <p className="m-muted">{t('common.loading')}</p>
      </div>
    </>
  )
}
