import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Cloud, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'

interface EditorPanelProps {
  hostRef: (el: HTMLDivElement | null) => void
  onOpenFolder: () => void
}

function EditorPanel({ hostRef, onOpenFolder }: EditorPanelProps) {
  const { t } = useTranslation()
  const [cloudNote, setCloudNote] = useState<string | null>(null)
  const [fsError, setFsError] = useState<string | null>(null)
  const [hasRoot, setHasRoot] = useState(false)

  useEffect(() => {
    function onRoot(e: Event): void {
      const detail = (e as CustomEvent<{ root?: unknown }>).detail
      setHasRoot(typeof detail?.root === 'string' && detail.root !== '')
      // A fresh folder clears the last filesystem error.
      setFsError(null)
    }
    function onFsError(e: Event): void {
      const code = (e as CustomEvent<{ code?: unknown }>).detail?.code
      if (typeof code !== 'string') {
        setFsError(t('explorer.opFailed'))
        return
      }
      switch (code) {
        case 'too-large':
          setFsError(t('explorer.tooLarge'))
          break
        case 'binary':
          setFsError(t('explorer.binary'))
          break
        case 'invalid-name':
          setFsError(t('explorer.invalidName'))
          break
        case 'exists':
          setFsError(t('explorer.exists'))
          break
        case 'not-found':
          setFsError(t('explorer.notFound'))
          break
        case 'unsupported':
          setFsError(t('explorer.webUnsupported'))
          break
        default:
          setFsError(t('explorer.opFailed'))
      }
    }
    window.addEventListener('stdhub:root', onRoot)
    window.addEventListener('stdhub:fs-error', onFsError)
    return () => {
      window.removeEventListener('stdhub:root', onRoot)
      window.removeEventListener('stdhub:fs-error', onFsError)
    }
  }, [t])

  function soon(): void {
    setCloudNote(t('explorer.cloudSoon'))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 p-3">
      <p className="px-1 text-xs font-semibold text-muted-foreground">
        {t('shell.explorer')}
      </p>
      <div className="flex gap-1">
        {hasRoot ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('explorer.openMenu')}
            title={t('explorer.openMenu')}
            onClick={onOpenFolder}
          >
            <FolderOpen aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 justify-start"
            onClick={onOpenFolder}
          >
            <FolderOpen data-icon="inline-start" />
            <span className="truncate">{t('explorer.openFolder')}</span>
          </Button>
        )}
      </div>
      <Separator className="my-1" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <Cloud data-icon="inline-start" />
                {t('explorer.linkCloud')}
              </span>
              <ChevronDown data-icon="inline-end" />
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={soon}>
              {t('explorer.cloudGithub')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={soon}>
              {t('explorer.cloudDrive')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <span className="flex w-full items-center justify-between gap-4">
              <span>{t('explorer.cloudStdhub')}</span>
              <span className="text-xs text-muted-foreground">
                {t('explorer.cloudProNote')}
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {cloudNote ? (
        <p role="status" className="px-1 text-xs text-muted-foreground">
          {cloudNote}
        </p>
      ) : null}
      {fsError ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {fsError}
        </p>
      ) : null}
      <div ref={hostRef} className="flex min-h-0 flex-1 flex-col" />
    </div>
  )
}

export default EditorPanel
