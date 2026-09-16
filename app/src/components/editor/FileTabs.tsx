import { useTranslation } from 'react-i18next'
import { Save, X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export interface EditorTab {
  path: string
  name: string
  dirty: boolean
  preview: boolean
}

interface FileTabsProps {
  files: EditorTab[]
  active: string | null
  canSave: boolean
  highlightIndex: number | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers: (path: string) => void
  onCloseAll: () => void
  onSave: () => void
}

function FileTabs({
  files,
  active,
  canSave,
  highlightIndex,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseAll,
  onSave,
}: FileTabsProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center border-b">
      <div
        role="tablist"
        aria-label="editor-files"
        data-tabbar
        className="flex min-h-[34px] min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-2 pt-1.5"
      >
        {files.map((file, i) => (
          <div
            key={file.path}
            role="tab"
            aria-selected={active === file.path}
            className={
              highlightIndex === i
                ? 'animate-in rounded-md fade-in ring-1 ring-primary slide-in-from-left-1 duration-200'
                : 'animate-in fade-in slide-in-from-left-1 duration-200'
            }
          >
            <ContextMenu>
              <ContextMenuTrigger className="flex items-center rounded-t-md data-[state=open]:bg-accent">
                <button
                  type="button"
                  onClick={() => onActivate(file.path)}
                  className={
                    active === file.path
                      ? 'rounded-tl-md bg-muted px-3 py-1.5 text-xs font-medium'
                      : 'rounded-tl-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground'
                  }
                >
                  <span className={file.preview ? 'italic' : undefined}>
                    {file.name}
                  </span>
                  {file.dirty ? (
                    <span aria-hidden className="ml-1">
                      •
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  aria-label={t('explorer.closeFile', { name: file.name })}
                  onClick={() => onClose(file.path)}
                  className="rounded-tr-md px-1.5 py-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuGroup>
                  <ContextMenuItem onClick={() => onClose(file.path)}>
                    {t('explorer.close')}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onCloseOthers(file.path)}>
                    {t('explorer.closeOthers')}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={onCloseAll}>
                    {t('explorer.closeAll')}
                  </ContextMenuItem>
                </ContextMenuGroup>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label={t('explorer.save')}
        title={t('explorer.save')}
        disabled={!canSave}
        onClick={onSave}
        className="mr-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Save className="size-4" aria-hidden />
      </button>
    </div>
  )
}

export default FileTabs
