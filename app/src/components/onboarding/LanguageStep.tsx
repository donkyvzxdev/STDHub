import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  detectLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/lib/i18n'

const NATIVE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  pt: 'Português',
}

interface LanguageStepProps {
  onDone: () => void
}

function LanguageStep({ onDone }: LanguageStepProps) {
  const { t } = useTranslation()
  const [detected] = useState<SupportedLanguage>(() => detectLanguage())
  const [lang, setLang] = useState<SupportedLanguage>(detected)

  function confirm(): void {
    setLanguage(lang)
      .then(onDone)
      .catch(() => onDone())
  }

  return (
    <div className="flex min-h-svh animate-in items-center justify-center bg-background p-6 fade-in duration-300">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('onboard.languageTitle')}</CardTitle>
          <CardDescription>
            {t('onboard.languageDetected', { name: NATIVE_NAMES[detected] })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleGroup
            variant="outline"
            value={[lang]}
            onValueChange={(value) => {
              const next = value[0]
              if (next === 'en' || next === 'pt') setLang(next)
            }}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <ToggleGroupItem key={l} value={l} aria-label={NATIVE_NAMES[l]}>
                {NATIVE_NAMES[l]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button type="button" onClick={confirm}>
            {t('onboard.continue')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default LanguageStep
