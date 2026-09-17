import { useState } from 'react'
import { useI18n } from '../state/i18n'
import { Btn } from '../components/ui/primitives'

function LanguageStep({ onDone }: { onDone: (lang: 'en' | 'pt') => void }) {
  const { t, setLang: setAppLang } = useI18n()
  const [lang, setLang] = useState<'en' | 'pt'>('en')

  function pick(next: 'en' | 'pt'): void {
    setLang(next)
    // Live preview: everything already speaks the chosen language.
    setAppLang(next)
  }

  return (
    <div className="m-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>{t('onboarding.languageTitle')}</h1>
      <button
        type="button"
        onClick={() => pick('en')}
        aria-pressed={lang === 'en'}
        className="m-card"
        style={{
          textAlign: 'left',
          width: '100%',
          borderColor: lang === 'en' ? 'var(--accent)' : undefined,
          fontSize: 17,
        }}
      >
        🇺🇸 English
      </button>
      <button
        type="button"
        onClick={() => pick('pt')}
        aria-pressed={lang === 'pt'}
        className="m-card"
        style={{
          textAlign: 'left',
          width: '100%',
          borderColor: lang === 'pt' ? 'var(--accent)' : undefined,
          fontSize: 17,
        }}
      >
        🇧🇷 Português
      </button>
      <Btn primary onClick={() => onDone(lang)}>
        {t('onboarding.continue')}
      </Btn>
    </div>
  )
}

export function Onboarding({ onDone }: { onDone: (lang: 'en' | 'pt') => void }) {
  return <LanguageStep onDone={onDone} />
}
