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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn, signUp, type AuthResult } from '@/lib/auth'

interface LoginScreenProps {
  onGuest: () => void
}

function LoginScreen({ onGuest }: LoginScreenProps) {
  const { t } = useTranslation()
  // No database chosen yet (own SQL vs Supabase still open): cloud login
  // stays honestly disabled and guest mode is fully functional offline.
  const configured = false
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(mode: 'login' | 'signup'): Promise<void> {
    setError('')
    setNotice('')
    setPending(true)
    try {
      const run = mode === 'login' ? signIn : signUp
      const result: AuthResult = await run(null, email, password)
      if (!result.ok) {
        setError(result.raw ?? t(result.key))
        return
      }
      if (result.needsConfirmation) {
        setNotice(t('auth.checkEmail'))
        return
      }
      // Session is live — App picks it up via onAuthStateChange.
    } catch {
      setError(t('auth.failed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh animate-in items-center justify-center bg-background p-6 fade-in duration-300">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('auth.title')}</CardTitle>
          <CardDescription>{t('auth.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stdhub-email">{t('auth.email')}</Label>
            <Input
              id="stdhub-email"
              type="email"
              autoComplete="email"
              value={email}
              disabled={!configured || pending}
              aria-invalid={error !== ''}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stdhub-password">{t('auth.password')}</Label>
            <Input
              id="stdhub-password"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={!configured || pending}
              aria-invalid={error !== ''}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error !== '' ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {notice !== '' ? (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          {!configured ? (
            <p className="text-xs text-muted-foreground">
              {t('auth.notConfigured')}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={!configured || pending}
              onClick={() => void submit('login')}
            >
              {t('auth.login')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={!configured || pending}
              onClick={() => void submit('signup')}
            >
              {t('auth.signup')}
            </Button>
          </div>
          <Button type="button" variant="secondary" onClick={onGuest}>
            {t('auth.guest')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('auth.guestNote')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginScreen
